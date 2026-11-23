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
// Then the requester gets "Your Bridge request is in" (reply-to the contact address) and each address of
// BRIDGE_ADMIN_EMAILS a short notice with the request (none when unset). An email that fails never fails the request:
// it is stored first. Counters are keyed by an HMAC of the email or network, never in clear.
// Storage: api/_lib/access-request.ts. Env: KV_REST_API_URL + KV_REST_API_TOKEN (or the UPSTASH_ pair),
// LIBRARY_SESSION_SECRET, RESEND_API_KEY + INVITE_EMAIL_FROM, PUBLIC_SITE_URL, BRIDGE_ADMIN_EMAILS,
// ACCESS_MAX_PER_IP_DAY, ACCESS_MAX_PER_EMAIL_DAY, ACCESS_MAX_SITE_DAY (optional caps).

import { createHmac } from 'node:crypto';
import { ACCESS_QUEUE_KEY, accessConfirmationEmail, accessNoticeEmail, accessRequestKey, adminEmails, parseAccessRequest, type AccessRequest } from '../_lib/access.js';
import { resendSender, type EmailSender } from '../_lib/email.js';
import { clientIp, dayOf, envInt, fail, HttpError, json, readBody, sameOrigin, secondsToTomorrow, siteOrigin, type FetchLike } from '../_lib/http.js';
import { redisRest, type Redis } from '../_lib/redis.js';
import { ACCESS_DEMO, ACCESS_WORDS, checkAccessRequest } from '../../src/lib/access-request.js';
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
}

export interface AccessDeps {
  fetch: FetchLike;
  now?: () => number;
  redis?: Redis;
  email?: EmailSender;
  /** Where a failed email is said (never the address). */
  warn?: (msg: string) => void;
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

async function onRequest(req: Request, env: AccessEnv, deps: AccessDeps, redis: Redis, secret: string): Promise<Response> {
  if (!/^application\/json\b/i.test(req.headers.get('content-type') ?? '')) return fail(415, 'content_type', 'Send JSON.');
  const body = await readBody(req, MAX_BODY);
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
  const sender = deps.email ?? (env.RESEND_API_KEY?.trim() && env.INVITE_EMAIL_FROM?.trim() ? resendSender(env.RESEND_API_KEY.trim(), env.INVITE_EMAIL_FROM.trim(), deps.fetch) : null);
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

export async function handleAccess(req: Request, env: AccessEnv, deps: AccessDeps): Promise<Response> {
  try {
    if (req.method.toUpperCase() !== 'POST') return json(405, { error: 'method', message: 'Use POST.' }, { Allow: 'POST' });
    requireCsrf(req);
    const url = (env.KV_REST_API_URL ?? env.UPSTASH_REDIS_REST_URL)?.trim();
    const token = (env.KV_REST_API_TOKEN ?? env.UPSTASH_REDIS_REST_TOKEN)?.trim();
    const redis = deps.redis ?? (url && token ? redisRest(url, token, deps.fetch, STORAGE_DOWN) : null);
    const secret = env.LIBRARY_SESSION_SECRET?.trim() ?? '';
    if (!redis || secret.length < MIN_SECRET_LENGTH) return fail(503, 'not_configured', ACCESS_WORDS.unavailable);
    return await onRequest(req, env, deps, redis, secret);
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
});

const realFetch: FetchLike = (url, init) => fetch(url, init);
const handle = (request: Request) => handleAccess(request, envFromProcess(), { fetch: realFetch });

/** Vercel Functions entry (Web standard signature). */
export const POST = handle;
export const GET = handle;
