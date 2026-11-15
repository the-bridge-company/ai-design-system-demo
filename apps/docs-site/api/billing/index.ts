// /api/billing: Stripe for Team (self-serve) and Organization (by invoice, scripts/stripe-organization.mjs), docs/BILLING.md.
//
// Off until launch: while src/lib/billing.ts BILLING_LAUNCHED is false, or STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET is
// missing, GET /api/billing says { billing: 'off' }, GET ?team= says { on: false } and checkout and portal answer 503.
// Before launch, billing is on for the teams of the server env BILLING_TEST_TEAMS only (end-to-end tests). The webhook needs the two keys only
// (a subscription made in test mode before launch still syncs). No key or secret is ever logged, stored or sent back.
//
// Endpoints (JSON; errors are { error, message } in Studio words). vercel.json rewrites /api/billing/<action> here.
//   GET  /api/billing                          { billing: 'on' | 'off' }
//   GET  /api/billing?team=<team>              { on: false } when billing is off for that team, else team admin: the
//                                              Billing card (src/lib/billing.ts BillingStatus, on: true)
//   POST /api/billing/checkout { team, currency: 'eur'|'usd', interval: 'yearly'|'monthly' }
//        team admin, Free, not founding: a Stripe Checkout Session for Team, { url } to go to. Quantity: the team's
//        editors, 1 to 10 (editors past ten are free), times its design systems (one per team today), one subscription
//        item (src/lib/billing.ts checkoutQuantity). The team's Stripe customer is made once and kept.
//   POST /api/billing/portal { team }          team admin with a customer: a Customer Portal session, { url }
//   POST /api/billing/webhook                  Stripe only: signature checked on the raw body with STRIPE_WEBHOOK_SECRET,
//        each event once (by id), the subscription read again from Stripe and written on its team (api/_lib/billing.ts).
// Admins: an email admin of the team (the account cookie), or the account's linked GitHub account is an admin of the
// repository (read with the Bridge app, GitHub id matched), as api/entry; or, for a repository's team, Studio's GitHub
// sign-in (`Authorization: Bearer`): GitHub says who the token is (GET /user) and that this user administers the
// repository (GET /repos with the same token, permissions.admin). Teams made in Bridge: the account only. POSTs other than the webhook carry
// `X-Bridge-Account: 1` (or `X-Bridge-Contribute: 1`) from a page of this site. Checkout and portal: a daily cap per account.
//
// Env (server only): STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, BILLING_TEST_TEAMS (optional, before launch), KV_REST_API_URL + KV_REST_API_TOKEN (or the UPSTASH_ pair),
// LIBRARY_SESSION_SECRET, GITHUB_APP_ID + GITHUB_APP_PRIVATE_KEY (GitHub admins), PUBLIC_SITE_URL (optional).

import { sessionAccount, shownEmail, type Account } from '../_lib/account.js';
import {
  billingOn,
  type BillingFlags,
  type BillingStripe,
  editorsOf,
  emptyBilling,
  effectiveTier,
  eventKey,
  EVENT_TTL_S,
  flagsOf,
  getBilling,
  isFounding,
  putBilling,
  stripeClient,
  subscriptionOfInvoice,
  syncSubscription,
} from '../_lib/billing.js';
import { githubApp, type AppTokens } from '../_lib/github-app.js';
import { dayOf, fail, GITHUB_DOWN, HttpError, json, readBody, sameOrigin, secondsToTomorrow, siteOrigin, type FetchLike } from '../_lib/http.js';
import { meteredFromEnv } from '../_lib/github-quota.js';
import { activeLocalAdmins, type LocalAdmins } from '../_lib/local-admin.js';
import { memberStore, type MemberStore } from '../_lib/members.js';
import { redisRest, type Redis } from '../_lib/redis.js';
import { getTeamNames, resolveTeam, type TeamRef } from '../_lib/teams.js';
import { inviteStoreOn, type InviteStore } from '../invites/index.js';
import { checkoutQuantity, isCurrency, isInterval, lookupKey, taxSetup, VAT_REGIME, type BillingStatus, type VatRegime } from '../../src/lib/billing.js';
import { teamDisplayName } from '../../src/lib/demo.js';
import { STUDIO_ROOT } from '../../src/lib/team-path.js';
import { canonicalEmail } from '../_lib/canonical-email.js';

