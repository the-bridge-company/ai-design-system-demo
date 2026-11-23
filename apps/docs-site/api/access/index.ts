// /api/access: "Request access" (pages/request.astro). Bridge opens on invitation: someone who wants Bridge on their
// own design system sends a request, the founder answers by hand within 2 working days (docs/HOSTED.md, "Access
// requests"). No account is made here.
//
//   POST { action: 'request', email, company, where?, fix }
//        { ok: true, at }                   a new request; `at` is when it was sent (ISO)
//        { ok: true, already: true, at }    this email had asked before: its fields are updated, `at` stays the first
//        400 invalid { fields: { email?, company?, where?, fix? } }   in the page's words (src/lib/access-request.ts)
//        429 limit (Retry-After)            per network 10, per email 3, for the site 200 a UTC day
//        503 not_configured | storage
// Every POST carries `X-Bridge-Account: 1`, JSON, and an Origin of this very site (CSRF), like /api/account.
//
// Access links (the gate, BRIDGE_ACCESS_GATE in api/account): a founder makes a link for a prospect they talked to.
//   GET  ?link=<token>                     public: { valid: true, label, inviter, expiresAt } or
//                                          { valid: false, reason: 'expired' | 'used' | 'unknown' }. Never an email.
//
// The founder's queue (/admin/access/). Each POST also needs the account cookie of an address of BRIDGE_ADMIN_EMAILS:
// 401 signin { signIn } without one, 403 not_admin for anyone else.
//   POST { action: 'list' }                { requests, links, waiting, week: { invited, cap } }: the requests waiting
//                                          first, then those with a design system link, then the oldest; the links
//                                          newest first. `week.invited` counts the founder's invites this ISO week
//                                          (UTC), `cap` is ACCESS_WEEKLY_CAP (default 5). Inviting over it works.
//   POST { action: 'invite', email }       status invited, approvedAt now (the gate lets this email make an account for
//                                          30 days); emails "Your Bridge access is open". { request, week }
//   POST { action: 'not-yet', email, note? }  status declined, the note kept; emails "Not yet" with the note. { request }
//   POST { action: 'create-link', label, maxUses?, days? }  maxUses 1 to 50 (1), days 1 to 90 (14).
//                                          { link, url }: the URL holds the token, shown this once.
//   POST { action: 'revoke-link', id }     the link stops working at once. { ok: true }
//
// Then the requester gets "Your Bridge request is in" (reply-to the contact address) and each address of
// BRIDGE_ADMIN_EMAILS a short notice with the request (none when unset). An email that fails never fails the request:
// it is stored first. Counters are keyed by an HMAC of the email or network, never in clear.
// Storage: api/_lib/access-request.ts. Env: KV_REST_API_URL + KV_REST_API_TOKEN (or the UPSTASH_ pair),
// LIBRARY_SESSION_SECRET, RESEND_API_KEY + INVITE_EMAIL_FROM, PUBLIC_SITE_URL, BRIDGE_ADMIN_EMAILS,
// ACCESS_MAX_PER_IP_DAY, ACCESS_MAX_PER_EMAIL_DAY, ACCESS_MAX_SITE_DAY (optional caps), ACCESS_WEEKLY_CAP.

import { createHmac } from 'node:crypto';
import {
  ACCESS_LINK_KEPT_MS,
  ACCESS_LINKS_KEY,
  ACCESS_QUEUE_KEY,
  accessConfirmationEmail,
  accessInvitedEmail,
  accessLinkKey,
  accessLinkUseKey,
  accessNoticeEmail,
  accessNotYetEmail,
  accessRequestKey,
  adminEmails,
  isAdminEmail,
  newAccessLinkToken,
  parseAccessLink,
  parseAccessRequest,
  readAccessLink,
  type AccessLink,
  type AccessRequest,
} from '../_lib/access.js';
import { sessionAccount, shownEmail } from '../_lib/account.js';
import { resendSender, type EmailSender } from '../_lib/email.js';
import { clientIp, dayOf, envInt, fail, HttpError, json, readBody, sameOrigin, secondsToTomorrow, siteOrigin, type FetchLike } from '../_lib/http.js';
import { redisRest, type Redis } from '../_lib/redis.js';
import {
  ACCESS_ADMIN_PAGE,
  ACCESS_DEMO,
  ACCESS_PARAM,
  ACCESS_WEEKLY_CAP,
  ACCESS_WORDS,
  ADMIN_WORDS,
  SIGNIN_PATH as SIGNIN_PAGE,
  checkAccessRequest,
  invitedThisWeek,
  linkStateOf,
  oneLine,
  sortQueue,
  type AdminLink,
} from '../../src/lib/access-request.js';
import { CONTACT_EMAIL } from '../../src/lib/pricing.js';

