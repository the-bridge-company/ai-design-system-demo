// The billing scripts (docs/BILLING.md): the Stripe catalog matches the prices the site states and is idempotent by
// lookup key, the Organization script bills by invoice in 30 days and never makes a second subscription, and the
// founding marks cover every team Redis knows, once. Stripe is a fake; Redis is the in-memory one.
import { describe, expect, it } from 'vitest';
import { LOOKUP_KEYS, TEAM_PRICES } from '../apps/docs-site/src/lib/billing.ts';
import { memoryRedis } from '../apps/docs-site/api/_lib/redis.ts';
import { isFounding } from '../apps/docs-site/api/_lib/billing.ts';
import { PORTAL, PRICES, priceMismatch, syncCatalog, TAX_CODE } from './stripe-catalog.mjs';
import { parseArgs, setUpOrganization, subscriptionParams } from './stripe-organization.mjs';
import { markFounding, teamsFromKeys } from './billing-mark-founding.mjs';

function fakeStripe(seed = {}) {
  const made = [];
  const products = [...(seed.products ?? [])];
  const prices = [...(seed.prices ?? [])];
  const configs = [...(seed.configs ?? [])];
  const list = (arr) => ({ data: arr, async *[Symbol.asyncIterator]() { yield* arr; } });
  return {
    made,
    products: {
      list: () => list(products),
      create: async (p) => (made.push(['product', p]), products.push({ id: `prod_${products.length}`, ...p }), products.at(-1)),
    },
    prices: {
      list: async ({ lookup_keys }) => ({ data: prices.filter((x) => lookup_keys.includes(x.lookup_key)) }),
      create: async (p) => (made.push(['price', p]), prices.push({ id: `price_${prices.length}`, ...p }), prices.at(-1)),
    },
    billingPortal: { configurations: { list: async () => ({ data: configs }), create: async (p) => (made.push(['portal', p]), configs.push(p), p) } },
    customers: {
      search: async ({ query }) => ({ data: (seed.customers ?? []).filter((c) => query.includes(c.metadata.bridge_team)) }),
      create: async (p) => (made.push(['customer', p]), { id: 'cus_new', ...p }),
    },
    subscriptions: {
      list: async ({ customer }) => ({ data: (seed.subs ?? []).filter((s) => s.customer === customer) }),
      create: async (p) => (made.push(['subscription', p]), { id: 'sub_new', status: 'active', ...p }),
    },
  };
}

describe('scripts/stripe-catalog.mjs', () => {
  it('holds the six lookup keys of the site, at the prices the site states', () => {
    expect(PRICES.map((p) => p.lookup_key).sort()).toEqual([...LOOKUP_KEYS].sort());
    for (const p of PRICES.filter((x) => x.tier === 'team')) {
      const [, , cur, per] = p.lookup_key.split('_');
      const monthly = TEAM_PRICES[cur][per] * 100;
      expect(p.unit_amount).toBe(per === 'yearly' ? monthly * 12 : monthly);
    }
    expect(PRICES.find((p) => p.lookup_key === 'bridge_org_eur_yearly').unit_amount).toBe(490 * 12 * 100);
    expect(PRICES.find((p) => p.lookup_key === 'bridge_org_usd_yearly').unit_amount).toBe(550 * 12 * 100);
    expect(PORTAL.features.subscription_cancel).toMatchObject({ mode: 'at_period_end', proration_behavior: 'none' });
  });

  it('dry run creates nothing; apply creates products, prices and the portal once', async () => {
    const s = fakeStripe();
    const dry = await syncCatalog(s, { log: () => {} });
    expect(s.made).toEqual([]);
    expect(dry.filter((l) => l.startsWith('missing'))).toHaveLength(9);
    await syncCatalog(s, { apply: true, log: () => {} });
    expect(s.made.filter(([k]) => k === 'product').map(([, p]) => p)).toEqual([expect.objectContaining({ tax_code: TAX_CODE, metadata: { bridge_tier: 'team' } }), expect.objectContaining({ tax_code: TAX_CODE, metadata: { bridge_tier: 'organization' } })]);
    expect(s.made.filter(([k]) => k === 'price').every(([, p]) => p.tax_behavior === 'exclusive')).toBe(true);
    expect(s.made.filter(([k]) => k === 'price')).toHaveLength(6);
    const before = s.made.length;
    const again = await syncCatalog(s, { apply: true, log: () => {} });
    expect(s.made.length).toBe(before);
    expect(again.every((l) => l.startsWith('ok'))).toBe(true);
  });

  it('reports a price that differs, never replaces it', () => {
    expect(priceMismatch(PRICES[0], { unit_amount: 14400, currency: 'eur', recurring: { interval: 'year' }, tax_behavior: 'exclusive' })).toBeNull();
    expect(priceMismatch(PRICES[0], { unit_amount: 12000, currency: 'eur', recurring: { interval: 'year' }, tax_behavior: 'inclusive' })).toContain('amount 12000');
  });
});