export interface BillingEnv {
  STRIPE_SECRET_KEY?: string | undefined;
  STRIPE_WEBHOOK_SECRET?: string | undefined;
  KV_REST_API_URL?: string | undefined;
  KV_REST_API_TOKEN?: string | undefined;
  UPSTASH_REDIS_REST_URL?: string | undefined;
  UPSTASH_REDIS_REST_TOKEN?: string | undefined;
  LIBRARY_SESSION_SECRET?: string | undefined;
  GITHUB_APP_ID?: string | undefined;
  GITHUB_APP_PRIVATE_KEY?: string | undefined;
  PUBLIC_SITE_URL?: string | undefined;
}

export interface BillingDeps {
  fetch: FetchLike;
  now?: () => number;
  redis?: Redis;
  members?: MemberStore;
  invites?: InviteStore;
  app?: AppTokens;
  /** Tests inject a fake; otherwise the real client on STRIPE_SECRET_KEY. */
  stripe?: BillingStripe;
  /** Tests run both regimes; src/lib/billing.ts VAT_REGIME otherwise. */
  vatRegime?: VatRegime;
  /** Tests run both ways; otherwise src/lib/billing.ts. */
  flags?: Partial<BillingFlags>;
  localAdmins?: LocalAdmins;
}

export const BILLING_OFF = 'Billing is not available on this site yet.';
export const ADMIN_ONLY = 'Only admins of this team can see or change its billing.';
export const FOUNDING = 'Your team is a founding team: it keeps everything it has, at no cost. There is nothing to pay.';
export const ALREADY_PAYING = 'Your team is on a paid plan already. Manage billing to change it.';
export const NO_CUSTOMER = 'Your team has no billing yet. Move it to Team first.';
export const BUSY = 'Bridge is preparing your payment. Try again in a few seconds.';
export const STRIPE_DOWN = 'The payment service did not answer. Try again in a minute.';
const SIGNIN = 'Your session ended. Sign in again.';
const GITHUB_EXPIRED = 'Your GitHub sign-in expired. Sign in again.';
const STORAGE_DOWN = 'Bridge could not reach its storage. Try again in a minute.';
const MAX_BODY = 2048;
/** Stripe events are small; anything past this is not one. */
const MAX_WEBHOOK_BYTES = 512 * 1024;
/** Checkout and portal sessions per account per UTC day. */
export const SESSIONS_PER_DAY = 30;
const MIN_SECRET_LENGTH = 32;

interface Ctx {
  f: FetchLike;
  now: () => number;
  env: BillingEnv;
  redis: Redis;
  members: MemberStore;
  invites: InviteStore;
  app: AppTokens | null;
  stripe: BillingStripe;
  flags: BillingFlags;
  vatRegime: VatRegime;
  secret: string;
  localAdmins: LocalAdmins | null;
}

/** True when both Stripe keys are set. Their values are never read anywhere else than the Stripe client. */
export const keysSet = (env: BillingEnv): boolean => Boolean(env.STRIPE_SECRET_KEY?.trim() && env.STRIPE_WEBHOOK_SECRET?.trim());

