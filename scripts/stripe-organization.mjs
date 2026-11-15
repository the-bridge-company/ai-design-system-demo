#!/usr/bin/env node
// Organization is never self-serve: Florian sets it up for a team once the contract is agreed (docs/BILLING.md). This
// makes the team's Stripe customer (or reuses it) and a yearly subscription billed by invoice: Stripe emails the
// invoice, payable within 30 days, VAT computed by Stripe Tax (reverse charge with a valid EU VAT number). The
// webhook (api/billing) then writes the subscription on the team: Studio shows Organization.
//
//   STRIPE_SECRET_KEY=... node scripts/stripe-organization.mjs --team acme/design-system --currency eur \
//     --email billing@acme.example --name "Acme SAS" --country FR --postal-code 75002 [--city Paris] \
//     [--line1 "1 rue X"] [--vat FR12345678901]                  dry run: says what it would create
//   ... --apply                                                      creates it
//
// Idempotent: a customer is found by metadata.bridge_team, and a team that already has an Organization subscription
// (not canceled) gets nothing new. The key is read from the environment only and never printed.

import { fileURLToPath } from 'node:url';

const TEAM = /^(?:[a-z0-9][a-z0-9-]{0,38}\/[a-z0-9._-]{1,100}|_team\/[a-f0-9]{16})$/;

/** The command line as options, or throws with what is missing. */
export function parseArgs(argv) {
  const get = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1].trim() : undefined;
  };
  const o = {
    team: get('team')?.toLowerCase(),
    currency: (get('currency') ?? 'eur').toLowerCase(),
    email: get('email'),
    name: get('name'),
    country: get('country')?.toUpperCase(),
    postalCode: get('postal-code'),
    city: get('city'),
    line1: get('line1'),
    vat: get('vat'),
    apply: argv.includes('--apply'),
  };
  if (!o.team || !TEAM.test(o.team)) throw new Error('--team owner/repo (or _team/<id>) is required.');
  if (o.currency !== 'eur' && o.currency !== 'usd') throw new Error('--currency eur or usd.');
  if (!o.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(o.email)) throw new Error('--email, where Stripe sends the invoices, is required.');
  if (!o.name) throw new Error('--name, the legal name on the invoice, is required.');
  if (!o.country || !/^[A-Z]{2}$/.test(o.country)) throw new Error('--country (two letters, FR) is required: Stripe Tax needs it.');
  return o;
}

/** The subscription parameters (the price by lookup key, billed by invoice, 30 days to pay). */
export function subscriptionParams(o, customer, price) {
  return {
    customer,
    items: [{ price, quantity: 1 }],
    collection_method: 'send_invoice',
    days_until_due: 30,
    automatic_tax: { enabled: true },
    metadata: { bridge_team: o.team },
    description: 'Bridge Organization, billed yearly',
  };
}

export async function setUpOrganization(stripe, o, log = console.log) {
  const lookup = `bridge_org_${o.currency}_yearly`;
  const price = (await stripe.prices.list({ lookup_keys: [lookup], active: true, limit: 1 })).data[0];
  if (!price) throw new Error(`No price ${lookup}: run scripts/stripe-catalog.mjs --apply first.`);
  const existing = (await stripe.customers.search({ query: `metadata['bridge_team']:'${o.team}'`, limit: 1 })).data[0];
  if (existing) {
    const subs = (await stripe.subscriptions.list({ customer: existing.id, status: 'all', limit: 20 })).data;
    if (subs.some((s) => s.status !== 'canceled' && s.status !== 'incomplete_expired' && s.items.data.some((i) => i.price.lookup_key?.startsWith('bridge_org_')))) {
      log(`${o.team} already has an Organization subscription: nothing to do.`);
      return { customer: existing.id, subscription: null };
    }
  }
  if (!o.apply) {
    log(`dry run: would ${existing ? 'reuse the customer of' : 'create a customer for'} ${o.team} (${o.name}, ${o.email}, ${o.country}${o.vat ? `, VAT ${o.vat}` : ''}) and a yearly ${lookup} subscription billed by invoice, 30 days to pay. Add --apply.`);
    return { customer: existing?.id ?? null, subscription: null };
  }
  const customer =
    existing ??
    (await stripe.customers.create({
      name: o.name,
      email: o.email,
      address: { country: o.country, ...(o.postalCode ? { postal_code: o.postalCode } : {}), ...(o.city ? { city: o.city } : {}), ...(o.line1 ? { line1: o.line1 } : {}) },
      metadata: { bridge_team: o.team },
      ...(o.vat ? { tax_id_data: [{ type: 'eu_vat', value: o.vat }] } : {}),
      preferred_locales: ['en'],
    }));
  const sub = await stripe.subscriptions.create(subscriptionParams(o, customer.id, price.id));
  log(`created: Organization for ${o.team}, subscription ${sub.id} (${sub.status}); Stripe emails the first invoice to ${o.email}.`);
  return { customer: customer.id, subscription: sub.id };
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    console.error('Set STRIPE_SECRET_KEY (test or live). It is read from the environment only and never printed.');
    process.exit(1);
  }
  const o = parseArgs(process.argv.slice(2));
  const { default: Stripe } = await import('stripe');
  console.log(`${key.startsWith('sk_live') || key.startsWith('rk_live') ? 'LIVE' : 'test'} mode`);
  await setUpOrganization(new Stripe(key, { appInfo: { name: 'Bridge organization' } }), o);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(`Failed: ${e?.message ?? e}`);
    process.exit(1);
  });
}
