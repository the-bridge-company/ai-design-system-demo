// Billing (docs/BILLING.md): the shared rules (quantity, lookup keys, words), the server state (founding teams, the
// effective tier, the Free limits) and /api/billing (status, checkout, portal, webhook), with billing off and on.
// Stripe is a fake, except the webhook signature: Stripe's own helper signs with an obviously fake secret and the real
// client checks it on the raw body. Real functions, an in-memory Redis.
import Stripe from 'stripe';
import { describe, expect, it } from 'vitest';
import { type Account, ACCOUNT_COOKIE, putAccount, signAccountSession } from '../../api/_lib/account';
import {
  billingFromSubscription,
  type BillingFlags,
  billingKey,
  type BillingStripe,
  designSystemFits,
  editorFits,
  editorsOf,
  effectiveTier,
  emptyBilling,
  foundingKey,
  getBilling,
  isFounding,
  markFounding,
  moveBilling,
  putBilling,
  stripeClient,
  type StripeSubscriptionLike,
  subscriptionOfInvoice,
  teamPlan,
} from '../../api/_lib/billing';
import { memberStore } from '../../api/_lib/members';
import { memoryRedis } from '../../api/_lib/redis';
import { actionOf, BILLING_OFF, FOUNDING, handleBilling, settingsPath } from '../../api/billing/index';
import { inviteStoreOn } from '../../api/invites/index';
import { BILLING_LAUNCHED, BILLING_LAUNCH_DATE, BILLING_WORDS, checkoutPrice, checkoutQuantity, LOOKUP_KEYS, lookupKey, parseBillingStatus, tierOfLookupKey } from './billing';

const HOST = 'bridge.example.com';
const ORIGIN = `https://${HOST}`;
const SECRET = 's'.repeat(40);
const WHSEC = 'whsec_test_fake';
const ENV = { LIBRARY_SESSION_SECRET: SECRET, STRIPE_SECRET_KEY: 'sk_test_fake_not_a_real_key', STRIPE_WEBHOOK_SECRET: WHSEC };
const T0 = Date.parse('2027-03-01T10:00:00Z');
const ON: BillingFlags = { launched: true, launchDate: '2027-02-01' };
const OFF: BillingFlags = { launched: false, launchDate: null };
const TEAM = 'northwind/ds';

const sub = (x: Partial<StripeSubscriptionLike> & { lookup?: string; quantity?: number; end?: number } = {}): StripeSubscriptionLike => ({
  id: x.id ?? 'sub_1',
  status: x.status ?? 'active',
  customer: x.customer ?? 'cus_1',
  cancel_at_period_end: x.cancel_at_period_end ?? false,
  metadata: x.metadata ?? { bridge_team: TEAM },
  items: { data: [{ quantity: x.quantity ?? 4, current_period_end: x.end ?? Math.floor(T0 / 1000) + 365 * 86400, price: { lookup_key: x.lookup ?? 'bridge_team_eur_yearly', currency: 'eur', recurring: { interval: 'year' } } }] },
});

function fakeStripe() {
  const calls: { op: string; p: any }[] = [];
  const subs = new Map<string, StripeSubscriptionLike>();
  let n = 0;
  const real = stripeClient(ENV.STRIPE_SECRET_KEY);
  const stripe: BillingStripe = {
    async priceIdByLookupKey(key) {
      calls.push({ op: 'price', p: key });
      return LOOKUP_KEYS.includes(key) ? `price_${key}` : null;
    },
    async createCustomer(p) {
      calls.push({ op: 'customer', p });
      return { id: `cus_${++n}` };
    },
    async createCheckoutSession(p) {
      calls.push({ op: 'checkout', p });
      return { url: 'https://checkout.stripe.com/c/pay/cs_test_1' };
    },
    async portalConfigurationId() {
      return 'bpc_bridge';
    },
    async createPortalSession(p) {
      calls.push({ op: 'portal', p });
      return { url: 'https://billing.stripe.com/p/session/test_1' };
    },
    async retrieveSubscription(id) {
      return subs.get(id) ?? null;
    },
    // The real check, on the raw body, offline.
    constructEvent: real.constructEvent,
  };
  return { stripe, calls, subs };
}

