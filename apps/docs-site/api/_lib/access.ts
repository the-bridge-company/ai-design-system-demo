// Access requests (api/access): where they are kept and the two emails they send. Pure but for the email layout.
//
// Storage (Upstash Redis):
//   bridge:access:request:<email>   JSON AccessRequest, the email lowercased and trimmed. `at` is the first request's
//                                   time and never changes: sending again updates the other fields only.
//   bridge:access:queue             sorted set, score = ms of `at`, member = the email: the founder's queue, oldest first.
//   bridge:access:link:<sha256>     JSON AccessLink: an invite link for prospects (/signin/?access=<token>). Only the
//                                   token's hash is kept; the record expires ACCESS_LINK_KEPT_MS after the link does.
//   bridge:access:linkuse:<sha256>  counter of the link's uses, bumped atomically before an account is made with it.
//   bridge:access:links             sorted set, score = ms of `createdAt`, member = the hash: the founder's list.
// All of them are in the daily backup (api/account EXPORT_PATTERNS).
//
// The gate (BRIDGE_ACCESS_GATE=on, api/account): a new account is made only for an email that is approved here
// (status 'invited', ACCESS_APPROVAL_MS from approvedAt), with a live access link, with a team invite or membership or a
// team open to its work domain, or for an address of BRIDGE_ADMIN_EMAILS. Existing accounts always sign in.

import { randomBytes } from 'node:crypto';
import { escHtml, mailButton, mailLink, mailP, mailPage, mailQuote, type EmailMessage } from './email.js';
import { b64url, sha256 } from './http.js';
import type { Redis } from './redis.js';
import { canonicalEmail, emailSpellings } from './canonical-email.js';
import { accessDay, ACCESS_APPROVAL_MS, linkStateOf, oneLine, type AccessLinkState, type AccessRequestInput } from '../../src/lib/access-request.js';

export const ACCESS_QUEUE_KEY = 'bridge:access:queue';
export const accessRequestKey = (email: string) => `bridge:access:request:${email.trim().toLowerCase()}`;

export const ACCESS_LINKS_KEY = 'bridge:access:links';
export const accessLinkKey = (hash: string) => `bridge:access:link:${hash}`;
export const accessLinkUseKey = (hash: string) => `bridge:access:linkuse:${hash}`;
/** How long a link's record stays after it expired, so the founder's list still shows it. */
export const ACCESS_LINK_KEPT_MS = 30 * 24 * 60 * 60 * 1000;
/** The token of an access link: 32 random bytes, base64url. */
export const ACCESS_LINK_TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** pending: waits for the founder. invited: approved (approvedAt). declined: "Not yet" (note). */
export type AccessStatus = 'pending' | 'invited' | 'declined';

export interface AccessRequest extends AccessRequestInput {
  /** ISO time of the first request. */
  at: string;
  status: AccessStatus | string;
  /** ISO time the founder invited this email (or it signed up through an access link). */
  approvedAt?: string;
  /** 'link' when an access link approved it. */
  approvedVia?: 'queue' | 'link';
  /** ISO time of "Not yet", and the note sent with it. */
  declinedAt?: string;
  note?: string;
}

export interface AccessLink {
  label: string;
  /** The creating founder's name (shown to the prospect: "<name> invited you to Bridge"). Never an email. */
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  maxUses: number;
  uses: number;
  /** The emails that made an account with it, in order. Never leaves the founder's queue. */
  usedBy: string[];
}

export function parseAccessLink(raw: unknown): AccessLink | null {
  if (typeof raw !== 'string') return null;
  try {
    const v = JSON.parse(raw) as Partial<AccessLink>;
    if (typeof v.label !== 'string' || typeof v.createdAt !== 'string' || typeof v.expiresAt !== 'string' || Number.isNaN(Date.parse(v.expiresAt))) return null;
    const maxUses = Number.isSafeInteger(v.maxUses) && v.maxUses! > 0 ? v.maxUses! : 1;
    return {
      label: v.label,
      createdBy: typeof v.createdBy === 'string' ? v.createdBy : '',
      createdAt: v.createdAt,
      expiresAt: v.expiresAt,
      maxUses,
      uses: Number.isSafeInteger(v.uses) && v.uses! >= 0 ? v.uses! : 0,
      usedBy: Array.isArray(v.usedBy) ? v.usedBy.filter((e): e is string => typeof e === 'string') : [],
    };
  } catch {
    return null;
  }
}

/** A new access link token and its hash (the only part kept). */
export function newAccessLinkToken(random: (n: number) => Uint8Array = (n) => randomBytes(n)): { token: string; hash: string } {
  const token = b64url(Buffer.from(random(32)));
  return { token, hash: sha256(token) };
}

