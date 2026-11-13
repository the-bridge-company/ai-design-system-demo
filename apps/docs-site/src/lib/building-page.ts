// The Being built page (components/ds/studio/BeingBuilt.tsx): its filters, words and Board, built like Explorations
// (lib/explorations-page, owner decisions 2026-11-11). Pure: no DOM, no fetch. Unit tested in building-page.test.ts.
//   - One status per row, one word per status everywhere (filter, tag, Board column), the one status ladder's
//     (lib/status-ladder): Ready to build, Being built, Checking, Shipped (the last SHIPPED_DAYS days, the window of
//     Explorations), and Not doing this while a declined request stays listed. A wait is grey; amber once late.
//   - Filters are Explorations' checkbox dropdowns: Status (default Not shipped yet = the first three), Product, People
//     (?status=, ?product=, ?people=, comma separated). No tabs.
//   - Three views: List, Grid, Board (read only, one column per status, the column says the status so its cards do not).
//   - List and Grid group the rows by product as Explorations does (buildGroups), the ladder's order inside a group.
//   - A card's person line is Explorations' rule: who has it now, then when it last moved (cardLine).
import type { BuildRequestView } from '@bridge-ds/core';
import { ago, shortName, type PillTone } from './home-model';
import { STEP_COUNT_WORDS, STEP_LABEL, stepTone, type StatusStep } from './status-ladder';
import { YOU } from './branches-page';

export type BuildState = 'waiting' | 'in-progress' | 'in-review' | 'shipped' | 'not-planned';

/** Every status, in the lifecycle's order: the Status filter lists them so (Not planned only while one is listed). */
export const BUILD_STATES: readonly BuildState[] = ['waiting', 'in-progress', 'in-review', 'shipped', 'not-planned'];

/** Each status on the one status ladder (lib/status-ladder): the same word and tone as every other surface. */
const BUILD_STEP: Record<BuildState, StatusStep> = {
  waiting: 'ready-to-build',
  'in-progress': 'being-built',
  'in-review': 'checking',
  shipped: 'shipped',
  'not-planned': 'not-doing',
};

export const BUILD_STATE_LABEL: Record<BuildState, string> = Object.fromEntries(BUILD_STATES.map((s) => [s, STEP_LABEL[BUILD_STEP[s]]])) as Record<BuildState, string>;

/** The calm tag of each status (a wait is grey); buildStateTag turns a late wait amber. */
export const BUILD_STATE_TONE: Record<BuildState, PillTone | 'info'> = Object.fromEntries(BUILD_STATES.map((s) => [s, stepTone(BUILD_STEP[s])])) as Record<BuildState, PillTone | 'info'>;

/** The default of the Status filter: everything not shipped yet. */
export const NOT_SHIPPED: readonly BuildState[] = ['waiting', 'in-progress', 'in-review'];
export const NOT_SHIPPED_LABEL = 'Not shipped yet';

/** What shipped stays listed this long (the Board's Shipped column of Explorations: lib/explorations-page SHIPPED_DAYS). */
export const SHIPPED_DAYS = 30;
const DAY = 86_400_000;

/** The Board: one column per status. Not planned shows as a column only when the filter asks for it. */
export const BUILD_BOARD_COLUMNS: readonly { key: BuildState; label: string }[] = [
  { key: 'waiting', label: BUILD_STATE_LABEL.waiting },
  { key: 'in-progress', label: BUILD_STATE_LABEL['in-progress'] },
  { key: 'in-review', label: BUILD_STATE_LABEL['in-review'] },
  { key: 'shipped', label: `Shipped, last ${SHIPPED_DAYS} days` },
  { key: 'not-planned', label: BUILD_STATE_LABEL['not-planned'] },
];

/** Cards per Board column before "Show all N" (Explorations' BOARD_CAP). */
export const BUILD_BOARD_CAP = 10;