function setup(flags = ON) {
  let now = T0;
  const redis = memoryRedis(() => now);
  const members = memberStore(redis);
  const invites = inviteStoreOn(redis, () => now);
  const fake = fakeStripe();
  const deps = { fetch: async () => new Response('{}', { status: 404 }), now: () => now, redis, members, invites, stripe: fake.stripe, flags };
  const cookie = async (address: string, name: string) => {
    const a: Account = { id: `id-${address}`, email: address, name, github: null, createdAt: new Date(T0).toISOString(), version: 1 };
    await putAccount(redis, a);
    return `${ACCOUNT_COOKIE}=${signAccountSession({ email: address, v: 1, exp: now + 86_400_000 }, SECRET)}`;
  };
  const admin = async () => {
    await members.put(TEAM, { email: 'jo@northwind.io', name: 'Jo', role: 'admin', version: 1, addedBy: 'x', at: new Date(T0).toISOString() });
    return cookie('jo@northwind.io', 'Jo');
  };
  const get = async (c: string, query = `?team=${TEAM}`, env: Record<string, string> = ENV) => {
    const r = await handleBilling(new Request(`${ORIGIN}/api/billing${query}`, { headers: { host: HOST, cookie: c } }), env, deps);
    return { status: r.status, body: (await r.json()) as any };
  };
  const post = async (c: string, action: string, body: unknown, env: Record<string, string> = ENV) => {
    const r = await handleBilling(new Request(`${ORIGIN}/api/billing?action=${action}`, { method: 'POST', headers: { host: HOST, origin: ORIGIN, cookie: c, 'content-type': 'application/json', 'x-bridge-account': '1' }, body: JSON.stringify(body) }), env, deps);
    return { status: r.status, body: (await r.json()) as any };
  };
  const hook = async (event: unknown, secret = WHSEC) => {
    const payload = JSON.stringify(event);
    const header = new Stripe('sk_test_fake_not_a_real_key').webhooks.generateTestHeaderString({ payload, secret });
    const r = await handleBilling(new Request(`${ORIGIN}/api/billing/webhook`, { method: 'POST', headers: { host: HOST, 'stripe-signature': header, 'content-type': 'application/json' }, body: payload }), ENV, deps);
    return { status: r.status, body: (await r.json()) as any };
  };
  return { redis, members, invites, fake, cookie, admin, get, post, hook, deps, tick: (ms: number) => (now += ms) };
}

const editor = (email: string, role: 'view' | 'edit' | 'admin' = 'edit') => ({ email, name: email.split('@')[0]!, role, version: 1, addedBy: 'x', at: new Date(T0).toISOString() });

describe('the shared rules', () => {
  it('ships off: the switch is false and no launch date is set', () => {
    expect(BILLING_LAUNCHED).toBe(false);
    expect(BILLING_LAUNCH_DATE).toBeNull();
  });

  it('quantity: editors 1 to 10 per design system, times 1 to 3 design systems', () => {
    expect(checkoutQuantity(0)).toBe(1);
    expect(checkoutQuantity(4)).toBe(4);
    expect(checkoutQuantity(25)).toBe(10);
    expect(checkoutQuantity(4, 2)).toBe(8);
    expect(checkoutQuantity(40, 9)).toBe(30);
  });

  it('prices: per editor per month, yearly billed for twelve months', () => {
    expect(checkoutPrice(4, 'eur', 'yearly')).toEqual({ perMonth: 48, perPeriod: 576 });
    expect(checkoutPrice(4, 'usd', 'monthly')).toEqual({ perMonth: 68, perPeriod: 68 });
    expect(BILLING_WORDS.quote(4, 'eur', 'yearly')).toBe('4 editors: 48 € a month, billed 576 € a year.');
  });

  it('lookup keys: six, Organization yearly only, and back to their tier', () => {
    expect(LOOKUP_KEYS).toEqual(['bridge_team_eur_yearly', 'bridge_team_eur_monthly', 'bridge_team_usd_yearly', 'bridge_team_usd_monthly', 'bridge_org_eur_yearly', 'bridge_org_usd_yearly']);
    expect(lookupKey('organization', 'usd', 'yearly')).toBe('bridge_org_usd_yearly');
    expect(tierOfLookupKey('bridge_org_eur_yearly')).toBe('organization');
    expect(tierOfLookupKey('bridge_team_usd_monthly')).toBe('team');
    expect(tierOfLookupKey('bridge_org_eur_monthly')).toBeNull();
    expect(tierOfLookupKey('other')).toBeNull();
  });

  it('words carry no em dash', () => {
    const all = JSON.stringify(BILLING_WORDS) + BILLING_WORDS.quote(1, 'usd', 'monthly') + BILLING_WORDS.ends('2027-01-01') + BILLING_WORDS.renews('2027-01-01');
    expect(all).not.toContain('—');
  });

  it('a status answer is checked before the card reads it', () => {
    expect(parseBillingStatus({ tier: 'gold', founding: false })).toBeNull();
    expect(parseBillingStatus({ tier: 'team', founding: false, currency: 'gbp', quantity: 3 })).toMatchObject({ tier: 'team', currency: null, quantity: 3 });
  });
});

