// Billing state of a team, the founding-team rule and the Free limits (docs/BILLING.md). Shared by api/billing (Stripe
// checkout, portal, webhook), api/invites and api/entry (the limits). Not a function (underscore directory).
//
// Nothing here runs while billing is off (src/lib/billing.ts BILLING_LAUNCHED false): every check below answers
// "no limit" before it reads anything, so production behaves exactly as before billing existed.
//
// Keys (Upstash Redis, the same database as teams and members; `<team>` is owner/repo lower case, or `_team/<id>`):
//   bridge:billing:team:<team>        { customerId, subscriptionId, tier, status, periodEnd, cancelAtPeriodEnd,
//                                       currency, interval, quantity, updatedAt }  no expiry, never deleted on cancel
//   bridge:billing:customer:<cus_id>  the team a Stripe customer pays for
//   bridge:billing:founding:<team>    { at, by }  a team that existed at launch (scripts/billing-mark-founding.mjs)
//   bridge:billing:event:<evt_id>     a Stripe event already handled, 30 days (webhook idempotency)
// A limit pauses, never deletes: a 4th editor's invite waits marked "needs Team", a 2nd design system is refused with
// the same words; members already on the team keep everything. A team whose subscription ends goes back to the Free
// rules (what is past them waits), founding teams excepted. No secret is ever stored here.

import type { Redis } from './redis.js';
import { BILLING_LAUNCHED, BILLING_LAUNCH_DATE, billingOnFor, parseTestTeams, FREE_DESIGN_SYSTEMS, FREE_EDITORS, isCurrency, isInterval, tierOfLookupKey, type Currency, type Interval, type Tier } from '../../src/lib/billing.js';
import { teamKeyId } from '../../src/lib/team-path.js';

/**
 * The switch, the launch date and the test teams, injectable so tests run every way. Defaults: src/lib/billing.ts, and
 * BILLING_TEST_TEAMS from the server env (read on each request, so a change in Vercel applies at the next deploy).
 */
export interface BillingFlags {
  launched: boolean;
  launchDate: string | null;
  /** Team keys billing is on for before launch (src/lib/billing.ts parseTestTeams). */
  testTeams: readonly string[];
}
export const BILLING_FLAGS: Omit<BillingFlags, 'testTeams'> = { launched: BILLING_LAUNCHED, launchDate: BILLING_LAUNCH_DATE };
export const flagsOf = (f?: Partial<BillingFlags>): BillingFlags => ({ ...BILLING_FLAGS, testTeams: parseTestTeams(process.env.BILLING_TEST_TEAMS), ...(f ?? {}) });
/** Billing applies to this team (launched, or a test team). */
export const billingOn = (flags: BillingFlags, team: string): boolean => billingOnFor(flags.launched, flags.testTeams, team);
/** Billing applies to some team: false means nothing below reads anything. */
const anyBilling = (flags: BillingFlags): boolean => flags.launched || flags.testTeams.length > 0;

export interface TeamBilling {
  customerId: string | null;
  subscriptionId: string | null;
  /** The tier the subscription pays for (`free` without one). What applies is effectiveTier. */
  tier: Tier;
  status: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  currency: Currency | null;
  interval: Interval | null;
  quantity: number | null;
  updatedAt: string;
}

const lc = (s: string) => s.trim().toLowerCase();
export const billingKey = (team: string) => `bridge:billing:team:${lc(team)}`;
export const customerKey = (customerId: string) => `bridge:billing:customer:${customerId}`;
export const foundingKey = (team: string) => `bridge:billing:founding:${lc(team)}`;
export const eventKey = (eventId: string) => `bridge:billing:event:${eventId}`;
export const EVENT_TTL_S = 30 * 24 * 60 * 60;

export const emptyBilling = (now: number): TeamBilling => ({ customerId: null, subscriptionId: null, tier: 'free', status: null, periodEnd: null, cancelAtPeriodEnd: false, currency: null, interval: null, quantity: null, updatedAt: new Date(now).toISOString() });