/** What a row says about where it stands. */
export type StateInput = Pick<BuildRequestView, 'status' | 'shippedAt'> & { nextRelease?: boolean };

/**
 * Where a row stands, in the page's words, or null when it has left the page: shipped more than SHIPPED_DAYS days ago
 * (one waiting for the library release stays, whatever its age). Picked up reads In progress; approved reads In review.
 */
export function buildStateOf(v: StateInput, now: number): BuildState | null {
  const s = stateOfStatus(v.status);
  if (s !== 'shipped' || v.nextRelease) return s;
  return v.shippedAt && now - Date.parse(v.shippedAt) <= SHIPPED_DAYS * DAY ? 'shipped' : null;
}

/** A build status in the page's words, whatever its age: picked up reads In progress, requested Waiting to be picked up. */
export function stateOfStatus(status: BuildRequestView['status']): BuildState {
  switch (status) {
    case 'requested':
      return 'waiting';
    case 'picked-up':
    case 'in-progress':
      return 'in-progress';
    case 'in-review':
      return 'in-review';
    case 'not-planned':
      return 'not-planned';
    default:
      return 'shipped';
  }
}

/** The one tag of a row: its status word, in its colour. */
export const buildStateTag = (s: BuildState, waitedDays?: number | null): { label: string; tone: PillTone | 'info' } => ({ label: BUILD_STATE_LABEL[s], tone: stepTone(BUILD_STEP[s], waitedDays) });

// ---------------------------------------------------------------------------------------------------------------
// Filters and the address

export interface BuildFilters {
  /** The statuses shown; the default is NOT_SHIPPED. */
  status: BuildState[];
  /** Product keys, lower case; empty: every product. */
  product: string[];
  /** People keys (YOU for the viewer); empty: everyone. */
  people: string[];
}

export const DEFAULT_BUILD_FILTERS: BuildFilters = { status: [...NOT_SHIPPED], product: [], people: [] };

const isState = (s: string): s is BuildState => (BUILD_STATES as readonly string[]).includes(s);

/** The old tabs' words (?tab=, and the core filter names) to the new statuses. */
const OLD_STATUS: Record<string, BuildState[]> = {
  all: [...BUILD_STATES.slice(0, 4)],
  requested: ['waiting'],
  'picked-up': ['in-progress'],
  'shipped-this-week': ['shipped'],
  approved: ['in-review'],
  'next-release': ['shipped'],
};

const list = (v: string | null) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
const uniq = <T,>(xs: T[]) => [...new Set(xs)];
const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

/**
 * The filters the page opens on, from its address: ?status= (comma separated, old tab words too), ?product= and
 * ?people= (comma separated; "you" is the viewer; the old ?by= and ?who=mine too).
 */
export function buildFiltersFromAddress(search: string): BuildFilters {
  const q = new URLSearchParams(search);
  const status = uniq(list(q.get('status')).flatMap((w) => (isState(w) ? [w] : (OLD_STATUS[w] ?? []))));
  const product = uniq(list(q.get('product')));
  const raw = uniq([...list(q.get('people')), ...list(q.get('by'))]).filter((p) => p !== 'everyone' && p !== '~everyone');
  const mine = q.get('who') === 'mine' || q.get('view') === 'mine';
  const people = uniq([...raw.map((p) => (p === 'you' ? YOU : p)), ...(mine && !raw.length ? [YOU] : [])]);
  return { status: status.length ? BUILD_STATES.filter((s) => status.includes(s)) : [...NOT_SHIPPED], product, people };
}

