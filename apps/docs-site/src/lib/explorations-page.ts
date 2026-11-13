// The Explorations page (/studio/explorations/, the old Changes): the rules and the words, pure (no DOM, no fetch).
// Unit tested in explorations-page.test.ts; the page is components/ds/studio/BranchesList.tsx, fed by scripts/reviews.ts.
//
// Decisions (owner, 2026-11-09):
//   - One status per exploration, the one status ladder's (lib/status-ladder, 2026-11-12): Exploring, In review, Ready
//     to build, Being built, Checking, Shipped, Not doing this, Archived (statusOf). What the tag does not say (Changes
//     asked, Waiting for the library, Looks right) is a second line (statusNote), never a status.
//   - Filters are checkbox dropdowns: Status (default In progress = the five open steps), Product, People (?status=,
//     ?product=, ?people=, comma separated). No state tabs.
//   - "Waiting on you" is not a filter: a section pinned first, whatever the filters, each row with "Your turn ·
//     <reason>" (splitWaiting, turnReason). Its rows come from the one rule of every surface (lib/waiting-on, the
//     design lead's turn of lib/lead-decisions): Home's queue and the nav badge read the same.
//   - Three views: List, Grid, Board (read only, one column per status, BOARD_COLUMNS, at most BOARD_CAP cards).
//   - Library changes, docs drafts and suggestions are not explorations: they live on Library review
//     (/studio/library-review/); old addresses that opened them here go there (legacyTarget).
import { decisionsOf, isPmKind, isWaitingForLead, openDecisionOf, parseExplorationBody } from '@bridge-ds/core';
import type { LifecycleStage } from './review-state';
import { isOpenStep, STATUS_STEPS, STEP_LABEL, stepOfStage, stepTone, type StatusStep } from './status-ladder';

/** Where a row stands: a step of the one status ladder (lib/status-ladder), or stopped work. */
export type ExplorationState = StatusStep;

/** Every status, in the ladder's order: the Status filter lists them so. */
export const STATES: readonly ExplorationState[] = STATUS_STEPS;

/** The ladder's words: the tag, the filter and the Board column say the same as every other surface. */
export const STATE_LABEL: Record<ExplorationState, string> = STEP_LABEL;

/** The calm tone of each status tag (lib/status-ladder stepTone): a wait is grey, never amber by itself. */
export const STATE_TONE: Record<ExplorationState, 'info' | 'warning' | 'danger' | 'success' | 'neutral'> = Object.fromEntries(STATUS_STEPS.map((s) => [s, stepTone(s)])) as Record<ExplorationState, 'info' | 'warning' | 'success' | 'neutral'>;

/** The default of the Status filter, "In progress": the open steps (Exploring to Checking). */
export const IN_PROGRESS: readonly ExplorationState[] = STATUS_STEPS.filter(isOpenStep);
export const IN_PROGRESS_LABEL = 'In progress';

/** The Board: one column per open step, then what shipped lately. Archived and Not doing this: filter only. */
export const BOARD_COLUMNS: readonly { key: ExplorationState; label: string; holds: readonly ExplorationState[] }[] = [
  ...IN_PROGRESS.map((s) => ({ key: s, label: STATE_LABEL[s], holds: [s] })),
  { key: 'shipped', label: 'Shipped (30 days)', holds: ['shipped'] },
];

/** Cards per Board column before "Show all N". */
export const BOARD_CAP = 10;
/** The Board's Shipped column: what shipped in the last 30 days. */
export const SHIPPED_DAYS = 30;

// ---------------------------------------------------------------------------------------------------------------
// One status per row

/** What a listed row says about where it stands (ListRow fields, and its body for the talk with the lead). */
export interface StatusInput {
  /** 'exploration', or a branch lifecycle ('draft', 'ready', 'waiting', 'shipped', 'closed'). */
  lifecycle: string;
  stage?: LifecycleStage | null;
  /** The exploration's record (Bridge block): who said what. */
  body?: string | null;
  /** A branch's review status kind (core ReviewStatusKind). */
  statusKind?: string | null;
  merged_at?: string | null;
  shippedAt?: string | null;
  /** Archived (the `archived` label) when the stage was not read. */
  archived?: boolean;
  /** Library pieces it waits for once handed off (lib/library-impact-view waitingForLibraryLine), when known. */
  waitsForLibrary?: boolean;
  /**
   * The two reviews' line (lib/review-lines reviewSecondLine), once the team's reviews are read: who and why while In
   * review ("Waiting for Dana's design review"), or why nothing was reviewed once Ready to build.
   */
  reviewsLine?: string | null;
}

