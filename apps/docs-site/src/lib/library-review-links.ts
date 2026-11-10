// Old addresses that land on Library review (phase 3), and what they open there:
//   - the old review queue (/studio/review/, Home's "Review all") became Library review: ?pr=N and ?item=change-N open
//     that library change; an exploration's row (?item=exploration-review-..., dev-question-...) opens the exploration
//     on Explorations (exploration screens stay there, in Waiting on you); a usage guidance draft, a library check, a
//     join request or a setup row goes back to Home, where its row acts;
//   - the old Changes Library group (phase 2 carried its parameters here): ?suggestion=N opens that piece or the
//     suggestion itself, ?origin=lead|explorations becomes the Product filter (the library's own changes, or every
//     product), ?group=component the List (grouped by what changes), ?group=exploration the Map (by where it comes
//     from).
// Pure: no DOM. Read by components/ds/studio/LibraryReview.tsx. Tested in library-review-links.test.ts.
import { LIBRARY_PRODUCT, type PieceState, type ReviewFilters, type ReviewPiece, type ReviewView } from './library-review';

export interface LegacyLink {
  /** A library change by its number (?pr=N, ?item=change-N). */
  pr: number | null;
  /** A suggestion (?suggestion=N, ?item=suggestion-N): a library change of that number, else the suggestion itself. */
  suggestion: number | null;
  /** Any other row key of the old queue (?item=). */
  item: string | null;
  origin: 'explorations' | 'lead' | null;
  group: 'component' | 'exploration' | null;
}

/** The parameters this file reads, removed from the address once read. */
export const LEGACY_PARAMS = ['pr', 'item', 'suggestion', 'origin', 'group'] as const;

const num = (v: string | null): number | null => {
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 ? n : null;
};

export function readLegacy(search: string): LegacyLink {
  const q = new URLSearchParams(search);
  const item = q.get('item')?.trim() || null;
  const change = item ? /^change-(\d+)$/.exec(item) : null;
  const sg = item ? /^suggestion-(\d+)$/.exec(item) : null;
  const origin = q.get('origin');
  const group = q.get('group');
  return {
    pr: num(q.get('pr')) ?? (change ? Number(change[1]) : null),
    suggestion: num(q.get('suggestion')) ?? (sg ? Number(sg[1]) : null),
    item: change || sg ? null : item,
    origin: origin === 'explorations' || origin === 'lead' ? origin : null,
    group: group === 'component' || group === 'exploration' ? group : null,
  };
}

export const hasLegacy = (l: LegacyLink): boolean => Boolean(l.pr || l.suggestion || l.item || l.origin || l.group);

/**
 * Where an old queue row goes before any data is read (relative to the Studio root), or null when it opens here.
 * "exploration-review-crm#4" and "dev-question-crm#4" open exploration 4 of Acme CRM; "dev-question-#4" (the design
 * system repository) exploration 4; guidance, library checks, setup and join rows go to Home.
 */