/** The address for the filters, other parameters kept (an open detail's ?request=); the defaults leave it. */
export function addressWithBuildFilters(search: string, f: BuildFilters): string {
  const q = new URLSearchParams(search);
  for (const old of ['who', 'by', 'kind']) q.delete(old);
  if (q.get('view') === 'mine') q.delete('view');
  const ordered = BUILD_STATES.filter((s) => f.status.includes(s));
  if (ordered.length && !sameSet(ordered, NOT_SHIPPED)) q.set('status', ordered.join(','));
  else q.delete('status');
  if (f.product.length) q.set('product', f.product.join(','));
  else q.delete('product');
  if (f.people.length) q.set('people', f.people.map((p) => (p === YOU ? 'you' : p)).join(','));
  else q.delete('people');
  const s = q.toString().replace(/%2C/g, ',');
  return s ? `?${s}` : '';
}

export const isDefaultStatus = (status: readonly BuildState[]) => sameSet(status, NOT_SHIPPED);

/** The filters differ from the default (Clear filters shows). */
export const isBuildFiltered = (f: BuildFilters) => !isDefaultStatus(f.status) || f.product.length > 0 || f.people.length > 0;

/** A row as the filters read it. */
export interface BuildFilterRow {
  state: BuildState;
  /** Lower case product key. */
  product: string;
  /** People keys it shows (YOU for the viewer). */
  people: readonly string[];
}

export const passesBuild = (x: BuildFilterRow, f: BuildFilters): boolean =>
  f.status.includes(x.state) && (!f.product.length || f.product.includes(x.product)) && (!f.people.length || x.people.some((p) => f.people.includes(p)));

// What the Status trigger reads lives in lib/filter-summary: "Not shipped yet" when nothing is ticked, else
// "Being built +1".

/** "8 changes." / "3 of 10 changes." */
export function buildCountLine(shown: number, total: number): string {
  const word = (n: number) => (n === 1 ? 'change' : 'changes');
  return shown === total ? `${total} ${word(total)}.` : `${shown} of ${total} ${word(total)}.`;
}