/** The lead said Looks right (the last word of the talk, or the lead who approved recorded in the block). */
function leadSaidLooksRight(body: string | null | undefined): boolean {
  const e = parseExplorationBody(body ?? null);
  if (!e) return false;
  if (e.designOkBy) return true;
  const all = decisionsOf(e).filter((d) => !isPmKind(d.kind));
  return all[all.length - 1]?.kind === 'looks-right';
}

/** Where a row stands, on the one status ladder. What the tag does not say is statusNote, never a status. */
export function statusOf(r: StatusInput): ExplorationState {
  if (r.archived && r.stage !== 'shipped' && r.stage !== 'next-release') return 'archived';
  if (r.merged_at || r.shippedAt || r.lifecycle === 'shipped') return 'shipped';
  if (r.lifecycle === 'exploration') {
    const open = openDecisionOf(r.body ?? null);
    if (open?.kind === 'not-doing') return 'not-doing';
    switch (r.stage) {
      case 'archived':
      case 'shipped':
      case 'next-release':
      case 'closed':
      case 'not-planned':
      case 'being-built':
      case 'in-review':
      case 'approved':
        return stepOfStage(r.stage);
      case 'waiting-for-code':
        // Library pieces it needs are still decided in Library review: it is in review until they are.
        return r.waitsForLibrary ? 'in-review' : 'ready-to-build';
      default:
        // The lead asked for changes: back with the designer, exploring (statusNote says why).
        if (open?.kind === 'changes' || open?.kind === 'take-back') return 'exploring';
        if (r.stage === 'waiting-for-lead' || isWaitingForLead(r.body ?? null)) return 'in-review';
        return 'exploring';
    }
  }
  if (r.lifecycle === 'closed') return 'not-doing';
  // A product branch (not an exploration): its review on the ladder.
  if (r.lifecycle === 'ready') {
    if (r.statusKind === 'changes-requested') return 'exploring';
    if (r.statusKind === 'needs-design' || r.statusKind === 'needs-approval') return 'in-review';
    if (r.statusKind === 'ready') return 'ready-to-build';
  }
  return 'being-built';
}

/**
 * The second line of a row's status, what the tag alone does not say: "Changes asked", "Waiting for the library",
 * "Looks right". Null when the tag says it all. Never a status of its own (lib/status-ladder).
 */
