// "Request access" (pages/request.astro, components/ds/account/RequestAccess.tsx, api/access): Bridge opens on
// invitation. The demo is open to everyone; a team that wants Bridge on its own design system sends a request, and the
// founder answers by hand within 2 working days. The words, the field rules (the page and the function check the same
// ones) and what this browser remembers of a request. Pure: no DOM, no Node, imported by api/access too.

import { SAMPLE_REPO } from './demo.js';
import { STUDIO_ROOT } from './team-path.js';

/** The request page (the landing, pricing and the demo lead here). */
export const REQUEST_PAGE = '/request/';
export const ACCESS_API = '/api/access';
/** The demo the page and the confirmation email point to: lib/nav DEMO. */
export const ACCESS_DEMO = `${STUDIO_ROOT}${SAMPLE_REPO}/`;
/** What this browser remembers of its request ({ email, at }), so a visitor who comes back sees where it stands. */
export const ACCESS_STORE_KEY = 'bridge:access-request';

export const ACCESS_LIMITS = { email: 254, company: 120, where: 300, fix: 300 } as const;

export const ACCESS_WORDS = {
  title: 'Request access to Bridge',
  lead: 'We read every request and reply within 2 working days.',
  emailLabel: 'Work email',
  emailPlaceholder: 'ana@acme.com',
  companyLabel: 'Company',
  whereLabel: 'Where your design system lives (optional)',
  whereHint: 'Repository, Storybook or docs link. Helps us review faster.',
  wherePlaceholder: 'https://',
  fixLabel: 'What do you want to fix first?',
  submit: 'Request access',
  haveAccess: 'Already have access?',
  signIn: 'Sign in',
  demoLead: 'Just looking? The demo is open to everyone.',
  demo: 'Open the demo',
  sentTitle: 'Request received.',
  /** "Sent on 23 November 2026. We reply to ana@acme.com within 2 working days, with an invite link." */
  sentLead: ['Sent on ', '. We reply to ', ' within 2 working days, with an invite link.'] as const,
  continueDemo: 'Continue the demo',
  wrongEmail: 'Wrong email?',
  change: 'Change my request',
  pendingTitle: 'Your request is waiting for review',
  /** "We reply to ana@acme.com within 2 working days." */
  pendingLead: ['We reply to ', ' within 2 working days.'] as const,
  steps: 'Your request',
  stepSent: 'Sent',
  stepReviewed: 'Reviewed',
  stepAccess: 'Access',
  stepReviewedMeta: 'Within 2 working days',
  stepAccessMeta: 'An invite link by email',
  badEmail: 'Enter a work email, like ana@acme.com.',
  badCompany: 'Add your company name.',
  badWhere: 'Enter a full link, starting with https://',
  badFix: 'Tell us in a few words what you want to fix first.',
  limited: 'You sent several requests today. Try again tomorrow.',
  offline: 'Bridge could not send your request. Check your connection, then select Request access again.',
  failed: 'Bridge could not save your request. Try again in a minute.',
  unavailable: 'Requests are not open on this site yet. Write to hello@bridgedesignsystem.com instead.',
  /** The landing's line under its two buttons. */
  heroNote: 'Access opens in small groups. We reply within 2 working days.',
} as const;

export type AccessField = 'email' | 'company' | 'where' | 'fix';
export type AccessErrors = Partial<Record<AccessField, string>>;

export interface AccessRequestInput {
  email: string;
  company: string;
  /** '' when not given. */
  where: string;
  fix: string;
}

/** The same rule as api/account (validEmail). */
const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,62}[A-Za-z0-9])?)+$/;

/** One line of text: control characters and runs of spaces become one space, trimmed. */
export const oneLine = (v: unknown): string => (typeof v === 'string' ? v.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim() : '');

export const isAccessEmail = (v: string): boolean => v.length <= ACCESS_LIMITS.email && EMAIL.test(v);

/** A full https link of at most 300 characters. */
export function isHttpsLink(v: string): boolean {
  if (v.length > ACCESS_LIMITS.where || !/^https:\/\//i.test(v)) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && u.hostname.includes('.');
  } catch {
    return false;
  }
}

/** The request cleaned and checked, or the error of each field in the page's words. */
export function checkAccessRequest(raw: Record<string, unknown>): { ok: true; value: AccessRequestInput } | { ok: false; errors: AccessErrors } {
  const value: AccessRequestInput = { email: oneLine(raw.email), company: oneLine(raw.company), where: oneLine(raw.where), fix: oneLine(raw.fix) };
  const errors: AccessErrors = {};
  if (!isAccessEmail(value.email)) errors.email = ACCESS_WORDS.badEmail;
  if (!value.company || value.company.length > ACCESS_LIMITS.company) errors.company = ACCESS_WORDS.badCompany;
  if (value.where && !isHttpsLink(value.where)) errors.where = ACCESS_WORDS.badWhere;
  if (!value.fix || value.fix.length > ACCESS_LIMITS.fix) errors.fix = ACCESS_WORDS.badFix;
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

/** "23 November 2026", in UTC, the way the site writes dates. '' for anything else. */
export function accessDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d);
}

export interface RememberedRequest {
  email: string;
  at: string;
}

/** What this browser kept, when it is still a request. */
export function parseRemembered(raw: string | null): RememberedRequest | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<RememberedRequest>;
    if (typeof v.email !== 'string' || !isAccessEmail(v.email) || typeof v.at !== 'string' || !accessDay(v.at)) return null;
    return { email: v.email, at: v.at };
  } catch {
    return null;
  }
}

/** ?email= of the page's address, when it is an email. */
export function emailFromQuery(search: string): string {
  const v = oneLine(new URLSearchParams(search).get('email'));
  return isAccessEmail(v) ? v : '';
}