describe('founding teams and the tier that applies', () => {
  it('billing off: no limit, and nothing is read', async () => {
    const reads: unknown[] = [];
    const spy = { cmd: async (...a: unknown[]) => void reads.push(a), pipe: async () => [] };
    expect(await teamPlan(spy, TEAM, OFF)).toEqual({ tier: 'free', founding: true, limited: false });
    expect(await editorFits(spy, TEAM, OFF, async () => 99)).toBe(true);
    expect(await designSystemFits(spy, async () => ['a/b', 'c/d'], OFF)).toBe(true);
    expect(reads).toEqual([]);
  });

  it('no launch date yet: every team is founding', async () => {
    const redis = memoryRedis();
    expect(await isFounding(redis, TEAM, { launched: true, launchDate: null })).toBe(true);
  });

  it('a marked team, or a team made in Bridge before the date, is founding; a newer one is not', async () => {
    const redis = memoryRedis(() => T0);
    expect(await isFounding(redis, TEAM, ON)).toBe(false);
    expect(await markFounding(redis, TEAM, T0)).toBe(true);
    expect(await markFounding(redis, TEAM, T0)).toBe(false);
    expect(await isFounding(redis, TEAM, ON)).toBe(true);
    await redis.cmd('SET', 'bridge:team:rec:00112233aabbccdd', JSON.stringify({ id: '00112233aabbccdd', name: 'Old', createdBy: 'a@b.io', createdAt: '2027-01-15T00:00:00Z', repo: 'old/ds' }));
    await redis.cmd('SET', 'bridge:team:byrepo:old/ds', '00112233aabbccdd');
    expect(await isFounding(redis, '_team/00112233aabbccdd', ON)).toBe(true);
    expect(await isFounding(redis, 'old/ds', ON)).toBe(true);
    await redis.cmd('SET', 'bridge:team:rec:99112233aabbccdd', JSON.stringify({ id: '99112233aabbccdd', name: 'New', createdBy: 'a@b.io', createdAt: '2027-02-15T00:00:00Z', repo: null }));
    expect(await isFounding(redis, '_team/99112233aabbccdd', ON)).toBe(false);
  });

  it('the paid tier applies while Stripe still collects; Free once it ends, data kept', async () => {
    const redis = memoryRedis(() => T0);
    const b = billingFromSubscription(null, sub({ quantity: 6 }), T0);
    expect(b).toMatchObject({ tier: 'team', status: 'active', currency: 'eur', interval: 'yearly', quantity: 6, customerId: 'cus_1' });
    expect(effectiveTier(b)).toBe('team');
    expect(effectiveTier({ ...b, status: 'past_due' })).toBe('team');
    expect(effectiveTier({ ...b, status: 'canceled' })).toBe('free');
    expect(effectiveTier({ ...b, status: 'unpaid' })).toBe('free');
    await putBilling(redis, TEAM, { ...b, status: 'canceled' });
    expect(await teamPlan(redis, TEAM, ON)).toEqual({ tier: 'free', founding: false, limited: true });
    expect((await getBilling(redis, TEAM))?.customerId).toBe('cus_1');
    await markFounding(redis, TEAM, T0);
    expect((await teamPlan(redis, TEAM, ON)).limited).toBe(false);
  });

  it('editors: Can edit, Admin and editor invites count; Can view and waiting invites do not', () => {
    expect(editorsOf([{ role: 'admin' }, { role: 'edit' }, { role: 'view' }], [{ role: 'reviewer' }, { role: 'view' }, { role: 'edit', needsTeam: true }])).toBe(3);
  });

  it('a team made in Bridge linked to its repository keeps its billing and founding mark', async () => {
    const redis = memoryRedis(() => T0);
    await putBilling(redis, '_team/00112233aabbccdd', { ...emptyBilling(T0), customerId: 'cus_9' });
    await markFounding(redis, '_team/00112233aabbccdd', T0);
    await moveBilling(redis, '_team/00112233aabbccdd', 'acme/ds');
    expect((await getBilling(redis, 'acme/ds'))?.customerId).toBe('cus_9');
    expect(await redis.cmd('GET', 'bridge:billing:customer:cus_9')).toBe('acme/ds');
    expect(await redis.cmd('GET', foundingKey('acme/ds'))).not.toBeNull();
  });

  it('finds the subscription of an invoice in every API shape', () => {
    expect(subscriptionOfInvoice({ subscription: 'sub_a' })).toBe('sub_a');
    expect(subscriptionOfInvoice({ parent: { subscription_details: { subscription: 'sub_b' } } })).toBe('sub_b');
    expect(subscriptionOfInvoice({ lines: { data: [{ parent: { subscription_item_details: { subscription: 'sub_c' } } }] } })).toBe('sub_c');
    expect(subscriptionOfInvoice({})).toBeNull();
  });
});

