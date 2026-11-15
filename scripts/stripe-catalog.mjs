#!/usr/bin/env node
// The Stripe catalog of Bridge billing (docs/BILLING.md): two products, six prices found by lookup key, and the Customer
// Portal configuration. Runs in whatever mode the key is (test or live): the same lookup keys in both, so the code
// never names a price id.
//
//   STRIPE_SECRET_KEY=... node scripts/stripe-catalog.mjs            dry run: says what is there and what is missing
//   STRIPE_SECRET_KEY=... node scripts/stripe-catalog.mjs --apply    creates what is missing
//
// Idempotent: a product is found by metadata.bridge_tier, a price by its lookup key, the portal configuration by
// metadata.bridge_portal. Nothing that exists is changed. A price whose amount, currency or interval differs from the
// catalog is reported, never replaced (prices cannot be edited; replace it by hand, moving the lookup key with
// transfer_lookup_key). The key is read from the environment only and never printed.
//
// Keep in step with apps/docs-site/src/lib/billing.ts (scripts/stripe-catalog.test.mjs checks it).

import { fileURLToPath } from 'node:url';

export const TAX_CODE = 'txcd_10103001';

export const PRODUCTS = {
  team: { name: 'Bridge Team', description: 'Bridge for a team: unlimited editors, up to three design systems.' },
  organization: { name: 'Bridge Organization', description: 'Bridge for an organization, billed by invoice.' },
};

/** Amounts in cents, before VAT (tax_behavior exclusive). Team is per editor; Organization per organization. */
export const PRICES = [
  { lookup_key: 'bridge_team_eur_yearly', tier: 'team', currency: 'eur', interval: 'year', unit_amount: 14400, nickname: 'Team, yearly (12 EUR per editor a month)' },
  { lookup_key: 'bridge_team_eur_monthly', tier: 'team', currency: 'eur', interval: 'month', unit_amount: 1500, nickname: 'Team, monthly (15 EUR per editor)' },
  { lookup_key: 'bridge_team_usd_yearly', tier: 'team', currency: 'usd', interval: 'year', unit_amount: 16800, nickname: 'Team, yearly (14 USD per editor a month)' },
  { lookup_key: 'bridge_team_usd_monthly', tier: 'team', currency: 'usd', interval: 'month', unit_amount: 1700, nickname: 'Team, monthly (17 USD per editor)' },
  { lookup_key: 'bridge_org_eur_yearly', tier: 'organization', currency: 'eur', interval: 'year', unit_amount: 588000, nickname: 'Organization, yearly (490 EUR a month)' },
  { lookup_key: 'bridge_org_usd_yearly', tier: 'organization', currency: 'usd', interval: 'year', unit_amount: 660000, nickname: 'Organization, yearly (550 USD a month)' },
];

export const SITE = 'https://bridgedesignsystem.com';

/** The Customer Portal: invoices, payment method, billing details, stop at the end of the period. No plan changes. */
export const PORTAL = {
  name: 'Bridge Team billing',
  metadata: { bridge_portal: 'team' },
  business_profile: { headline: 'Bridge', privacy_policy_url: `${SITE}/privacy/`, terms_of_service_url: `${SITE}/pricing/` },
  features: {
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    customer_update: { enabled: true, allowed_updates: ['address', 'tax_id', 'email', 'name'] },
    subscription_cancel: { enabled: true, mode: 'at_period_end', proration_behavior: 'none' },
    subscription_update: { enabled: false },
  },
};

/** What a price that exists says against the catalog: null when it matches. */
export function priceMismatch(want, have) {
  const diffs = [];
  if (have.unit_amount !== want.unit_amount) diffs.push(`amount ${have.unit_amount} (want ${want.unit_amount})`);
  if (have.currency !== want.currency) diffs.push(`currency ${have.currency} (want ${want.currency})`);
  if (have.recurring?.interval !== want.interval) diffs.push(`interval ${have.recurring?.interval} (want ${want.interval})`);
  if (have.tax_behavior !== 'exclusive') diffs.push(`tax_behavior ${have.tax_behavior} (want exclusive)`);
  return diffs.length ? diffs.join(', ') : null;
}

/** Makes the catalog exist on `stripe` (a Stripe client). Returns the lines it printed. */
export async function syncCatalog(stripe, { apply = false, log = console.log } = {}) {
  const lines = [];
  const say = (s) => {
    lines.push(s);
    log(s);
  };
  const products = [];
  for await (const p of stripe.products.list({ active: true, limit: 100 })) products.push(p);
  const mode = (o) => (o?.livemode ? 'live' : 'test');
  const productOf = {};
  for (const [tier, def] of Object.entries(PRODUCTS)) {
    const found = products.find((p) => p.metadata?.bridge_tier === tier);
    if (found) {
      productOf[tier] = found.id;
      say(`ok      product ${tier} (${mode(found)})`);
    } else if (apply) {
      const made = await stripe.products.create({ name: def.name, description: def.description, tax_code: TAX_CODE, metadata: { bridge_tier: tier } });
      productOf[tier] = made.id;
      say(`created product ${tier} (${mode(made)})`);
    } else say(`missing product ${tier}`);
  }
  for (const want of PRICES) {
    const have = (await stripe.prices.list({ lookup_keys: [want.lookup_key], limit: 1 })).data[0];
    if (have) {
      const diff = priceMismatch(want, have);
      say(diff ? `differs ${want.lookup_key}: ${diff}` : `ok      ${want.lookup_key}`);
      continue;
    }
    if (!apply || !productOf[want.tier]) {
      say(`missing ${want.lookup_key}`);
      continue;
    }
    await stripe.prices.create({
      product: productOf[want.tier],
      currency: want.currency,
      unit_amount: want.unit_amount,
      recurring: { interval: want.interval },
      tax_behavior: 'exclusive',
      lookup_key: want.lookup_key,
      nickname: want.nickname,
      metadata: { bridge_tier: want.tier },
    });
    say(`created ${want.lookup_key}`);
  }
  const configs = (await stripe.billingPortal.configurations.list({ active: true, limit: 100 })).data;
  if (configs.some((c) => c.metadata?.bridge_portal === PORTAL.metadata.bridge_portal)) say('ok      portal configuration');
  else if (apply) {
    await stripe.billingPortal.configurations.create(PORTAL);
    say('created portal configuration');
  } else say('missing portal configuration');
  // The account's default invoice footer has no API for a standard account: Bridge sets the franchise footer on every
  // customer and subscription it makes, and the Dashboard default covers invoices made by hand (docs/BILLING.md).
  say('check   Dashboard > Settings > Billing > Invoices > Default footer (VAT franchise line, docs/BILLING.md)');
  return lines;
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    console.error('Set STRIPE_SECRET_KEY (test or live). It is read from the environment only and never printed.');
    process.exit(1);
  }
  const apply = process.argv.includes('--apply');
  const { default: Stripe } = await import('stripe');
  const stripe = new Stripe(key, { appInfo: { name: 'Bridge catalog' } });
  console.log(`${key.startsWith('sk_live') || key.startsWith('rk_live') ? 'LIVE' : 'test'} mode, ${apply ? 'applying' : 'dry run (add --apply to create what is missing)'}`);
  await syncCatalog(stripe, { apply });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(`Failed: ${e?.type ?? ''} ${e?.message ?? e}`);
    process.exit(1);
  });
}