export interface AccessEnv {
  KV_REST_API_URL?: string | undefined;
  KV_REST_API_TOKEN?: string | undefined;
  UPSTASH_REDIS_REST_URL?: string | undefined;
  UPSTASH_REDIS_REST_TOKEN?: string | undefined;
  LIBRARY_SESSION_SECRET?: string | undefined;
  RESEND_API_KEY?: string | undefined;
  INVITE_EMAIL_FROM?: string | undefined;
  PUBLIC_SITE_URL?: string | undefined;
  /** Who is told of each request, comma separated. Unset: nobody (the queue still holds it). */
  BRIDGE_ADMIN_EMAILS?: string | undefined;
  ACCESS_MAX_PER_IP_DAY?: string | undefined;
  ACCESS_MAX_PER_EMAIL_DAY?: string | undefined;
  ACCESS_MAX_SITE_DAY?: string | undefined;
  /** Invites the founder means to send per ISO week (default 5). Over it, Invite still works, with a warning. */
  ACCESS_WEEKLY_CAP?: string | undefined;
}

export interface AccessDeps {
  fetch: FetchLike;
  now?: () => number;
  redis?: Redis;
  email?: EmailSender;
  /** Where a failed email is said (never the address). */
  warn?: (msg: string) => void;
  /** Random bytes for link tokens (tests). */
  random?: (bytes: number) => Uint8Array;
}

/** Requests per UTC day. */
export const ACCESS_LIMITS_DAY = { ip: 10, email: 3, site: 200 } as const;
const MAX_BODY = 4096;
const COUNTER_TTL_S = 2 * 24 * 60 * 60;
const MIN_SECRET_LENGTH = 32;
const STORAGE_DOWN = 'Bridge could not save your request. Try again in a minute.';

const hmacHex = (secret: string, s: string) => createHmac('sha256', secret).update(s).digest('hex').slice(0, 32);
const countKey = (kind: string, who: string, day: string) => `bridge:access:count:${kind}:${who}:${day}`;

function requireCsrf(req: Request): void {
  if (req.headers.get('x-bridge-account') !== '1' || !sameOrigin(req)) throw new HttpError(403, 'origin', 'Send your request from the Request access page of this site.');
}

async function bumpOrRefuse(redis: Redis, now: number, keys: string[], limits: number[]): Promise<void> {
  const r = await redis.pipe(keys.flatMap((k) => [['INCRBY', k, 1], ['EXPIRE', k, COUNTER_TTL_S]]));
  if (keys.some((_, i) => Number(r[i * 2]) > limits[i]!)) {
    await redis.pipe(keys.map((k) => ['INCRBY', k, -1]));
    throw new HttpError(429, 'limit', ACCESS_WORDS.limited, {}, { 'Retry-After': String(secondsToTomorrow(now)) });
  }
}

function senderOf(env: AccessEnv, deps: AccessDeps): EmailSender | null {
  return deps.email ?? (env.RESEND_API_KEY?.trim() && env.INVITE_EMAIL_FROM?.trim() ? resendSender(env.RESEND_API_KEY.trim(), env.INVITE_EMAIL_FROM.trim(), deps.fetch) : null);
}