/** The link a token opens, with its state; null for a token Bridge never knew (or a malformed one). */
export async function readAccessLink(redis: Redis, token: unknown, now: number): Promise<{ hash: string; link: AccessLink; state: AccessLinkState } | null> {
  if (typeof token !== 'string' || !ACCESS_LINK_TOKEN.test(token)) return null;
  const hash = sha256(token);
  const link = parseAccessLink(await redis.cmd('GET', accessLinkKey(hash)));
  return link ? { hash, link, state: linkStateOf(link, now) } : null;
}

/**
 * Takes one use of a live link for `email` (atomic on its counter): true when the account may be made with it. The
 * record then says one more use, by whom.
 */
export async function consumeAccessLink(redis: Redis, token: unknown, email: string, now: number): Promise<boolean> {
  const read = await readAccessLink(redis, token, now);
  if (!read || read.state !== 'valid') return false;
  const { hash, link } = read;
  const ttl = Math.max(1, Math.ceil((Date.parse(link.expiresAt) + ACCESS_LINK_KEPT_MS - now) / 1000));
  const [n] = await redis.pipe([['INCRBY', accessLinkUseKey(hash), 1], ['EXPIRE', accessLinkUseKey(hash), ttl]]);
  if (Number(n) > link.maxUses) {
    await redis.cmd('INCRBY', accessLinkUseKey(hash), -1);
    return false;
  }
  const next: AccessLink = { ...link, uses: Math.max(link.uses + 1, Number(n)), usedBy: [...link.usedBy, email] };
  await redis.cmd('SET', accessLinkKey(hash), JSON.stringify(next), 'EX', ttl);
  return true;
}

/** The access request of an email under any of its spellings, with the key it sits under. */
export async function findAccessRequest(redis: Redis, email: string): Promise<{ key: string; request: AccessRequest } | null> {
  for (const e of new Set([...emailSpellings(email), canonicalEmail(email)])) {
    const key = accessRequestKey(e);
    const request = parseAccessRequest(await redis.cmd('GET', key));
    if (request) return { key, request };
  }
  return null;
}

/** True when the founder invited this email and the approval has not run out (ACCESS_APPROVAL_MS). */
export function approvalLive(r: AccessRequest | null | undefined, now: number): boolean {
  if (!r || r.status !== 'invited' || !r.approvedAt) return false;
  const at = Date.parse(r.approvedAt);
  return !Number.isNaN(at) && now - at < ACCESS_APPROVAL_MS;
}

/** An email that made its account with an access link: its request (when it sent one) reads approved. */
export async function markApprovedByLink(redis: Redis, email: string, now: number): Promise<void> {
  const found = await findAccessRequest(redis, email);
  if (!found || found.request.status === 'invited') return;
  const next: AccessRequest = { ...found.request, status: 'invited', approvedAt: new Date(now).toISOString(), approvedVia: 'link' };
  await redis.cmd('SET', found.key, JSON.stringify(next));
}

/** A stored request, or null when the value is not one. */
export function parseAccessRequest(raw: unknown): AccessRequest | null {
  if (typeof raw !== 'string') return null;
  try {
    const v = JSON.parse(raw) as Partial<AccessRequest>;
    if (typeof v.email !== 'string' || typeof v.at !== 'string' || Number.isNaN(Date.parse(v.at))) return null;
    return {
      email: v.email,
      company: String(v.company ?? ''),
      where: String(v.where ?? ''),
      fix: String(v.fix ?? ''),
      at: v.at,
      status: typeof v.status === 'string' ? v.status : 'pending',
      ...(typeof v.approvedAt === 'string' ? { approvedAt: v.approvedAt } : {}),
      ...(v.approvedVia === 'link' || v.approvedVia === 'queue' ? { approvedVia: v.approvedVia } : {}),
      ...(typeof v.declinedAt === 'string' ? { declinedAt: v.declinedAt } : {}),
      ...(typeof v.note === 'string' && v.note ? { note: v.note } : {}),
    };
  } catch {
    return null;
  }
}

/** BRIDGE_ADMIN_EMAILS: the people told of each request, comma separated. Anything that is not an address is dropped. */
export function adminEmails(v: string | undefined): string[] {
  return [
    ...new Set(
      (v ?? '')
        .split(',')
        .map((s) => oneLine(s).toLowerCase())
        .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)),
    ),
  ];
}

/** BRIDGE_ACCESS_GATE: "on" turns the gate on (read per request). Anything else, or unset: off. */
export const accessGateOn = (v: string | undefined): boolean => (v ?? '').trim().toLowerCase() === 'on';