export function parseBilling(raw: unknown): TeamBilling | null {
  if (typeof raw !== 'string') return null;
  try {
    const v = JSON.parse(raw) as Partial<TeamBilling>;
    if (!v || typeof v !== 'object' || !['free', 'team', 'organization'].includes(v.tier as string)) return null;
    const str = (x: unknown) => (typeof x === 'string' ? x : null);
    return {
      customerId: str(v.customerId),
      subscriptionId: str(v.subscriptionId),
      tier: v.tier as Tier,
      status: str(v.status),
      periodEnd: str(v.periodEnd),
      cancelAtPeriodEnd: v.cancelAtPeriodEnd === true,
      currency: isCurrency(v.currency) ? v.currency : null,
      interval: isInterval(v.interval) ? v.interval : null,
      quantity: typeof v.quantity === 'number' ? v.quantity : null,
      updatedAt: str(v.updatedAt) ?? new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}

export async function getBilling(redis: Redis, team: string): Promise<TeamBilling | null> {
  return parseBilling(await redis.cmd('GET', billingKey(team)));
}

export async function putBilling(redis: Redis, team: string, b: TeamBilling): Promise<void> {
  await redis.pipe([['SET', billingKey(team), JSON.stringify(b)], ...(b.customerId ? [['SET', customerKey(b.customerId), lc(team)]] : [])]);
}

export async function teamOfCustomer(redis: Redis, customerId: string): Promise<string | null> {
  const v = await redis.cmd('GET', customerKey(customerId));
  return typeof v === 'string' ? v : null;
}

/** Subscription states that keep the paid tier: Stripe retries a failed payment (past_due) before it gives up. */
const PAYING = new Set(['active', 'trialing', 'past_due']);

/** The tier that applies: the paid one while the subscription stands, else Free. */
export const effectiveTier = (b: TeamBilling | null): Tier => (b && b.tier !== 'free' && b.status && PAYING.has(b.status) ? b.tier : 'free');

/**
 * A founding team: marked at launch, or a team made in Bridge before the launch date. While no launch date is set,
 * every team is one (nothing can be limited before launch). Founding teams are never limited and never billed.
 */
export async function isFounding(redis: Redis, team: string, flags: BillingFlags): Promise<boolean> {
  // A test team before launch: founding only when marked by hand, so the test sees Free, Team and the limits.
  if (!flags.launched && flags.testTeams.includes(lc(team))) return (await redis.cmd('GET', foundingKey(team))) !== null;
  if (!flags.launchDate) return true;
  if ((await redis.cmd('GET', foundingKey(team))) !== null) return true;
  const launch = Date.parse(flags.launchDate);
  if (!Number.isFinite(launch)) return true;
  // A team made in Bridge carries its creation date: its key, or the record a repository was linked from.
  const id = teamKeyId(team) ?? (await redis.cmd('GET', `bridge:team:byrepo:${lc(team)}`));
  if (typeof id !== 'string') return false;
  const raw = await redis.cmd('GET', `bridge:team:rec:${lc(id)}`);
  try {
    const at = typeof raw === 'string' ? Date.parse((JSON.parse(raw) as { createdAt?: string }).createdAt ?? '') : NaN;
    return Number.isFinite(at) && at < launch;
  } catch {
    return false;
  }
}

export async function markFounding(redis: Redis, team: string, now: number, by = 'launch'): Promise<boolean> {
  return (await redis.cmd('SET', foundingKey(team), JSON.stringify({ at: new Date(now).toISOString(), by }), 'NX')) === 'OK';
}

export interface TeamPlan {
  tier: Tier;
  founding: boolean;
  /** The Free limits apply: billing launched, Free, not a founding team. */
  limited: boolean;
}

/** What applies to a team now. With billing off: no limit, and nothing is read. */
export async function teamPlan(redis: Redis | null, team: string, flags: BillingFlags): Promise<TeamPlan> {
  if (!billingOn(flags, team) || !redis) return { tier: 'free', founding: true, limited: false };
  const founding = await isFounding(redis, team, flags);
  const tier = effectiveTier(await getBilling(redis, team));
  return { tier, founding, limited: !founding && tier === 'free' };
}

// ---------------------------------------------------------------------------------------------------------------
// Editors: whoever proposes or decides in Studio. Email members who can change things (Can edit, Admin), and pending
// invites that would make one (Can edit, Reviewer, Admin) unless they already wait for Team. Can view does not count,
// nor GitHub people who only work in GitHub.

export const countsAsEditor = (role: string): boolean => role === 'edit' || role === 'admin' || role === 'reviewer';

export function editorsOf(members: readonly { role: string }[], invites: readonly { role: string; needsTeam?: boolean }[] = []): number {
  return members.filter((m) => countsAsEditor(m.role)).length + invites.filter((i) => countsAsEditor(i.role) && !i.needsTeam).length;
}

/**
 * Whether one more editor fits: always outside the Free limits; on Free, while fewer than FREE_EDITORS count.
 * `editors` is read only when the limits apply (a function, so billing off reads nothing).
 */
export async function editorFits(redis: Redis | null, team: string, flags: BillingFlags, editors: () => Promise<number>): Promise<boolean> {
  const plan = await teamPlan(redis, team, flags);
  if (!plan.limited) return true;
  return (await editors()) < FREE_EDITORS;
}

/**
 * Whether an account may start one more design system (a team made in Bridge). Free covers FREE_DESIGN_SYSTEMS per
 * account: counted as the teams the account administers that are on the Free limits (founding and paying teams do
 * not count).
 */
export async function designSystemFits(redis: Redis | null, adminOf: () => Promise<string[]>, flags: BillingFlags): Promise<boolean> {
  if (!anyBilling(flags) || !redis) return true;
  let free = 0;
  for (const team of await adminOf()) if ((await teamPlan(redis, team, flags)).limited) free++;
  return free < FREE_DESIGN_SYSTEMS;
}

/** A team made in Bridge moved to its repository (api/entry link-team): its billing and founding mark follow. */
export async function moveBilling(redis: Redis, from: string, to: string): Promise<void> {
  const [b, f] = await redis.pipe([
    ['GET', billingKey(from)],
    ['GET', foundingKey(from)],
  ]);
  const cmds: (string | number)[][] = [];
  const bill = parseBilling(b);
  if (bill && !(await getBilling(redis, to))) {
    cmds.push(['SET', billingKey(to), JSON.stringify(bill)]);
    if (bill.customerId) cmds.push(['SET', customerKey(bill.customerId), lc(to)]);
  }
  if (typeof f === 'string') cmds.push(['SET', foundingKey(to), f, 'NX']);
  if (cmds.length) await redis.pipe(cmds);
}

// ---------------------------------------------------------------------------------------------------------------
// Stripe, behind a small interface: the real client (the `stripe` package, loaded on first use) or a fake in tests.

export interface StripeSubscriptionLike {
  id: string;
  status: string;
  customer: string | { id: string };
  cancel_at_period_end?: boolean;
  /** Older API versions; newer ones carry it per item. */
  current_period_end?: number;
  metadata?: Record<string, string> | null;
  items: { data: { quantity?: number | null; current_period_end?: number; price: { lookup_key?: string | null; currency: string; recurring?: { interval: string } | null } }[] };
}

export interface StripeEventLike {
  id: string;
  type: string;
  data: { object: Record<string, any> };
}

export interface BillingStripe {
  priceIdByLookupKey(key: string): Promise<string | null>;
  /** Without an email (a GitHub sign-in), Checkout asks for the billing email. */
  createCustomer(p: { name: string; email?: string; metadata: Record<string, string> }): Promise<{ id: string }>;
  createCheckoutSession(p: Record<string, unknown>): Promise<{ url: string | null }>;
  /** The portal configuration tagged metadata.bridge_portal = 'team', else null (Stripe's default then applies). */
  portalConfigurationId(): Promise<string | null>;
  createPortalSession(p: { customer: string; return_url: string; configuration?: string }): Promise<{ url: string }>;
  retrieveSubscription(id: string): Promise<StripeSubscriptionLike | null>;
  /** Verifies the signature on the raw body and parses the event; throws when it does not match. */
  constructEvent(raw: string, signature: string, secret: string): Promise<StripeEventLike>;
}

/** The real client. The package loads on first use, so a function without the key never loads it. */
export function stripeClient(secretKey: string): BillingStripe {
  let client: any = null;
  const get = async () => {
    if (!client) {
      const { default: Stripe } = await import('stripe');
      client = new (Stripe as any)(secretKey, { maxNetworkRetries: 2, appInfo: { name: 'Bridge' } });
    }
    return client;
  };
  return {
    async priceIdByLookupKey(key) {
      const s = await get();
      const r = await s.prices.list({ lookup_keys: [key], active: true, limit: 1 });
      return r.data[0]?.id ?? null;
    },
    async createCustomer(p) {
      return (await get()).customers.create(p);
    },
    async createCheckoutSession(p) {
      return (await get()).checkout.sessions.create(p);
    },
    async portalConfigurationId() {
      const s = await get();
      const r = await s.billingPortal.configurations.list({ active: true, limit: 100 });
      return (r.data as { id: string; metadata?: Record<string, string> }[]).find((c) => c.metadata?.bridge_portal === 'team')?.id ?? null;
    },
    async createPortalSession(p) {
      return (await get()).billingPortal.sessions.create(p);
    },
    async retrieveSubscription(id) {
      try {
        return await (await get()).subscriptions.retrieve(id);
      } catch (e) {
        if ((e as { statusCode?: number }).statusCode === 404) return null;
        throw e;
      }
    },
    async constructEvent(raw, signature, secret) {
      return (await get()).webhooks.constructEventAsync(raw, signature, secret);
    },
  };
}

/** The team a subscription pays for: its metadata (checkout and the Organization script set it), else its customer. */
export async function teamOfSubscription(redis: Redis, sub: StripeSubscriptionLike): Promise<string | null> {
  const meta = sub.metadata?.bridge_team;
  if (typeof meta === 'string' && meta.trim()) return lc(meta);
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  return customer ? teamOfCustomer(redis, customer) : null;
}

/** The billing record a subscription gives a team (its customer kept). Never touches anything else of the team. */
export function billingFromSubscription(prev: TeamBilling | null, sub: StripeSubscriptionLike, now: number): TeamBilling {
  const item = sub.items?.data?.[0];
  const tier = tierOfLookupKey(item?.price?.lookup_key) ?? prev?.tier ?? 'free';
  const end = item?.current_period_end ?? sub.current_period_end;
  const interval = item?.price?.recurring?.interval === 'year' ? 'yearly' : item?.price?.recurring?.interval === 'month' ? 'monthly' : null;
  const currency = item?.price?.currency?.toLowerCase();
  const customer = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
  return {
    customerId: customer ?? prev?.customerId ?? null,
    subscriptionId: sub.id,
    tier,
    status: sub.status,
    periodEnd: typeof end === 'number' ? new Date(end * 1000).toISOString() : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end === true,
    currency: isCurrency(currency) ? currency : null,
    interval,
    quantity: typeof item?.quantity === 'number' ? item.quantity : null,
    updatedAt: new Date(now).toISOString(),
  };
}

/**
 * Writes what Stripe says now about one subscription on its team. A different, older subscription never overwrites
 * the team's current one while that one still pays. Returns the team, or null when the subscription is not Bridge's.
 */
export async function syncSubscription(redis: Redis, sub: StripeSubscriptionLike, now: number): Promise<string | null> {
  const team = await teamOfSubscription(redis, sub);
  if (!team) return null;
  const prev = await getBilling(redis, team);
  if (prev?.subscriptionId && prev.subscriptionId !== sub.id && effectiveTier(prev) !== 'free' && !PAYING.has(sub.status)) return team;
  await putBilling(redis, team, billingFromSubscription(prev, sub, now));
  return team;
}

/** The subscription an invoice belongs to, in every API version's shape. */
export function subscriptionOfInvoice(inv: Record<string, any>): string | null {
  const direct = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id;
  const parent = inv.parent?.subscription_details?.subscription;
  const fromParent = typeof parent === 'string' ? parent : parent?.id;
  const line = inv.lines?.data?.[0]?.parent?.subscription_item_details?.subscription;
  return direct ?? fromParent ?? (typeof line === 'string' ? line : null);
}

/** The events the webhook handles; Stripe's endpoint should send exactly these (docs/BILLING.md). */
export const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed',
] as const;