describe('/api/billing with billing off', () => {
  it('says off, and every call answers 503, keys set or not', async () => {
    const s = setup(OFF);
    const c = await s.admin();
    expect((await s.get(c, '')).body).toEqual({ billing: 'off' });
    expect(await s.get(c)).toEqual({ status: 503, body: { error: 'billing_off', message: BILLING_OFF } });
    expect((await s.post(c, 'checkout', { team: TEAM, currency: 'eur', interval: 'yearly' })).status).toBe(503);
    expect((await s.post(c, 'portal', { team: TEAM })).status).toBe(503);
    expect(s.fake.calls).toEqual([]);
  });

  it('launched but a key missing: off too, the webhook included', async () => {
    const s = setup(ON);
    const c = await s.admin();
    const noHook = { LIBRARY_SESSION_SECRET: SECRET, STRIPE_SECRET_KEY: 'sk_test_fake_not_a_real_key' };
    expect((await s.get(c, '', noHook)).body).toEqual({ billing: 'off' });
    expect((await s.get(c, `?team=${TEAM}`, noHook)).status).toBe(503);
    expect((await s.post(c, 'checkout', { team: TEAM, currency: 'eur', interval: 'yearly' }, { LIBRARY_SESSION_SECRET: SECRET })).status).toBe(503);
    const r = await handleBilling(new Request(`${ORIGIN}/api/billing?action=webhook`, { method: 'POST', headers: { 'stripe-signature': 't=1,v1=x' }, body: '{}' }), noHook, s.deps);
    expect(r.status).toBe(503);
  });
});

