// Access requests (api/access): where they are kept and the two emails they send. Pure but for the email layout.
//
// Storage (Upstash Redis):
//   bridge:access:request:<email>   JSON AccessRequest, the email lowercased and trimmed. `at` is the first request's
//                                   time and never changes: sending again updates the other fields only.
//   bridge:access:queue             sorted set, score = ms of `at`, member = the email: the founder's queue, oldest first.
// Both are in the daily backup (api/account EXPORT_PATTERNS).

import { escHtml, mailLink, mailP, mailPage, mailQuote, type EmailMessage } from './email.js';
import { accessDay, oneLine, type AccessRequestInput } from '../../src/lib/access-request.js';

export const ACCESS_QUEUE_KEY = 'bridge:access:queue';
export const accessRequestKey = (email: string) => `bridge:access:request:${email.trim().toLowerCase()}`;

export type AccessStatus = 'pending';

export interface AccessRequest extends AccessRequestInput {
  /** ISO time of the first request. */
  at: string;
  status: AccessStatus | string;
}

/** A stored request, or null when the value is not one. */
export function parseAccessRequest(raw: unknown): AccessRequest | null {
  if (typeof raw !== 'string') return null;
  try {
    const v = JSON.parse(raw) as Partial<AccessRequest>;
    if (typeof v.email !== 'string' || typeof v.at !== 'string' || Number.isNaN(Date.parse(v.at))) return null;
    return { email: v.email, company: String(v.company ?? ''), where: String(v.where ?? ''), fix: String(v.fix ?? ''), at: v.at, status: typeof v.status === 'string' ? v.status : 'pending' };
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