async function onRequest(req: Request, env: AccessEnv, deps: AccessDeps, redis: Redis, secret: string, body: Record<string, unknown>): Promise<Response> {
  if (body.action !== 'request') return fail(400, 'bad_request', 'Say which action, like request.');
  const checked = checkAccessRequest(body);
  if (!checked.ok) return fail(400, 'invalid', Object.values(checked.errors)[0]!, { fields: checked.errors });
  const input = checked.value;
  const now = (deps.now ?? Date.now)();
  const day = dayOf(now);
  const email = input.email.toLowerCase();
  await bumpOrRefuse(
    redis,
    now,
    [countKey('ip', hmacHex(secret, `ip:${clientIp(req)}`), day), countKey('email', hmacHex(secret, `email:${email}`), day), countKey('site', 'all', day)],
    [envInt(env.ACCESS_MAX_PER_IP_DAY, ACCESS_LIMITS_DAY.ip), envInt(env.ACCESS_MAX_PER_EMAIL_DAY, ACCESS_LIMITS_DAY.email), envInt(env.ACCESS_MAX_SITE_DAY, ACCESS_LIMITS_DAY.site)],
  );

  const key = accessRequestKey(email);
  const before = parseAccessRequest(await redis.cmd('GET', key));
  // The first request's time stays: it is when this team asked, whatever it changes later.
  const at = before?.at ?? new Date(now).toISOString();
  const request: AccessRequest = { ...input, at, status: before?.status ?? 'pending' };
  await redis.pipe([
    ['SET', key, JSON.stringify(request)],
    ['ZADD', ACCESS_QUEUE_KEY, 'NX', Date.parse(at), email],
  ]);

  // Stored: from here an email that fails is only logged.
  const warn = deps.warn ?? ((m: string) => console.warn(m));
  const sender = senderOf(env, deps);
  if (sender) {
    const demo = `${siteOrigin(req, env.PUBLIC_SITE_URL)}${ACCESS_DEMO}`;
    const mails = [accessConfirmationEmail({ to: input.email, demo, replyTo: CONTACT_EMAIL }), ...adminEmails(env.BRIDGE_ADMIN_EMAILS).map((to) => accessNoticeEmail({ to, request, again: Boolean(before) }))];
    const sent = await Promise.allSettled(mails.map((m) => sender.send(m)));
    sent.forEach((s, i) => {
      if (s.status === 'rejected') warn(`access: ${i === 0 ? 'confirmation' : 'notice'} email not sent (${s.reason instanceof Error ? s.reason.message : 'unknown'})`);
    });
  } else warn('access: RESEND_API_KEY or INVITE_EMAIL_FROM is not set, no email sent');

  return json(200, before ? { ok: true, already: true, at } : { ok: true, at });
}

// ---------------------------------------------------------------------------------------------------------------
// Access links, public side

async function onLinkInfo(redis: Redis, token: string | null, now: number): Promise<Response> {
  const read = await readAccessLink(redis, token, now);
  if (!read) return json(200, { valid: false, reason: 'unknown' });
  if (read.state !== 'valid') return json(200, { valid: false, reason: read.state });
  return json(200, { valid: true, label: read.link.label, inviter: read.link.createdBy || 'Florian', expiresAt: read.link.expiresAt });
}

// ---------------------------------------------------------------------------------------------------------------
// The founder's queue

const ADMIN_ACTIONS = new Set(['list', 'invite', 'not-yet', 'create-link', 'revoke-link']);
const LINK_LIMITS = { uses: [1, 50], days: [1, 90], label: 80, note: 600 } as const;
const DAY_MS = 24 * 60 * 60 * 1000;

const weeklyCap = (env: AccessEnv) => envInt(env.ACCESS_WEEKLY_CAP, ACCESS_WEEKLY_CAP);

async function allRequests(redis: Redis): Promise<AccessRequest[]> {
  const emails = await redis.cmd('ZRANGE', ACCESS_QUEUE_KEY, 0, -1);
  const list = Array.isArray(emails) ? emails.filter((e): e is string => typeof e === 'string') : [];
  if (!list.length) return [];
  const raw = await redis.pipe(list.map((e) => ['GET', accessRequestKey(e)]));
  return raw.map(parseAccessRequest).filter((r): r is AccessRequest => r !== null);
}