export function itemTarget(item: string | null): string | null {
  if (!item) return null;
  const x = /^(?:exploration-review-|dev-question-)(?:([a-z0-9][\w.-]*)?#)?(\d+)$/i.exec(item);
  if (x) return `explorations/?exploration=${x[2]}${x[1] ? `&product=${encodeURIComponent(x[1])}` : ''}`;
  if (/^(guidance-|health-|setup-|join-)/.test(item)) return '';
  return null;
}

export interface Landing {
  /** The piece to show (One by one opens on it, List and Map keep their order). */
  current: string | null;
  filters: Partial<ReviewFilters>;
  view: ReviewView | null;
  /** Leave for another Studio page (relative to the Studio root). */
  redirect: string | null;
  /** Open this suggestion's review here: no library piece carries its number. */
  suggestion: number | null;
}

const NONE: Landing = { current: null, filters: {}, view: null, redirect: null, suggestion: null };

/**
 * What an old address opens once the pieces are read. A piece it names shows whatever the filters were (its status is
 * added, the Asked by and Product filters are cleared), so the link never lands on "Nothing matches".
 */
export function landing(l: LegacyLink, pieces: readonly ReviewPiece[], o: { reviews: boolean }): Landing {
  const n = l.pr ?? l.suggestion;
  if (n) {
    const p = pieces.find((x) => x.source.kind === 'change' && x.source.number === n);
    if (p) {
      const status: PieceState[] = p.state === 'waiting' ? ['waiting'] : ['waiting', 'decided'];
      return { ...NONE, current: p.key, filters: { status, asked: [], product: [] }, view: o.reviews ? 'one' : 'list' };
    }
    if (l.pr) return { ...NONE, redirect: `explorations/?pr=${l.pr}` };
    return { ...NONE, suggestion: l.suggestion };
  }
  const target = itemTarget(l.item);
  if (target !== null) return { ...NONE, redirect: target };
  const filters: Partial<ReviewFilters> = {};
  if (l.origin === 'lead') filters.product = [LIBRARY_PRODUCT];
  if (l.origin === 'explorations') {
    const keys = new Set<string>();
    for (const p of pieces) if (p.asked?.productKey) keys.add(p.asked.productKey.toLowerCase());
    filters.product = [...keys].sort();
  }
  const view: ReviewView | null = l.group === 'exploration' ? 'map' : l.group === 'component' ? 'list' : null;
  return { ...NONE, filters, view };
}

/** The piece an address opens in One by one (?piece=<key>), or null. */
export const readPiece = (search: string): string | null => new URLSearchParams(search).get('piece')?.trim() || null;

/** A piece's own address: One by one on that piece (no ?view, the default view), the filters kept. */
export function pieceSearch(search: string, key: string): string {
  const q = new URLSearchParams(search);
  q.delete('view');
  q.delete('focus');
  q.set('piece', key);
  return `?${q.toString()}`;
}

/** The address once the view changes: a piece belongs to One by one (?piece=), a picked box to the Map (?focus=). */
export function viewSearch(search: string, view: ReviewView): string {
  const q = new URLSearchParams(search);
  if (view !== 'one') q.delete('piece');
  if (view !== 'map') q.delete('focus');
  const s = q.toString();
  return s ? `?${s}` : '';
}

const TOKEN_CATEGORY: Record<string, string> = { colors: 'color', spacing: 'dimension', corners: 'dimension', type: 'typography', elevation: 'shadow', motion: 'motion' };

const kebab = (name: string) =>
  name
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();

/**
 * Where a piece lives in the library, relative to the Studio root: its component on Components (?c=<slug>), its kind of
 * token on Tokens, the component a docs draft is about. Null for a piece the library does not have yet (a new
 * component) and for anything without a page.
 */
export function libraryPageOf(p: Pick<ReviewPiece, 'category' | 'kind' | 'title' | 'conflict'>): { path: string; label: string } | null {
  const cat = TOKEN_CATEGORY[p.category.toLowerCase()];
  if (cat) return { path: `tokens/?lens=types&cat=${cat}`, label: `${p.category} in Tokens` };
  if (/^new component$/i.test(p.kind)) return null;
  const component = p.conflict?.component ?? (p.category === 'Docs' ? (/^([A-Z][A-Za-z0-9]*)\s*:/.exec(p.title)?.[1] ?? null) : ['Brands', 'Library'].includes(p.category) ? null : p.category);
  if (!component || !/^[A-Z][A-Za-z0-9]*$/.test(component)) return null;
  return { path: `components/?c=${kebab(component)}`, label: `${component} in Components` };
}

/** The address without the old parameters, once they were read. */
export function withoutLegacy(search: string): string {
  const q = new URLSearchParams(search);
  for (const k of LEGACY_PARAMS) q.delete(k);
  const s = q.toString();
  return s ? `?${s}` : '';
}
