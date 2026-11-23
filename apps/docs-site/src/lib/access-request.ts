// "Request access" (pages/request.astro, components/ds/account/RequestAccess.tsx, api/access): Bridge opens on
// invitation. The demo is open to everyone; a team that wants Bridge on its own design system sends a request, and the
// founder answers by hand within 2 working days. The words, the field rules (the page and the function check the same
// ones) and what this browser remembers of a request. Pure: no DOM, no Node, imported by api/access too.

import { SAMPLE_REPO } from './demo.js';
import { STUDIO_ROOT } from './team-path.js';
import { FOUNDING_CUTOFF } from './pricing.js';

/** The request page (the landing, pricing and the demo lead here). */
export const REQUEST_PAGE = '/request/';
export const ACCESS_API = '/api/access';
/** The sign-in page (lib/account SIGNIN_PAGE; kept here so api/access imports nothing browser-side). */
export const SIGNIN_PATH = '/signin/';
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
  /** After the lead, for a request sent by the founding cutoff (terms 10.1, foundingRequest). */
  foundingSaved: 'Your founding place is saved.',
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

/** The Paris calendar day of an ISO time, YYYY-MM-DD; '' for anything else. */
export function parisDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Europe/Paris' }).format(d);
}

/**
 * A request sent up to the founding cutoff, included (Paris day, terms 10.1): it reserves a founding place, kept if
 * the invite is accepted within 30 days (ACCESS_APPROVAL_MS).
 */
export const foundingRequest = (at: string): boolean => {
  const day = parisDay(at);
  return Boolean(day) && day <= FOUNDING_CUTOFF;
};

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

// ---------------------------------------------------------------------------------------------------------------
// The gate (BRIDGE_ACCESS_GATE=on, api/account) and access links (/signin/?access=<token>)

/** An approval (the founder's Invite) stays open this long: an account must be made within it. */
export const ACCESS_APPROVAL_MS = 30 * 24 * 60 * 60 * 1000;
/** The query parameter of an access link on /signin/. */
export const ACCESS_PARAM = 'access';
/** This tab keeps the access link's token while the sign-in goes on (and through GitHub and back). */
export const ACCESS_LINK_KEY = 'bridge:access-link';
/** The admin queue (pages/admin/access.astro). */
export const ACCESS_ADMIN_PAGE = '/admin/access/';
/** The places the founder means to open each ISO week (ACCESS_WEEKLY_CAP). */
export const ACCESS_WEEKLY_CAP = 5;

export type AccessLinkState = 'valid' | 'expired' | 'used';

/** Where a link stands: expired once past expiresAt, used once all its uses are taken. */
export function linkStateOf(l: { expiresAt: string; maxUses: number; uses: number }, now: number): AccessLinkState {
  if (!(Date.parse(l.expiresAt) > now)) return 'expired';
  if (l.uses >= l.maxUses) return 'used';
  return 'valid';
}

/** The access link token of the sign-in address (?access=), when it looks like one. */
export function accessTokenFromQuery(search: string): string | null {
  const v = new URLSearchParams(search).get(ACCESS_PARAM)?.trim() ?? '';
  return /^[A-Za-z0-9_-]{43}$/.test(v) ? v : null;
}

/** The request page with the email filled in. */
export const requestHref = (email: string): string => (email ? `${REQUEST_PAGE}?email=${encodeURIComponent(email)}` : REQUEST_PAGE);