async function allLinks(redis: Redis, now: number): Promise<AdminLink[]> {
  const ids = await redis.cmd('ZRANGE', ACCESS_LINKS_KEY, 0, -1);
  const list = Array.isArray(ids) ? ids.filter((e): e is string => typeof e === 'string') : [];
  if (!list.length) return [];
  const raw = await redis.pipe(list.map((id) => ['GET', accessLinkKey(id)]));
  const out: AdminLink[] = [];
  const gone: string[] = [];
  raw.forEach((r, i) => {
    const l = parseAccessLink(r);
    if (!l) return void gone.push(list[i]!);
    out.push({ id: list[i]!, ...l, state: linkStateOf(l, now) });
  });
  // Records that expired on their own leave the list too.
  if (gone.length) await redis.cmd('ZREM', ACCESS_LINKS_KEY, ...gone);
  return out.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

const weekOf = (env: AccessEnv, list: AccessRequest[], now: number) => ({ invited: invitedThisWeek(list, now), cap: weeklyCap(env) });

async function onAdmin(req: Request, env: AccessEnv, deps: AccessDeps, redis: Redis, secret: string, body: Record<string, unknown>): Promise<Response> {
  const now = (deps.now ?? Date.now)();
  const signIn = `${SIGNIN_PAGE}?next=${encodeURIComponent(ACCESS_ADMIN_PAGE)}`;
  const me = await sessionAccount(req, redis, secret, now);
  if (!me) return fail(401, 'signin', ADMIN_WORDS.signInTitle, { signIn });
  if (!isAdminEmail(env.BRIDGE_ADMIN_EMAILS, me.email) && !isAdminEmail(env.BRIDGE_ADMIN_EMAILS, shownEmail(me))) return fail(403, 'not_admin', ADMIN_WORDS.notAdmin);
  const origin = siteOrigin(req, env.PUBLIC_SITE_URL);
  const warn = deps.warn ?? ((m: string) => console.warn(m));

  if (body.action === 'list') {
    const requests = await allRequests(redis);
    return json(200, { requests: sortQueue(requests), links: await allLinks(redis, now), waiting: requests.filter((r) => r.status === 'pending').length, week: weekOf(env, requests, now) });
  }

  if (body.action === 'invite' || body.action === 'not-yet') {
    const email = oneLine(body.email).toLowerCase();
    const key = accessRequestKey(email);
    const before = email ? parseAccessRequest(await redis.cmd('GET', key)) : null;
    if (!before) return fail(404, 'unknown', 'This request is no longer in the queue. Reload the page.');
    const sender = senderOf(env, deps);
    let request: AccessRequest;
    if (body.action === 'invite') {
      const { declinedAt: _d, note: _n, ...rest } = before;
      request = { ...rest, status: 'invited', approvedAt: new Date(now).toISOString(), approvedVia: 'queue' };
      await redis.cmd('SET', key, JSON.stringify(request));
      const mail = accessInvitedEmail({ to: before.email, signIn: `${origin}${SIGNIN_PAGE}?email=${encodeURIComponent(before.email)}`, replyTo: CONTACT_EMAIL });
      if (sender) await sender.send(mail).catch((e: unknown) => warn(`access: invited email not sent (${e instanceof Error ? e.message : 'unknown'})`));
      else warn('access: RESEND_API_KEY or INVITE_EMAIL_FROM is not set, no email sent');
      return json(200, { request, week: weekOf(env, await allRequests(redis), now) });
    }
    const note = typeof body.note === 'string' ? body.note.normalize('NFC').replace(/\r\n?/g, '\n').trim().slice(0, LINK_LIMITS.note) : '';
    const { approvedAt: _a, approvedVia: _v, ...rest } = before;
    request = { ...rest, status: 'declined', declinedAt: new Date(now).toISOString(), ...(note ? { note } : {}) };
    if (!note) delete request.note;
    await redis.cmd('SET', key, JSON.stringify(request));
    const mail = accessNotYetEmail({ to: before.email, note, demo: `${origin}${ACCESS_DEMO}`, replyTo: CONTACT_EMAIL });
    if (sender) await sender.send(mail).catch((e: unknown) => warn(`access: not-yet email not sent (${e instanceof Error ? e.message : 'unknown'})`));
    else warn('access: RESEND_API_KEY or INVITE_EMAIL_FROM is not set, no email sent');
    return json(200, { request });
  }

  if (body.action === 'create-link') {
    const label = oneLine(body.label).slice(0, LINK_LIMITS.label);
    if (!label) return fail(400, 'bad_label', ADMIN_WORDS.badLabel);
    const int = (v: unknown, d: number, [lo, hi]: readonly [number, number]) => {
      const n = v === undefined || v === null || v === '' ? d : Number(v);
      return Number.isInteger(n) && n >= lo && n <= hi ? n : null;
    };
    const maxUses = int(body.maxUses, 1, LINK_LIMITS.uses);
    const days = int(body.days, 14, LINK_LIMITS.days);
    if (maxUses === null) return fail(400, 'bad_uses', 'Uses go from 1 to 50.');
    if (days === null) return fail(400, 'bad_days', 'Days go from 1 to 90.');
    const { token, hash } = newAccessLinkToken(deps.random);
    const link: AccessLink = { label, createdBy: me.name.trim() || 'Florian', createdAt: new Date(now).toISOString(), expiresAt: new Date(now + days * DAY_MS).toISOString(), maxUses, uses: 0, usedBy: [] };
    const ttl = Math.ceil((days * DAY_MS + ACCESS_LINK_KEPT_MS) / 1000);
    await redis.pipe([
      ['SET', accessLinkKey(hash), JSON.stringify(link), 'EX', ttl],
      ['ZADD', ACCESS_LINKS_KEY, now, hash],
    ]);
    const shown: AdminLink = { id: hash, ...link, state: linkStateOf(link, now) };
    return json(200, { link: shown, url: `${origin}${SIGNIN_PAGE}?${ACCESS_PARAM}=${token}` });
  }

  // revoke-link
  const id = typeof body.id === 'string' && /^[a-f0-9]{64}$/.test(body.id) ? body.id : '';
  if (!id) return fail(400, 'bad_link', 'Say which link to revoke.');
  await redis.pipe([['DEL', accessLinkKey(id)], ['DEL', accessLinkUseKey(id)], ['ZREM', ACCESS_LINKS_KEY, id]]);
  return json(200, { ok: true });
}

export async function handleAccess(req: Request, env: AccessEnv, deps: AccessDeps): Promise<Response> {
  try {
    const method = req.method.toUpperCase();
    if (method !== 'POST' && method !== 'GET') return json(405, { error: 'method', message: 'Use GET or POST.' }, { Allow: 'GET, POST' });
    const linkQuery = method === 'GET' ? new URL(req.url).searchParams.get('link') : null;
    if (method === 'GET' && linkQuery === null) return json(405, { error: 'method', message: 'Use POST.' }, { Allow: 'GET, POST' });
    if (method === 'POST') requireCsrf(req);
    const url = (env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL)?.trim();
    const token = (env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN)?.trim();
    const redis = deps.redis ?? (url && token ? redisRest(url, token, deps.fetch, STORAGE_DOWN) : null);
    const secret = env.LIBRARY_SESSION_SECRET?.trim() ?? '';
    if (!redis || secret.length < MIN_SECRET_LENGTH) return fail(503, 'not_configured', ACCESS_WORDS.unavailable);
    if (method === 'GET') return await onLinkInfo(redis, linkQuery, (deps.now ?? Date.now)());
    if (!/^application\/json\b/i.test(req.headers.get('content-type') ?? '')) return fail(415, 'content_type', 'Send JSON.');
    const body = await readBody(req, MAX_BODY);
    if (typeof body.action === 'string' && ADMIN_ACTIONS.has(body.action)) return await onAdmin(req, env, deps, redis, secret, body);
    return await onRequest(req, env, deps, redis, secret, body);
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.code, message: e.message, ...e.extra }, e.headers);
    return fail(503, 'storage', STORAGE_DOWN);
  }
}