export function statusNote(r: StatusInput): string | null {
  if (r.lifecycle === 'exploration') {
    const open = openDecisionOf(r.body ?? null);
    if (!r.stage || r.stage === 'exploring' || r.stage === 'waiting-for-lead') {
      if (open?.kind === 'changes' || open?.kind === 'take-back') return 'Changes asked';
      return r.stage === 'waiting-for-lead' || isWaitingForLead(r.body ?? null) ? (r.reviewsLine ?? null) : null;
    }
    if (r.stage === 'waiting-for-code') return r.waitsForLibrary ? 'Waiting for the library' : leadSaidLooksRight(r.body) ? 'Looks right' : (r.reviewsLine ?? null);
    if (r.stage === 'approved') return 'Looks right, ships next';
    if (r.stage === 'next-release') return 'In the next release';
    return null;
  }
  if (r.lifecycle === 'ready' && r.statusKind === 'changes-requested') return 'Changes asked';
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Filters and the address

/** The people filter's value for the signed-in viewer (lib/branches-page YOU). */
export const YOU = '~you';

export interface ExplorationFilters {
  /** The statuses shown; the default is IN_PROGRESS. */
  status: ExplorationState[];
  /** Product keys, lower case; empty: every product. */
  product: string[];
  /** People keys (YOU for the viewer); empty: everyone. */
  people: string[];
}

export const DEFAULT_FILTERS: ExplorationFilters = { status: [...IN_PROGRESS], product: [], people: [] };

const isState = (s: string): s is ExplorationState => (STATES as readonly string[]).includes(s);

/**
 * Old status words to the new ones: the Changes tabs (?state=), the branch statuses (?status=draft|ready|waiting|
 * merged...) and the lifecycle stages.
 */
const OLD_STATUS: Record<string, ExplorationState[]> = {
  'not-started': ['exploring'],
  'needs-changes': ['exploring'],
  'waiting-for-lead': ['in-review'],
  'waiting-for-library': ['in-review'],
  'looks-right': ['ready-to-build'],
  'with-developers': ['ready-to-build', 'being-built', 'checking'],
  code: ['ready-to-build'],
  'waiting-for-code': ['ready-to-build'],
  building: ['being-built'],
  draft: ['being-built'],
  review: ['checking'],
  ready: ['ready-to-build'],
  waiting: ['ready-to-build'],
  approved: ['checking'],
  'next-release': ['shipped'],
  merged: ['shipped'],
  closed: ['shipped'],
  'not-planned': ['not-doing'],
};

const list = (v: string | null) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

const uniq = <T,>(xs: T[]) => [...new Set(xs)];

/**
 * The filters a page opens on, from its address. ?status= (new words, comma separated, or the old branch statuses),
 * the old ?state= tabs (?state=waiting and ?state=all keep the default: Waiting on you is always pinned first), the
 * old ?tier= (a library tier: the default statuses), the old History (?view=history: Shipped). ?product= and ?people=
 * (or the old ?by=, ?who=mine, ?view=mine, ?kind=library). With ?exploration= open, ?product= names its product.
 */
export function filtersFromAddress(search: string, libraryKey = 'library'): ExplorationFilters {
  const q = new URLSearchParams(search);
  // ?state=waiting was the Waiting on me tab (pinned first now), ?status=waiting the old "waiting for code".
  const words = [...list(q.get('status')), ...list(q.get('state')).filter((w) => w !== 'waiting' && w !== 'all')];
  let status = uniq(words.flatMap((w) => (isState(w) ? [w] : (OLD_STATUS[w] ?? []))));
  if (!status.length && q.get('view') === 'history') status = ['shipped'];
  if (!status.length && q.get('archived') === '1') status = ['archived'];
  const kind = q.get('kind');
  const product = q.has('exploration') ? [] : uniq([...list(q.get('product')), ...(kind === 'library' || kind === 'docs' ? [libraryKey.toLowerCase()] : [])]);
  const mine = q.get('who') === 'mine' || q.get('view') === 'mine';
  const raw = uniq([...list(q.get('people')), ...list(q.get('by'))]).filter((p) => p !== 'everyone' && p !== '~everyone');
  const people = uniq([...raw.map((p) => (p === 'you' ? YOU : p)), ...(mine && !raw.length ? [YOU] : [])]);
  return { status: status.length ? status : [...IN_PROGRESS], product, people };
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/** The address for the filters, other parameters kept; the defaults leave it. Old filter parameters are dropped. */
export function addressWithFilters(search: string, f: ExplorationFilters): string {
  const q = new URLSearchParams(search);
  for (const old of ['state', 'tier', 'archived', 'who', 'by', 'kind']) q.delete(old);
  if (q.get('view') === 'mine' || q.get('view') === 'history') q.delete('view');
  const ordered = STATES.filter((s) => f.status.includes(s));
  if (ordered.length && !sameSet(ordered, IN_PROGRESS)) q.set('status', ordered.join(','));
  else q.delete('status');
  if (!q.has('exploration')) {
    if (f.product.length) q.set('product', f.product.join(','));
    else q.delete('product');
  }
  if (f.people.length) q.set('people', f.people.map((p) => (p === YOU ? 'you' : p)).join(','));
  else q.delete('people');
  const s = q.toString().replace(/%2C/g, ',');
  return s ? `?${s}` : '';
}

/** The filters differ from the default (Clear filters shows). */
export const isFiltered = (f: ExplorationFilters) => !sameSet(f.status, IN_PROGRESS) || f.product.length > 0 || f.people.length > 0;

/** A row as the filters read it. */
export interface FilterRow {
  status: ExplorationState;
  /** Lower case product key. */
  product: string;
  /** People keys it shows (YOU for the viewer). */
  people: readonly string[];
}

export const passes = (x: FilterRow, f: ExplorationFilters): boolean =>
  f.status.includes(x.status) && (!f.product.length || f.product.includes(x.product)) && (!f.people.length || x.people.some((p) => f.people.includes(p)));

/** The Status filter's trigger: "In progress", one status by name, or "3 statuses". */
export function statusTriggerLabel(status: readonly ExplorationState[]): string {
  if (sameSet(status, IN_PROGRESS)) return IN_PROGRESS_LABEL;
  if (status.length === 1) return STATE_LABEL[status[0]!];
  if (status.length === STATES.length) return 'Any status';
  return `${status.length} statuses`;
}

/** A multi filter's trigger: its "all" word, one name, or "<first> and N more". */
export function multiTriggerLabel(picked: readonly string[], labelOf: (v: string) => string, all: string): string {
  if (!picked.length) return all;
  if (picked.length === 1) return labelOf(picked[0]!);
  return `${labelOf(picked[0]!)} +${picked.length - 1}`;
}

/** "Nothing waiting for lead by Leo in Acme CRM yet." The line when the filters leave nothing. */
export function emptyFilterLine(f: ExplorationFilters, names: { person: (k: string) => string; product: (k: string) => string }): string {
  const join = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);
  const status = sameSet(f.status, IN_PROGRESS) ? 'in progress' : join(STATES.filter((s) => f.status.includes(s)).map((s) => STATE_LABEL[s].toLowerCase()));
  const by = f.people.length ? ` by ${join(f.people.map((p) => (p === YOU ? 'you' : names.person(p))))}` : '';
  const where = f.product.length ? ` in ${join(f.product.map(names.product))}` : '';
  return `Nothing ${status}${by}${where} yet.`;
}

/** "7 explorations." / "3 of 7 explorations." */
export function countLine(shown: number, total: number): string {
  const word = (n: number) => (n === 1 ? 'exploration' : 'explorations');
  return shown === total ? `${total} ${word(total)}.` : `${shown} of ${total} ${word(total)}.`;
}

// ---------------------------------------------------------------------------------------------------------------
// Waiting on you

/**
 * The rows that wait on the viewer, pinned first whatever the filters, and the others: a row is never in both. `turn`
 * is the row's yourTurn (the one rule, lib/waiting-on and lib/lead-decisions, as Home and the nav badge).
 */
export function splitWaiting<R extends { yourTurn: boolean }>(rows: readonly R[]): { waiting: R[]; rest: R[] } {
  return { waiting: rows.filter((r) => r.yourTurn), rest: rows.filter((r) => !r.yourTurn) };
}

/**
 * Why a row waits on the viewer, after "Your turn · ": "Sofia sent it for review", "Dana asked a change on
 * ProfileHeader", "Leo asked you a question", "Sofia answered your question". From the talk with the lead when there
 * is one, else the review GitHub asks of them.
 */
export function turnReason(x: { body?: string | null; designer: string; reviewWaits?: boolean; nameOf?: (login: string) => string; component?: string | null }): string {
  const nameOf = x.nameOf ?? ((l: string) => l);
  const e = parseExplorationBody(x.body ?? null);
  const sayer = (d: { by?: string; byName?: string }) => d.byName ?? (d.by ? nameOf(d.by.replace(/^name:/, '')) : 'Someone');
  if (e) {
    const all = decisionsOf(e).filter((d) => !isPmKind(d.kind));
    const last = all[all.length - 1];
    const open = openDecisionOf(x.body ?? null);
    if (isWaitingForLead(x.body ?? null)) {
      if (open?.kind === 'question') return `${sayer(open)} asked you a question`;
      if (last?.kind === 'answer') return `${x.designer} answered your question`;
      if (last?.kind === 'asked-someone') return `${sayer(last)} asked you to look`;
      return `${x.designer} sent it for review`;
    }
    if (open?.kind === 'question') return `${sayer(open)} asked you a question`;
    if (open?.kind === 'take-back') return `${sayer(open)} took it back`;
    if (open?.kind === 'changes') return `${sayer(open)} asked a change${x.component ? ` on ${x.component}` : ''}`;
  }
  return `${x.designer} sent it for review`;
}

// ---------------------------------------------------------------------------------------------------------------
// The Board

export interface BoardColumn<R> {
  key: ExplorationState;
  label: string;
  /** Every card of the column (count), the first BOARD_CAP shown unless the column is opened. */
  rows: R[];
}

/**
 * The Board's columns over the rows the filters keep: one per status in BOARD_COLUMNS (Looks right holds Waiting for
 * the library), only the statuses the filter keeps; Shipped holds the last SHIPPED_DAYS days.
 */
export function boardColumns<R extends { status: ExplorationState; shippedAt?: string | null }>(rows: readonly R[], status: readonly ExplorationState[], now: number = Date.now()): BoardColumn<R>[] {
  const since = now - SHIPPED_DAYS * 86_400_000;
  return BOARD_COLUMNS.filter((c) => c.holds.some((h) => status.includes(h))).map((c) => ({
    key: c.key,
    label: c.label,
    rows: rows.filter((r) => c.holds.includes(r.status) && (c.key !== 'shipped' || (r.shippedAt ? Date.parse(r.shippedAt) >= since : false))),
  }));
}

// ---------------------------------------------------------------------------------------------------------------
// Old addresses

export const EXPLORATIONS_ROUTE = 'explorations/';
export const LIBRARY_REVIEW_ROUTE = 'library-review/';

/**
 * Where an old Changes address lands (relative to the Studio root, with its query), or null when the Explorations
 * page itself opens it. ?suggestion=, ?origin= and ?group= (the old Library group) go to Library review; a History
 * address goes to Shipped (lib/history-moved handles its other targets first); everything else stays here.
 */
export function legacyTarget(search: string, hash = ''): string | null {
  const q = new URLSearchParams(search);
  const h = hash && hash !== '#' && hash !== '#other-branches' ? hash : '';
  if (q.has('suggestion') || q.has('origin') || q.has('group')) {
    const keep = new URLSearchParams();
    for (const k of ['suggestion', 'origin', 'group']) if (q.has(k)) keep.set(k, q.get(k)!);
    const s = keep.toString();
    return `${LIBRARY_REVIEW_ROUTE}${s ? `?${s}` : ''}${h}`;
  }
  return null;
}

/**
 * The Explorations address for an old Changes one (the team shell's /changes/ redirect): Library review for what moved
 * there, else the same query on Explorations with its old filters translated (addressWithFilters).
 */
export function changesToExplorations(search: string, hash = '', libraryKey = 'library'): string {
  const moved = legacyTarget(search, hash);
  if (moved) return moved;
  const q = new URLSearchParams(search);
  const translate = ['state', 'status', 'tier', 'who', 'by', 'kind', 'archived'].some((k) => q.has(k)) || q.get('view') === 'history' || q.get('view') === 'mine';
  const h = hash && hash !== '#' && hash !== '#other-branches' ? hash : '';
  if (!translate) return `${EXPLORATIONS_ROUTE}${search && search !== '?' ? (search.startsWith('?') ? search : `?${search}`) : ''}${h}`;
  return `${EXPLORATIONS_ROUTE}${addressWithFilters(search, filtersFromAddress(search, libraryKey))}${h}`;
}

/**
 * What the list says, quietly, in place of its rows when GitHub could not be read and no list was saved: when it will
 * show, never "Nothing in progress" nor a count of 0 (the banner above already says why, once).
 */
export function unreadListLine(resetAt: Date | null, now = Date.now()): string {
  if (!resetAt || !Number.isFinite(resetAt.getTime())) return 'Explorations will show as soon as GitHub answers.';
  if (resetAt.getTime() <= now + 30_000) return 'Explorations will show in a moment.';
  return `Explorations will show at ${resetAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`;
}