/** True for an address of BRIDGE_ADMIN_EMAILS (any spelling of the same mailbox). */
export const isAdminEmail = (env: string | undefined, email: string): boolean => adminEmails(env).some((a) => canonicalEmail(a) === canonicalEmail(email));

/** "You're in": the founder invited this email. One button, to sign in with this very address. */
export function accessInvitedEmail(x: { to: string; signIn: string; replyTo?: string }): EmailMessage {
  const subject = 'Your Bridge access is open';
  const line = 'Use this email to sign in. Your access stays open for 30 days.';
  const text = ["You're in. Bridge is ready for your design system.", '', `Sign in to Bridge: ${x.signIn}`, '', line, '', 'Reply to this email if you have a question.'].join('\n');
  const html = mailPage({
    subject,
    preheader: line,
    body: [mailP(escHtml("You're in. Bridge is ready for your design system.")), mailP(escHtml(line), true), mailButton(x.signIn, 'Sign in to Bridge')].join('\n'),
    footer: 'Reply to this email if you have a question.',
  });
  return { to: x.to, subject, text, html, ...(x.replyTo ? { replyTo: x.replyTo } : {}) };
}

/** "Not yet": honest, with the founder's note when there is one, and the demo. */
export function accessNotYetEmail(x: { to: string; note: string; demo: string; replyTo?: string }): EmailMessage {
  const subject = 'Your Bridge request: not yet';
  const note = x.note.trim();
  const end = "We'll write again when Bridge opens wider. The demo stays open.";
  const text = ['Not yet. Thanks for asking: we open Bridge to a few teams at a time.', ...(note ? ['', note] : []), '', end, x.demo, '', 'Reply to this email if you have a question.'].join('\n');
  const html = mailPage({
    subject,
    preheader: end,
    body: [
      mailP('Not yet. Thanks for asking: we open Bridge to a few teams at a time.'),
      ...(note ? [mailQuote(note)] : []),
      mailP(`${escHtml("We'll write again when Bridge opens wider.")} ${mailLink(x.demo, 'The demo stays open')}.`, true),
    ].join('\n'),
    footer: 'Reply to this email if you have a question.',
  });
  return { to: x.to, subject, text, html, ...(x.replyTo ? { replyTo: x.replyTo } : {}) };
}

/** To the person who asked: it is in, when we answer, the demo meanwhile. */
export function accessConfirmationEmail(x: { to: string; demo: string; replyTo?: string }): EmailMessage {
  const subject = 'Your Bridge request is in';
  const text = [
    'Thanks. We read every request and reply within 2 working days.',
    '',
    `Until then, the demo is open: ${x.demo}`,
    '',
    'Reply to this email if you have a question.',
  ].join('\n');
  const html = mailPage({
    subject,
    preheader: 'We read every request and reply within 2 working days.',
    body: [mailP('Thanks. We read every request and reply within 2 working days.'), mailP(`Until then, the demo is open: ${mailLink(x.demo, 'open the demo')}.`, true)].join('\n'),
    footer: 'Reply to this email if you have a question.',
  });
  return { to: x.to, subject, text, html, ...(x.replyTo ? { replyTo: x.replyTo } : {}) };
}

/** To the founder: who asked, for which company, what they want to fix. Every field escaped, the subject one line. */
export function accessNoticeEmail(x: { to: string; request: AccessRequest; again: boolean }): EmailMessage {
  const r = x.request;
  const company = oneLine(r.company).slice(0, 120);
  const subject = `${x.again ? 'Access request updated' : 'Access request'}: ${company}`;
  const when = accessDay(r.at);
  const text = [
    `${r.email} from ${company} asked for access to Bridge${x.again ? ' again (the first request stays the one that counts)' : ''}.`,
    '',
    `Design system: ${r.where || 'not given'}`,
    `First request: ${when}`,
    '',
    'What they want to fix first:',
    r.fix,
    '',
    'Reply to this email to answer them.',
  ].join('\n');
  const html = mailPage({
    subject,
    preheader: `${r.email} from ${company}: ${r.fix}`,
    body: [
      mailP(`${escHtml(r.email)} from <strong>${escHtml(company)}</strong> asked for access to Bridge${x.again ? ' again (the first request stays the one that counts)' : ''}.`),
      mailP(`Design system: ${r.where ? mailLink(r.where, r.where) : 'not given'}`),
      mailP(`First request: ${escHtml(when)}`, true),
      mailQuote(r.fix),
    ].join('\n'),
    footer: 'Reply to this email to answer them.',
  });
  return { to: x.to, subject, text, html, replyTo: r.email };
}