describe('scripts/stripe-organization.mjs', () => {
  const argv = ['--team', 'Acme/DS', '--currency', 'eur', '--email', 'billing@acme.example', '--name', 'Acme SAS', '--country', 'fr', '--vat', 'FR12345678901'];

  it('needs a team, an email, a legal name and a country', () => {
    expect(parseArgs(argv)).toMatchObject({ team: 'acme/ds', currency: 'eur', country: 'FR', apply: false });
    expect(() => parseArgs(['--email', 'a@b.co'])).toThrow(/--team/);
    expect(() => parseArgs(['--team', 'a/b', '--email', 'a@b.co', '--name', 'A'])).toThrow(/--country/);
  });

  it('bills by invoice, 30 days to pay, with Stripe Tax, tagged with the team', () => {
    expect(subscriptionParams(parseArgs(argv), 'cus_1', 'price_org')).toMatchObject({ collection_method: 'send_invoice', days_until_due: 30, automatic_tax: { enabled: true }, metadata: { bridge_team: 'acme/ds' }, items: [{ price: 'price_org', quantity: 1 }] });
  });

  it('dry run makes nothing; apply makes the customer with its VAT number, then the subscription; never twice', async () => {
    const prices = [{ id: 'price_org', lookup_key: 'bridge_org_eur_yearly' }];
    const s = fakeStripe({ prices });
    await setUpOrganization(s, parseArgs(argv), () => {});
    expect(s.made).toEqual([]);
    await setUpOrganization(s, parseArgs([...argv, '--apply']), () => {});
    expect(s.made.map(([k]) => k)).toEqual(['customer', 'subscription']);
    expect(s.made[0][1]).toMatchObject({ metadata: { bridge_team: 'acme/ds' }, tax_id_data: [{ type: 'eu_vat', value: 'FR12345678901' }], address: { country: 'FR' } });
    const paid = fakeStripe({ prices, customers: [{ id: 'cus_1', metadata: { bridge_team: 'acme/ds' } }], subs: [{ customer: 'cus_1', status: 'active', items: { data: [{ price: { lookup_key: 'bridge_org_eur_yearly' } }] } }] });
    expect(await setUpOrganization(paid, parseArgs([...argv, '--apply']), () => {})).toEqual({ customer: 'cus_1', subscription: null });
    expect(paid.made).toEqual([]);
  });
});

describe('scripts/billing-mark-founding.mjs', () => {
  it('reads teams from key names, leaving counters and email indexes out', () => {
    const t = teamsFromKeys(['bridge:members:acme/ds', 'bridge:invites:email:a@b.io', 'bridge:invites:count:team:x:2027', 'bridge:invites:beta/ds', 'bridge:team:name:_team/00112233aabbccdd', 'bridge:team:discovery:gamma/ds']);
    expect([...t].sort()).toEqual(['_team/00112233aabbccdd', 'acme/ds', 'beta/ds', 'gamma/ds']);
  });

  it('dry run writes nothing; apply marks each team once, and they read as founding', async () => {
    const redis = memoryRedis(() => 0);
    await redis.cmd('SADD', 'bridge:members:acme/ds', 'a@acme.io');
    await redis.cmd('SET', 'bridge:team:rec:00112233aabbccdd', JSON.stringify({ id: '00112233aabbccdd', repo: 'linked/ds' }));
    const found = await markFounding(redis, { extra: ['Extra/DS'], log: () => {} });
    expect(found).toEqual(['acme/ds', 'extra/ds', 'linked/ds']);
    expect(redis.keys().some((k) => k.startsWith('bridge:billing:founding:'))).toBe(false);
    await markFounding(redis, { apply: true, extra: ['Extra/DS'], log: () => {} });
    const lines = [];
    await markFounding(redis, { apply: true, extra: ['extra/ds'], log: (l) => lines.push(l) });
    expect(lines.at(-1)).toBe('0 marked, 3 already founding.');
    const flags = { launched: true, launchDate: '2027-02-01' };
    expect(await isFounding(redis, 'acme/ds', flags)).toBe(true);
    expect(await isFounding(redis, 'other/ds', flags)).toBe(false);
  });
});