export const GATE_WORDS = {
  /** The server's sentence with 403 access_required. */
  refused: 'Bridge opens in small groups. Request access with this email and we reply within 2 working days.',
  title: 'Bridge opens in small groups',
  text: 'Request access with this email and we reply within 2 working days. The demo is open meanwhile.',
  request: 'Request access',
  demo: 'Open the demo',
  anotherEmail: 'Use another email',
  /** The sign-in screen opened from a live access link (signed out, or signed in already). */
  linkTitle: "You're invited to the Bridge beta",
  /** "Hi Enginy, Florian opened early access to Bridge for you. Sign in with your work email to start." */
  linkLead: (label: string, inviter: string) =>
    `${label.trim() ? `Hi ${label.trim()},` : 'Hi,'} ${inviter.trim() || 'Florian'} opened early access to Bridge for you. Sign in with your work email to start.`,
  /** Signed in already on this browser: an existing account needs no link (none of its uses is taken). */
  linkSignedIn: (name: string) => `You are signed in as ${name}. Continue with this account or use another one.`,
  /** Signed in already, and the link expired, ran out or was revoked. */
  linkGoneSignedIn: 'This invite link is no longer valid. You can still continue with your account.',
  linkGone: 'This invite link has expired. Request access and we will review it first.',
  linkGoneTitle: 'Bridge opens in small groups',
} as const;

/** What GET /api/access?link= answers. */
export type AccessLinkInfo = { valid: true; label: string; inviter: string; expiresAt: string } | { valid: false; reason: 'expired' | 'used' | 'unknown' };

export function parseAccessLinkInfo(v: unknown): AccessLinkInfo | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (o.valid === true) return { valid: true, label: String(o.label ?? ''), inviter: String(o.inviter ?? ''), expiresAt: String(o.expiresAt ?? '') };
  if (o.valid === false) return { valid: false, reason: o.reason === 'expired' || o.reason === 'used' ? o.reason : 'unknown' };
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// The founder's queue (/admin/access/)

/** Monday 00:00 UTC of the ISO week `now` falls in, in ms. */
export function isoWeekStart(now: number): number {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

export interface QueueRequest extends AccessRequestInput {
  at: string;
  status: string;
  approvedAt?: string;
  approvedVia?: 'queue' | 'link';
  declinedAt?: string;
  note?: string;
}

/** Waiting first, then those that gave a link to their design system, then the oldest. */
export function sortQueue<T extends Pick<QueueRequest, 'status' | 'where' | 'at'>>(list: readonly T[]): T[] {
  const rank = (r: T) => (r.status === 'pending' ? 0 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b) || Number(!a.where) - Number(!b.where) || Date.parse(a.at) - Date.parse(b.at));
}

/** The founder's invites this ISO week (an access link's sign-up is not one). */
export function invitedThisWeek(list: readonly Pick<QueueRequest, 'status' | 'approvedAt' | 'approvedVia'>[], now: number): number {
  const from = isoWeekStart(now);
  return list.filter((r) => r.status === 'invited' && r.approvedVia !== 'link' && r.approvedAt && Date.parse(r.approvedAt) >= from && Date.parse(r.approvedAt) <= now).length;
}

export interface AdminLink {
  id: string;
  label: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  maxUses: number;
  uses: number;
  usedBy: string[];
  state: AccessLinkState;
}

/** A team role as People shows it: an email member's role, or what GitHub said (admin or edit). */
export type PeopleRole = 'view' | 'edit' | 'admin';

/** One account on People (api/access `people`). Never a session, a code or a hash. */
export interface PeopleAccount {
  name: string;
  email: string;
  /** The linked GitHub login, else null (the account signs in with email codes). */
  github: string | null;
  /** ISO, null when the record has none. */
  createdAt: string | null;
  teams: { name: string; role: PeopleRole; via: 'email' | 'github' }[];
}

export interface PeopleTeam {
  name: string;
  /** owner/repo, null for a team made in Bridge with no repository yet. */
  repo: string | null;
  members: number;
  /** ISO for a team made in Bridge, else null (a repository team keeps no date). */
  createdAt: string | null;
}

export interface PeopleList {
  accounts: PeopleAccount[];
  teams: PeopleTeam[];
  /** Every account in storage; `accounts` stops at 2000 (`truncated`). */
  total: number;
  truncated: boolean;
  /** Accounts made in the last 7 days. */
  joinedWeek: number;
}

/** The query parameter of the founder's notice email: the request to show first (its email). */
export const REQUEST_PARAM = 'request';

/** The queue with one request in view: the founder's notice email links here. */
export const reviewHref = (origin: string, email: string): string => `${origin}${ACCESS_ADMIN_PAGE}?${REQUEST_PARAM}=${encodeURIComponent(email)}`;