function context(env: BillingEnv, deps: BillingDeps): Ctx | null {
  if (!keysSet(env)) return null;
  const now = deps.now ?? Date.now;
  const url = (env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL)?.trim();
  const token = (env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN)?.trim();
  const redis = deps.redis ?? (url && token ? redisRest(url, token, deps.fetch, STORAGE_DOWN) : null);
  if (!redis) return null;
  const appId = env.GITHUB_APP_ID?.trim();
  const pem = env.GITHUB_APP_PRIVATE_KEY?.trim();
  return {
    f: deps.fetch,
    now,
    env,
    redis,
    members: deps.members ?? memberStore(redis),
    invites: deps.invites ?? inviteStoreOn(redis, now),
    app: deps.app ?? (appId && pem ? githubApp(appId, pem, deps.fetch, now, { userAgent: 'bridge-billing' }) : null),
    stripe: deps.stripe ?? stripeClient(env.STRIPE_SECRET_KEY!.trim()),
    flags: flagsOf(deps.flags),
    vatRegime: deps.vatRegime ?? VAT_REGIME,
    secret: env.LIBRARY_SESSION_SECRET?.trim() ?? '',
    localAdmins: activeLocalAdmins(deps.localAdmins),
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Who asks

/** Studio's GitHub sign-in token (`Authorization: Bearer`), as api/_lib/team-caller.ts bearerOf reads it (not imported:
 *  it would bundle api/contribute here). Never logged, never kept. */
function bearerOf(req: Request): string | null {
  const m = /^Bearer\s+([A-Za-z0-9_.-]{20,255})$/i.exec(req.headers.get('authorization') ?? '')?.[1];
  return m ?? null;
}

/** An admin of the team, and who they are: a Bridge account (email), or a GitHub sign-in (no email kept). */
interface Admin {
  team: TeamRef;
  /** The Bridge account's address; null for a GitHub sign-in (Checkout then asks for the billing email). */
  email: string | null;
  /** Counts the daily cap: the account's address, or `gh:<GitHub user id>`. */
  who: string;
}

const ghHeaders = (token: string) => ({ Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'bridge-billing', 'X-GitHub-Api-Version': '2022-11-28' });

async function ghGet(ctx: Ctx, token: string, path: string): Promise<{ status: number; data: any }> {
  let res: Response;
  try {
    res = await ctx.f(`https://api.github.com${path}`, { method: 'GET', headers: ghHeaders(token) });
  } catch {
    throw new HttpError(502, 'unreachable', GITHUB_DOWN);
  }
  if (res.status >= 500) throw new HttpError(502, 'unreachable', GITHUB_DOWN);
  return { status: res.status, data: await res.json().catch(() => null) };
}

/** The account (cookie) is an admin of the team: an email admin, a seeded local admin, or its linked GitHub account. */
async function accountIsAdmin(ctx: Ctx, a: Account, t: TeamRef): Promise<boolean> {
  if (ctx.localAdmins && (await ctx.localAdmins.isAdmin(t.full, a.email))) return true;
  if ((await ctx.members.get(t.full, a.email))?.role === 'admin') return true;
  if (t.id || !a.github || !ctx.app) return false;
  const token = await ctx.app.installationToken(t.owner, t.repo);
  if (!token) return false;
  const r = await ghGet(ctx, token, `/repos/${t.owner}/${t.repo}/collaborators/${encodeURIComponent(a.github.login)}/permission`);
  return r.status === 200 && r.data?.permission === 'admin' && r.data?.user?.id === a.github.id;
}

/**
 * Studio's GitHub sign-in (`Authorization: Bearer`, scripts/github-session.ts): the token's own user, read from GitHub
 * (GET /user), must be an admin of the repository (GET /repos with that same token: permissions.admin). Nothing the
 * browser says about who it is counts; the token is never logged or kept. Repository teams only.
 */
async function githubAdmin(ctx: Ctx, token: string, t: TeamRef): Promise<Admin> {
  if (t.id) throw new HttpError(403, 'forbidden', ADMIN_ONLY);
  const me = await ghGet(ctx, token, '/user');
  if (me.status === 401 || me.status === 403 || !Number.isSafeInteger(me.data?.id)) throw new HttpError(401, 'signin', GITHUB_EXPIRED);
  const repo = await ghGet(ctx, token, `/repos/${t.owner}/${t.repo}`);
  if (repo.status === 401) throw new HttpError(401, 'signin', GITHUB_EXPIRED);
  if (repo.status !== 200 || repo.data?.permissions?.admin !== true) throw new HttpError(403, 'forbidden', ADMIN_ONLY);
  return { team: t, email: null, who: `gh:${me.data.id}` };
}

/**
 * Who asks, an admin of the team, or 401/403: the Bridge account cookie first (email admins, and an account with
 * GitHub linked), else the Studio GitHub sign-in for a repository's team. A team made in Bridge: the account only.
 */
async function requireAdmin(ctx: Ctx, req: Request, teamArg: unknown): Promise<Admin> {
  const t = await resolveTeam(ctx.redis, teamArg);
  const a = ctx.secret.length >= MIN_SECRET_LENGTH ? await sessionAccount(req, ctx.redis, ctx.secret, ctx.now()) : null;
  if (a && (await accountIsAdmin(ctx, a, t))) return { team: t, email: shownEmail(a), who: canonicalEmail(a.email) };
  const bearer = bearerOf(req);
  if (bearer && !t.id) return githubAdmin(ctx, bearer, t);
  if (!a) throw new HttpError(401, 'signin', SIGNIN);
  throw new HttpError(403, 'forbidden', ADMIN_ONLY);
}

function requireCsrf(req: Request): void {
  const header = req.headers.get('x-bridge-account') === '1' || req.headers.get('x-bridge-contribute') === '1';
  if (!header || !sameOrigin(req)) throw new HttpError(403, 'origin', 'Continue from Bridge on this site.');
}

async function dailyCap(ctx: Ctx, who: string): Promise<void> {
  const key = `bridge:billing:count:${who}:${dayOf(ctx.now())}`;
  const [n] = await ctx.redis.pipe([
    ['INCRBY', key, 1],
    ['EXPIRE', key, 2 * 24 * 60 * 60],
  ]);
  if (Number(n) > SESSIONS_PER_DAY) throw new HttpError(429, 'limit', 'You opened billing many times today. Try again tomorrow.', {}, { 'Retry-After': String(secondsToTomorrow(ctx.now())) });
}

// ---------------------------------------------------------------------------------------------------------------
// Pieces

/** Where Stripe sends the admin back: the team's Settings (a team made in Bridge: its workspace Settings). */
export function settingsPath(t: TeamRef): string {
  if (t.id) return `${STUDIO_ROOT}workspace/settings/?team=${encodeURIComponent(t.id)}`;
  return `${STUDIO_ROOT}${encodeURIComponent(t.owner)}/${encodeURIComponent(t.repo)}/settings/`;
}

const withQuery = (path: string, q: string) => `${path}${path.includes('?') ? '&' : '?'}${q}`;

async function editorsNow(ctx: Ctx, team: string): Promise<number> {
  const [members, invites] = await Promise.all([ctx.members.list(team), ctx.invites.list(team)]);
  const now = ctx.now();
  return editorsOf(members, invites.filter((i) => Date.parse(i.expiresAt) > now));
}

async function teamName(ctx: Ctx, team: string): Promise<string> {
  try {
    return teamDisplayName(team, { name: (await getTeamNames(ctx.redis, [team])).get(team)?.name });
  } catch {
    return teamDisplayName(team);
  }
}

async function stripeCall<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) throw e;
    // Stripe's own message may name ids; the type is enough to find the cause in the logs.
    console.error(`billing: stripe ${(e as { type?: string })?.type ?? 'error'}`);
    throw new HttpError(502, 'stripe', STRIPE_DOWN);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Actions

async function onStatus(ctx: Ctx, req: Request, teamArg: string): Promise<Response> {
  const { team: t } = await requireAdmin(ctx, req, teamArg);
  const [b, founding, editors] = await Promise.all([getBilling(ctx.redis, t.full), isFounding(ctx.redis, t.full, ctx.flags), editorsNow(ctx, t.full)]);
  const status: BillingStatus = {
    on: true,
    tier: founding ? 'free' : effectiveTier(b),
    founding,
    status: b?.status ?? null,
    periodEnd: b?.periodEnd ?? null,
    cancelAtPeriodEnd: b?.cancelAtPeriodEnd ?? false,
    currency: b?.currency ?? null,
    interval: b?.interval ?? null,
    quantity: b?.quantity ?? null,
    editors,
    checkoutQuantity: checkoutQuantity(editors, 1),
    canManage: Boolean(b?.customerId),
  };
  // A founding team that also pays (set up by hand) shows what it pays for.
  if (founding && b && effectiveTier(b) !== 'free') status.tier = effectiveTier(b);
  return json(200, status, { 'Cache-Control': 'private, no-store' });
}

async function onCheckout(ctx: Ctx, req: Request, body: Record<string, unknown>): Promise<Response> {
  if (!isCurrency(body.currency)) return fail(400, 'bad_request', 'Pick a currency: EUR or USD.');
  if (!isInterval(body.interval)) return fail(400, 'bad_request', 'Pick how to pay: yearly or monthly.');
  const a = await requireAdmin(ctx, req, body.team);
  const t = a.team;
  if (!billingOn(ctx.flags, t.full)) return fail(503, 'billing_off', BILLING_OFF);
  if (await isFounding(ctx.redis, t.full, ctx.flags)) return fail(409, 'founding', FOUNDING);
  const prev = await getBilling(ctx.redis, t.full);
  if (effectiveTier(prev) !== 'free') return fail(409, 'already', ALREADY_PAYING);
  await dailyCap(ctx, a.who);
  const price = await stripeCall(() => ctx.stripe.priceIdByLookupKey(lookupKey('team', body.currency as 'eur', body.interval as 'yearly')));
  if (!price) {
    console.error('billing: a Team price is missing from the catalog (scripts/stripe-catalog.mjs)');
    return fail(503, 'billing_off', BILLING_OFF);
  }
  const quantity = checkoutQuantity(await editorsNow(ctx, t.full), 1);
  // VAT (src/lib/billing.ts VAT_REGIME): under the franchise no tax is computed and every invoice carries the footer.
  const tax = taxSetup(ctx.vatRegime);
  // One customer per team, made once: a lock keeps two tabs from making two.
  let customerId = prev?.customerId ?? null;
  if (!customerId) {
    const lock = `bridge:billing:lock:${t.full}`;
    if ((await ctx.redis.cmd('SET', lock, '1', 'EX', 30, 'NX')) !== 'OK') return fail(409, 'busy', BUSY);
    try {
      const again = await getBilling(ctx.redis, t.full);
      customerId = again?.customerId ?? null;
      if (!customerId) {
        const made = await stripeCall(async () =>
          ctx.stripe.createCustomer({ name: await teamName(ctx, t.full), ...(a.email ? { email: a.email } : {}), metadata: { bridge_team: t.full }, ...(tax.footer ? { invoice_settings: { footer: tax.footer } } : {}) }),
        );
        customerId = made.id;
        await putBilling(ctx.redis, t.full, { ...(again ?? emptyBilling(ctx.now())), customerId, updatedAt: new Date(ctx.now()).toISOString() });
      }
    } finally {
      await ctx.redis.cmd('DEL', lock);
    }
  }
  const back = `${siteOrigin(req, ctx.env.PUBLIC_SITE_URL)}${settingsPath(t)}`;
  const session = await stripeCall(() =>
    ctx.stripe.createCheckoutSession({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: t.full,
      metadata: { bridge_team: t.full },
      subscription_data: { metadata: { bridge_team: t.full }, ...(tax.footer ? { invoice_settings: { footer: tax.footer } } : {}) },
      line_items: [{ price, quantity }],
      automatic_tax: { enabled: tax.automaticTax },
      // A VAT number on the invoice, whatever the regime (some customers need it there).
      tax_id_collection: { enabled: true },
      // A promotion code field: the open source and teaching offer (free Team, on request) and one-off codes made in
      // the Stripe Dashboard. No code exists by default, so nothing changes for anyone else.
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      // The customer exists already: Checkout keeps the address and name it collects on it (needed for tax).
      customer_update: { address: 'auto', name: 'auto' },
      success_url: `${withQuery(back, 'billing=done')}#billing`,
      cancel_url: `${back}#billing`,
    }),
  );
  if (!session.url) return fail(502, 'stripe', STRIPE_DOWN);
  return json(200, { url: session.url, quantity });
}

async function onPortal(ctx: Ctx, req: Request, body: Record<string, unknown>): Promise<Response> {
  const a = await requireAdmin(ctx, req, body.team);
  const t = a.team;
  if (!billingOn(ctx.flags, t.full)) return fail(503, 'billing_off', BILLING_OFF);
  const b = await getBilling(ctx.redis, t.full);
  if (!b?.customerId) return fail(409, 'no_customer', NO_CUSTOMER);
  await dailyCap(ctx, a.who);
  const configuration = await stripeCall(() => ctx.stripe.portalConfigurationId());
  const back = `${siteOrigin(req, ctx.env.PUBLIC_SITE_URL)}${settingsPath(t)}#billing`;
  const session = await stripeCall(() => ctx.stripe.createPortalSession({ customer: b.customerId!, return_url: back, ...(configuration ? { configuration } : {}) }));
  return json(200, { url: session.url });
}

/** One Stripe event: the subscription it is about, read again from Stripe, written on its team. */
async function applyEvent(ctx: Ctx, type: string, obj: Record<string, any>): Promise<boolean> {
  const now = ctx.now();
  const sync = async (subId: unknown, fallback?: Record<string, any>) => {
    if (typeof subId !== 'string' || !subId) return false;
    const sub = (await ctx.stripe.retrieveSubscription(subId)) ?? (fallback as any) ?? null;
    if (!sub) return false;
    return (await syncSubscription(ctx.redis, sub, now)) !== null;
  };
  switch (type) {
    case 'checkout.session.completed': {
      if (obj.mode !== 'subscription') return false;
      const team = typeof obj.client_reference_id === 'string' ? obj.client_reference_id : obj.metadata?.bridge_team;
      const customer = typeof obj.customer === 'string' ? obj.customer : obj.customer?.id;
      if (typeof team === 'string' && team && typeof customer === 'string') {
        const prev = await getBilling(ctx.redis, team);
        if (prev?.customerId !== customer) await putBilling(ctx.redis, team, { ...(prev ?? emptyBilling(now)), customerId: customer, updatedAt: new Date(now).toISOString() });
      }
      return sync(typeof obj.subscription === 'string' ? obj.subscription : obj.subscription?.id);
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      return sync(obj.id, obj);
    case 'invoice.paid':
    case 'invoice.payment_failed':
      return sync(subscriptionOfInvoice(obj));
    default:
      return false;
  }
}

async function onWebhook(ctx: Ctx, req: Request): Promise<Response> {
  const signature = req.headers.get('stripe-signature');
  if (!signature) return fail(400, 'signature', 'Missing signature.');
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > MAX_WEBHOOK_BYTES) return fail(413, 'too_large', 'Request too large.');
  // The raw body, exactly as Stripe signed it: never parsed before the check.
  const raw = await req.text();
  if (raw.length > MAX_WEBHOOK_BYTES) return fail(413, 'too_large', 'Request too large.');
  let event;
  try {
    event = await ctx.stripe.constructEvent(raw, signature, ctx.env.STRIPE_WEBHOOK_SECRET!.trim());
  } catch {
    return fail(400, 'signature', 'The signature does not match.');
  }
  // Each event once: Stripe sends again until it gets a 2xx, and may send the same event twice.
  const first = (await ctx.redis.cmd('SET', eventKey(event.id), '1', 'EX', EVENT_TTL_S, 'NX')) === 'OK';
  if (!first) return json(200, { received: true, duplicate: true });
  try {
    const applied = await applyEvent(ctx, event.type, event.data?.object ?? {});
    return json(200, { received: true, applied });
  } catch (e) {
    // Not handled: forget it so Stripe's next try runs it.
    await ctx.redis.cmd('DEL', eventKey(event.id)).catch(() => undefined);
    console.error(`billing: webhook ${event.type} failed (${e instanceof HttpError ? e.code : 'error'})`);
    return fail(500, 'retry', 'Not handled. Stripe sends it again.');
  }
}

/** The action of a call: `?action=` (vercel.json rewrites /api/billing/<action> to it), else the path's last part. */
export function actionOf(req: Request): string | null {
  const u = new URL(req.url);
  const q = u.searchParams.get('action');
  if (q) return q;
  const m = /\/api\/billing\/([a-z]+)\/?$/.exec(u.pathname);
  return m ? m[1]! : null;
}

export async function handleBilling(req: Request, env: BillingEnv, deps: BillingDeps): Promise<Response> {
  try {
    const method = req.method.toUpperCase();
    const action = actionOf(req);
    const flags = flagsOf(deps.flags);
    if (method === 'GET') {
      const team = new URL(req.url).searchParams.get('team');
      if (team === null) return json(200, { billing: flags.launched && keysSet(env) ? 'on' : 'off' });
      // Per team: { on: false } (the card shows nothing) unless billing is on for this very team (launched, or one of
      // BILLING_TEST_TEAMS) and the keys are set. Nothing is read while billing is on for no team at all.
      const ctx = flags.launched || flags.testTeams.length ? context(env, deps) : null;
      if (!ctx) return json(200, { on: false }, { 'Cache-Control': 'private, no-store' });
      const t = await resolveTeam(ctx.redis, team);
      if (!billingOn(ctx.flags, t.full)) return json(200, { on: false }, { 'Cache-Control': 'private, no-store' });
      return await onStatus(ctx, req, t.full);
    }
    if (method !== 'POST') return json(405, { error: 'method', message: 'Use GET or POST.' }, { Allow: 'GET, POST' });
    if (action === 'webhook') {
      const ctx = context(env, deps);
      if (!ctx) return fail(503, 'billing_off', BILLING_OFF);
      return await onWebhook(ctx, req);
    }
    requireCsrf(req);
    const ctx = flags.launched || flags.testTeams.length ? context(env, deps) : null;
    if (!ctx) return fail(503, 'billing_off', BILLING_OFF);
    if (!/^application\/json\b/i.test(req.headers.get('content-type') ?? '')) return fail(415, 'content_type', 'Send JSON.');
    const body = await readBody(req, MAX_BODY);
    const which = action ?? (typeof body.action === 'string' ? body.action : null);
    if (which === 'checkout') return await onCheckout(ctx, req, body);
    if (which === 'portal') return await onPortal(ctx, req, body);
    return fail(400, 'bad_request', 'Unknown action.');
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.code, message: e.message, ...e.extra }, e.headers);
    return fail(502, 'unreachable', STRIPE_DOWN);
  }
}

const envFromProcess = (): BillingEnv => ({
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  KV_REST_API_URL: process.env.KV_REST_API_URL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  LIBRARY_SESSION_SECRET: process.env.LIBRARY_SESSION_SECRET,
  GITHUB_APP_ID: process.env.GITHUB_APP_ID,
  GITHUB_APP_PRIVATE_KEY: process.env.GITHUB_APP_PRIVATE_KEY,
  PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL,
});

const realFetch: FetchLike = meteredFromEnv();
const handle = (request: Request) => handleBilling(request, envFromProcess(), { fetch: realFetch });

/** Vercel Functions entries (Web standard signature). */
export const GET = handle;
export const POST = handle;