describe('/api/billing with billing on', () => {
  it('status: admins only; Free with its editors and the checkout quantity', async () => {
    const s = setup();
    const c = await s.admin();
    await s.members.put(TEAM, editor('sam@northwind.io'));
    await s.members.put(TEAM, editor('lee@northwind.io', 'view'));
    expect((await s.get(c, '')).body).toEqual({ billing: 'on' });
    const r = await s.get(c);
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ tier: 'free', founding: false, editors: 2, checkoutQuantity: 2, canManage: false });
    const sam = await s.cookie('sam@northwind.io', 'Sam');
    expect((await s.get(sam)).status).toBe(403);
    expect((await s.get('')).status).toBe(401);
  });

  it('checkout: a Team session with tax, address and VAT number, one customer kept, back to Settings', async () => {
    const s = setup();
    const c = await s.admin();
    for (let i = 0; i < 13; i++) await s.members.put(TEAM, editor(`p${i}@northwind.io`));
    const r = await s.post(c, 'checkout', { team: TEAM, currency: 'usd', interval: 'monthly' });
    expect(r).toEqual({ status: 200, body: { url: 'https://checkout.stripe.com/c/pay/cs_test_1', quantity: 10 } });
    const session = s.fake.calls.find((x) => x.op === 'checkout')!.p;
    expect(session).toMatchObject({
      mode: 'subscription',
      customer: 'cus_1',
      client_reference_id: TEAM,
      line_items: [{ price: 'price_bridge_team_usd_monthly', quantity: 10 }],
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      billing_address_collection: 'required',
      subscription_data: { metadata: { bridge_team: TEAM } },
      success_url: `${ORIGIN}/studio/northwind/ds/settings/?billing=done#billing`,
      cancel_url: `${ORIGIN}/studio/northwind/ds/settings/#billing`,
    });
    expect(s.fake.calls.find((x) => x.op === 'customer')!.p).toMatchObject({ email: 'jo@northwind.io', metadata: { bridge_team: TEAM } });
    await s.post(c, 'checkout', { team: TEAM, currency: 'eur', interval: 'yearly' });
    expect(s.fake.calls.filter((x) => x.op === 'customer')).toHaveLength(1);
    expect((await getBilling(s.redis, TEAM))?.customerId).toBe('cus_1');
  });

  it('checkout refuses a founding team, a paying team, a bad choice and a non-admin', async () => {
    const s = setup();
    const c = await s.admin();
    expect((await s.post(c, 'checkout', { team: TEAM, currency: 'gbp', interval: 'yearly' })).status).toBe(400);
    expect((await s.post(c, 'checkout', { team: TEAM, currency: 'eur', interval: 'weekly' })).status).toBe(400);
    await putBilling(s.redis, TEAM, billingFromSubscription(null, sub(), T0));
    expect((await s.post(c, 'checkout', { team: TEAM, currency: 'eur', interval: 'yearly' })).body.error).toBe('already');
    await markFounding(s.redis, TEAM, T0);
    expect((await s.post(c, 'checkout', { team: TEAM, currency: 'eur', interval: 'yearly' })).body).toEqual({ error: 'founding', message: FOUNDING });
    const sam = await s.cookie('sam@northwind.io', 'Sam');
    await s.members.put(TEAM, editor('sam@northwind.io'));
    expect((await s.post(sam, 'checkout', { team: 'other/ds', currency: 'eur', interval: 'yearly' })).status).toBe(403);
    expect(s.fake.calls.filter((x) => x.op === 'checkout')).toEqual([]);
  });

  it('checkout and portal need the CSRF header and this site', async () => {
    const s = setup();
    const c = await s.admin();
    const r = await handleBilling(new Request(`${ORIGIN}/api/billing?action=checkout`, { method: 'POST', headers: { host: HOST, origin: 'https://evil.example', cookie: c, 'content-type': 'application/json', 'x-bridge-account': '1' }, body: '{}' }), ENV, s.deps);
    expect(r.status).toBe(403);
  });

  it('portal: only with a customer, with the Bridge configuration, back to Settings', async () => {
    const s = setup();
    const c = await s.admin();
    expect((await s.post(c, 'portal', { team: TEAM })).body.error).toBe('no_customer');
    await putBilling(s.redis, TEAM, { ...emptyBilling(T0), customerId: 'cus_7' });
    const r = await s.post(c, 'portal', { team: TEAM });
    expect(r.body.url).toBe('https://billing.stripe.com/p/session/test_1');
    expect(s.fake.calls.find((x) => x.op === 'portal')!.p).toEqual({ customer: 'cus_7', return_url: `${ORIGIN}/studio/northwind/ds/settings/#billing`, configuration: 'bpc_bridge' });
  });

  it('routes /api/billing/<action> and returns a team made in Bridge to its workspace Settings', () => {
    expect(actionOf(new Request(`${ORIGIN}/api/billing/webhook`))).toBe('webhook');
    expect(actionOf(new Request(`${ORIGIN}/api/billing?action=portal`))).toBe('portal');
    expect(settingsPath({ owner: '_team', repo: 'abc', full: '_team/abc', id: 'abc' })).toBe('/studio/workspace/settings/?team=abc');
  });
});