export const ADMIN_WORDS = {
  title: 'Access',
  tabRequests: 'Requests',
  tabLinks: 'Invite links',
  tabPeople: 'People',
  requestGone: 'The request from this email link is no longer in the queue.',
  /** "12 accounts · 3 teams · 2 joined in the last 7 days" */
  peopleSummary: (n: number, t: number, k: number) => `${n} ${n === 1 ? 'account' : 'accounts'} · ${t} ${t === 1 ? 'team' : 'teams'} · ${k} joined in the last 7 days`,
  peopleTruncated: (shown: number, total: number) => `Showing the first ${shown} of ${total} accounts.`,
  accountsTitle: 'Accounts',
  teamsTitle: 'Teams',
  colName: 'Name',
  colEmail: 'Email',
  colSignIn: 'Signs in with',
  colCreated: 'Created',
  colTeams: 'Teams',
  colRepo: 'Repository',
  colMembers: 'Members',
  viaGithub: (login: string) => `GitHub (${login})`,
  viaEmail: 'Email code',
  unknown: 'Unknown',
  noTeams: 'None',
  noRepo: 'No repository yet',
  role: { admin: 'Admin', edit: 'Can edit', view: 'Can view' } as const,
  noPeople: 'No accounts yet.',
  noTeamRows: 'No teams yet.',
  peopleFailed: 'Bridge could not load the people. Try again in a minute.',
  /** "3 requests waiting · 2 of 5 places left this week" */
  summary: (waiting: number, left: number, cap: number) => `${waiting} ${waiting === 1 ? 'request' : 'requests'} waiting · ${left} of ${cap} places left this week`,
  overCap: (cap: number) => `This week's ${cap} places are taken. You can still invite: it is your call.`,
  invite: 'Invite',
  notYet: 'Not yet',
  invited: (day: string) => `Invited ${day}`,
  invitedByLink: (day: string) => `Joined with a link ${day}`,
  declined: (day: string) => `Not yet, ${day}`,
  sent: (day: string) => `Sent ${day}`,
  noWhere: 'No design system link',
  emptyTitle: 'No requests yet',
  emptyText: 'Requests sent on the Request access page show here. Meanwhile, an invite link brings in someone you already talked to.',
  notYetTitle: (company: string) => `Not yet for ${company}?`,
  notYetText: 'They get an honest email: not yet, your note, and that the demo stays open.',
  noteLabel: 'Note (optional)',
  noteHint: 'One or two sentences, sent as you write them.',
  notYetSend: 'Send not yet',
  cancel: 'Cancel',
  invitedToast: (email: string) => `Invited. ${email} gets the sign-in email now.`,
  declinedToast: (email: string) => `Sent. ${email} knows it is not yet.`,
  linksTitle: 'Invite links',
  linksLead: 'For someone you already talked to: the link opens Bridge without a request.',
  labelLabel: 'Who is it for',
  labelPlaceholder: 'Ana at Acme',
  usesLabel: 'Uses',
  daysLabel: 'Days',
  createLink: 'Create link',
  newLinkTitle: 'Link created. Copy it now: Bridge shows it only once.',
  copy: 'Copy link',
  copied: 'Copied',
  revoke: 'Revoke',
  /** "1 of 1 used · expires 7 December 2026" */
  linkMeta: (uses: number, max: number, state: AccessLinkState, day: string) =>
    `${uses} of ${max} used · ${state === 'expired' ? `expired ${day}` : `expires ${day}`}`,
  noLinks: 'No invite links yet.',
  badLabel: 'Say who the link is for, in a few words.',
  signInTitle: 'Sign in to see access requests',
  signInText: 'This page is for the people who open Bridge to new teams.',
  signIn: 'Sign in',
  notAdmin: 'This page is for the people who open Bridge to new teams. Your account is not one of them.',
  failed: 'Bridge could not load the requests. Try again in a minute.',
  retry: 'Try again',
} as const;