const envFromProcess = (): AccessEnv => ({
  KV_REST_API_URL: process.env.KV_REST_API_URL,
  KV_REST_API_TOKEN: process.env.KV_REST_API_TOKEN,
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
  LIBRARY_SESSION_SECRET: process.env.LIBRARY_SESSION_SECRET,
  RESEND_API_KEY: process.env.RESEND_API_KEY,
  INVITE_EMAIL_FROM: process.env.INVITE_EMAIL_FROM,
  PUBLIC_SITE_URL: process.env.PUBLIC_SITE_URL,
  BRIDGE_ADMIN_EMAILS: process.env.BRIDGE_ADMIN_EMAILS,
  ACCESS_MAX_PER_IP_DAY: process.env.ACCESS_MAX_PER_IP_DAY,
  ACCESS_MAX_PER_EMAIL_DAY: process.env.ACCESS_MAX_PER_EMAIL_DAY,
  ACCESS_MAX_SITE_DAY: process.env.ACCESS_MAX_SITE_DAY,
  ACCESS_WEEKLY_CAP: process.env.ACCESS_WEEKLY_CAP,
});

const realFetch: FetchLike = (url, init) => fetch(url, init);
const handle = (request: Request) => handleAccess(request, envFromProcess(), { fetch: realFetch });

/** Vercel Functions entry (Web standard signature). */
export const POST = handle;
export const GET = handle;