/** "Nothing being checked by Leo in Acme CRM yet." The line when the filters leave nothing. */
export function emptyBuildLine(f: BuildFilters, names: { person: (k: string) => string; product: (k: string) => string }): string {
  const join = (xs: string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`);
  const status = isDefaultStatus(f.status) ? 'waiting or being built' : join(BUILD_STATES.filter((s) => f.status.includes(s)).map((s) => STEP_COUNT_WORDS[BUILD_STEP[s]]));
  const by = f.people.length ? ` by ${join(f.people.map((p) => (p === YOU ? 'you' : names.person(p))))}` : '';
  const where = f.product.length ? ` in ${join(f.product.map(names.product))}` : '';
  return `Nothing ${status}${by}${where} right now.`;
}

// ---------------------------------------------------------------------------------------------------------------
// The Board

export interface BuildColumn<R> {
  key: BuildState;
  label: string;
  rows: R[];
}

/**
 * The Board's columns over the rows the filters keep, one per status the filter keeps. With the default (Not shipped
 * yet) the Board adds Shipped, as Explorations' Board adds it to In progress.
 */
export function buildBoardColumns<R extends { state: BuildState }>(rows: readonly R[], status: readonly BuildState[]): BuildColumn<R>[] {
  const shown = isDefaultStatus(status) ? [...NOT_SHIPPED, 'shipped' as const] : status;
  return BUILD_BOARD_COLUMNS.filter((c) => shown.includes(c.key)).map((c) => ({ key: c.key, label: c.label, rows: rows.filter((r) => r.state === c.key) }));
}

// ---------------------------------------------------------------------------------------------------------------
// Who a card names

const names = (xs: readonly string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/**
 * The person line of a card, the rule of Explorations' cards ("Sofia · 2 days ago", owner decision 2026-11-12): who has
 * the change now, then when it last moved. Who has it: its builders once someone builds it ("Malik", "Malik and Ana"),
 * else where it comes from ("Library change Dana approved", lib/build-origin buildOriginLine), never who asked: nobody
 * asks for build work directly. When: its latest step (lib/building-view timeline), else when it was sent. Names are
 * short ("Ann", never "Ann Leroy"). The card (ListCard) joins the two with the shared separator (lib/sep), as
 * Explorations'.
 */
export function cardLine(x: { builders: readonly string[]; origin: string | null; movedAt: string | null; now: number }): { who: string | null; when: string | null } {
  const b = x.builders.filter(Boolean).map((n) => shortName(n) ?? n);
  return { who: b.length ? names(b) : x.origin, when: x.movedAt && Number.isFinite(Date.parse(x.movedAt)) ? ago(x.movedAt, x.now) : null };
}

/**
 * The "who" of a list row's line, saying why it is there (lib/building-view rowLine): its origin ("Library change Dana
 * approved", lib/build-origin; "Asked by Leo" only for a row read without one) while it waits (or nobody builds it
 * yet), "Malik builds it" (or "Malik and Ana build it") once picked up or in review, "Shipped by Malik" once shipped.
 * Null when the row names nobody. Cards use cardLine instead.
 */
export function personLine(x: { state: BuildState; builders: readonly string[]; requester: string | null; origin?: string | null }): string | null {
  const b = x.builders.filter(Boolean).map((n) => shortName(n) ?? n);
  const requester = x.requester ? (shortName(x.requester) ?? x.requester) : null;
  // Where it comes from (lib/build-origin) says why it is there, never who asked: nobody asks for build work directly.
  const why = x.origin ?? (requester ? `Asked by ${requester}` : null);
  if (x.state === 'shipped') return b.length ? `Shipped by ${names(b)}` : why;
  if ((x.state === 'in-progress' || x.state === 'in-review') && b.length) return `${names(b)} ${b.length > 1 ? 'build' : 'builds'} it`;
  return why;
}

/** When a row last moved: its latest dated step, else when it was sent. */
export function movedAtOf(v: { createdAt?: string | null; timeline?: readonly { at?: string | undefined }[] | null }): string | null {
  const dates = [...(v.timeline ?? []).map((t) => t.at), v.createdAt].filter((d): d is string => Boolean(d) && Number.isFinite(Date.parse(d!)));
  return dates.length ? dates.reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a)) : null;
}

// ---------------------------------------------------------------------------------------------------------------
// Groups by product, as Explorations

export interface BuildGroup<R> {
  key: string;
  label: string;
  rows: R[];
}

/** Where a status sits on the ladder: Ready to build, Being built, Checking, then Shipped and Not doing this. */
const LADDER_RANK: Record<BuildState, number> = Object.fromEntries(BUILD_STATES.map((s, i) => [s, i])) as Record<BuildState, number>;

/**
 * The List and Grid groups (owner decision 2026-11-12): one per product, in Explorations' order (the products of
 * bridge.config.json in their order, then any other product a row names), the library's work under its own product
 * ("Library"). Inside a group, the rows follow the ladder (Ready to build, Being built, Checking, ...), keeping their
 * order within a status. Empty groups drop out. The group says the product once: its cards carry no product chip.
 */
export function buildGroups<R extends { state: BuildState; product: string }>(rows: readonly R[], products: readonly { key: string; name: string }[]): BuildGroup<R>[] {
  const keys = [...new Set([...products.map((p) => p.key.toLowerCase()), ...rows.map((r) => r.product)])];
  const nameOf = (k: string) => products.find((p) => p.key.toLowerCase() === k)?.name ?? k;
  return keys
    .map((k) => ({
      key: k,
      label: nameOf(k),
      rows: rows
        .map((r, i) => ({ r, i }))
        .filter((x) => x.r.product === k)
        .sort((a, b) => LADDER_RANK[a.r.state] - LADDER_RANK[b.r.state] || a.i - b.i)
        .map((x) => x.r),
    }))
    .filter((g) => g.rows.length > 0);
}

/** "Sofia's", "James'": the possessive of a name. */
export const possessive = (name: string) => (/s$/i.test(name.trim()) ? `${name.trim()}'` : `${name.trim()}'s`);