describe('the webhook', () => {
  const event = (id: string, type: string, object: unknown) => ({ id, object: 'event', type, created: Math.floor(T0 / 1000), data: { object } });

  it('refuses a body signed with another secret, or not signed', async () => {
    const s = setup();
    expect((await s.hook(event('evt_1', 'invoice.paid', {}), 'whsec_test_other_fake')).status).toBe(400);
    const r = await handleBilling(new Request(`${ORIGIN}/api/billing/webhook`, { method: 'POST', body: '{}' }), ENV, s.deps);
    expect(r.status).toBe(400);
  });

  it('checkout completed: keeps the customer and writes the subscription on the team, once per event', async () => {
    const s = setup();
    s.fake.subs.set('sub_1', sub({ quantity: 4 }));
    const e = event('evt_c', 'checkout.session.completed', { id: 'cs_1', mode: 'subscription', client_reference_id: TEAM, customer: 'cus_1', subscription: 'sub_1' });
    expect((await s.hook(e)).body).toEqual({ received: true, applied: true });
    expect(await getBilling(s.redis, TEAM)).toMatchObject({ tier: 'team', status: 'active', quantity: 4, customerId: 'cus_1', subscriptionId: 'sub_1', cancelAtPeriodEnd: false });
    // The same event again: nothing is done twice.
    s.fake.subs.set('sub_1', sub({ quantity: 9 }));
    expect((await s.hook(e)).body).toEqual({ received: true, duplicate: true });
    expect((await getBilling(s.redis, TEAM))?.quantity).toBe(4);
  });

  it('subscription updated, payment failed, then ended: back to Free rules, nothing of the team deleted', async () => {
    const s = setup();
    await s.members.put(TEAM, editor('a@northwind.io'));
    s.fake.subs.set('sub_1', sub({ cancel_at_period_end: true }));
    await s.hook(event('evt_u', 'customer.subscription.updated', { id: 'sub_1' }));
    expect(await getBilling(s.redis, TEAM)).toMatchObject({ tier: 'team', cancelAtPeriodEnd: true });
    s.fake.subs.set('sub_1', sub({ status: 'past_due' }));
    await s.hook(event('evt_f', 'invoice.payment_failed', { id: 'in_1', parent: { subscription_details: { subscription: 'sub_1' } } }));
    expect(await teamPlan(s.redis, TEAM, ON)).toMatchObject({ tier: 'team', limited: false });
    s.fake.subs.set('sub_1', sub({ status: 'canceled' }));
    await s.hook(event('evt_d', 'customer.subscription.deleted', { id: 'sub_1' }));
    expect(await teamPlan(s.redis, TEAM, ON)).toEqual({ tier: 'free', founding: false, limited: true });
    expect(await s.members.list(TEAM)).toHaveLength(1);
    expect(await s.redis.cmd('GET', billingKey(TEAM))).not.toBeNull();
  });

  it('invoice paid on an Organization subscription made by the script (metadata only)', async () => {
    const s = setup();
    s.fake.subs.set('sub_o', sub({ id: 'sub_o', customer: 'cus_o', lookup: 'bridge_org_eur_yearly', quantity: 1 }));
    await s.hook(event('evt_p', 'invoice.paid', { id: 'in_2', subscription: 'sub_o' }));
    expect(await getBilling(s.redis, TEAM)).toMatchObject({ tier: 'organization', customerId: 'cus_o' });
    expect(await s.redis.cmd('GET', 'bridge:billing:customer:cus_o')).toBe(TEAM);
  });

  it('ignores events it does not handle, and subscriptions that are not Bridge teams', async () => {
    const s = setup();
    expect((await s.hook(event('evt_x', 'charge.refunded', {}))).body).toEqual({ received: true, applied: false });
    s.fake.subs.set('sub_z', sub({ id: 'sub_z', customer: 'cus_unknown', metadata: {} }));
    expect((await s.hook(event('evt_z', 'customer.subscription.created', { id: 'sub_z' }))).body.applied).toBe(false);
  });

  it('a failure is not remembered: Stripe sends the event again and it runs', async () => {
    const s = setup();
    let fail = true;
    const retrieve = s.fake.stripe.retrieveSubscription;
    s.fake.stripe.retrieveSubscription = async (id) => {
      if (fail) throw new Error('down');
      return retrieve(id);
    };
    s.fake.subs.set('sub_1', sub());
    const e = event('evt_r', 'customer.subscription.created', { id: 'sub_1' });
    expect((await s.hook(e)).status).toBe(500);
    fail = false;
    expect((await s.hook(e)).body).toEqual({ received: true, applied: true });
  });
});
