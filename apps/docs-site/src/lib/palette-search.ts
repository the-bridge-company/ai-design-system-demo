// The search palette's ranking (Cmd+K, components/ds/SearchPalette.tsx): a subsequence fuzzy score over titles and
// extra keys, components first, then pages, then tokens; Studio groups them by kind (rankGrouped). Pure, browser-safe.
import type { SearchItem, SearchKind } from './search';

/** Sent on the palette dialog by scripts/shell.ts each time it opens: the island clears the query and takes focus. */
export const PALETTE_OPEN_EVENT = 'bridge:palette-open';

/** Subsequence fuzzy score: consecutive and word-start hits score higher. -1 when not all characters match. */
export function fuzzy(query: string, text: string): number {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;
  const direct = t.indexOf(q);
  if (direct >= 0) return 1000 - direct * 2 - (t.length - q.length) * 0.5 + (direct === 0 ? 200 : 0);
  let score = 0;
  let ti = 0;
  let streak = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found < 0) return -1;
    const boundary = found === 0 || /[\s./_-]/.test(t[found - 1] ?? '');
    streak = found === ti ? streak + 1 : 0;
    score += 10 + streak * 6 + (boundary ? 12 : 0) - Math.min(found - ti, 10);
    ti = found + 1;
  }
  return score;
}

const WEIGHT: Record<SearchKind, number> = { page: 40, component: 60, token: 0, exploration: 60, piece: 60, request: 60, product: 60 };

/** What the palette lists for a query: with no query, the first 12 pages and components; else the 40 best matches. */
export function rankResults(query: string, all: readonly SearchItem[]): SearchItem[] {
  const q = query.trim();
  if (!q) return all.filter((x) => x.kind !== 'token').slice(0, 12);
  return all
    .map((item) => {
      const s = Math.max(fuzzy(q, item.title), fuzzy(q, item.keys ?? '') - 40);
      return { item, s: s < 0 ? -1 : s + WEIGHT[item.kind] };
    })
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 40)
    .map((x) => x.item);
}

const words = (text: string) => text.toLowerCase().split(/[^a-z0-9#]+/).filter(Boolean);

/**
 * A close match, for kinds whose fuzzy matches are noise (tokens and pages, gate #1164): the query as one run of
 * characters ("color.action", "#0b3a", "settings"), or each of its words starting a word of the text ("acme crm",
 * "rev rules"). Never letters scattered across a long path.
 */
export function closeMatch(query: string, text: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (text.toLowerCase().includes(q)) return true;
  const have = words(text);
  const want = words(q);
  return want.length > 0 && want.every((w) => have.some((h) => h.startsWith(w)));
}

/** Kinds matched closely (closeMatch); the others keep the fuzzy match, which forgives a typo in a name. */
const CLOSE_KINDS: ReadonlySet<SearchItem['kind']> = new Set(['token', 'page']);

/** How many results of a kind a grouped list shows: with no query, a few of each; else enough to scan. */
export const GROUP_FIRST = 4;
export const GROUP_MAX = 8;

/**
 * Studio's list, grouped by kind in `order` (lib/studio-search STUDIO_KIND_ORDER): with no query, the first few of each
 * kind but tokens; else the best matches of each kind, best first inside its group.
 */
export function rankGrouped(query: string, all: readonly SearchItem[], order: readonly SearchKind[]): SearchItem[] {
  const q = query.trim();
  const rank = (k: SearchKind) => {
    const i = order.indexOf(k);
    return i < 0 ? order.length : i;
  };
  const scored = q
    ? all
        .filter((item) => !CLOSE_KINDS.has(item.kind) || closeMatch(q, item.title) || closeMatch(q, item.keys ?? ''))
        .map((item) => ({ item, s: Math.max(fuzzy(q, item.title), fuzzy(q, item.keys ?? '') - 40) }))
        .filter((x) => x.s >= 0)
    : all.filter((x) => x.kind !== 'token').map((item) => ({ item, s: 0 }));
  const sorted = scored.map((x, i) => ({ ...x, i })).sort((a, b) => rank(a.item.kind) - rank(b.item.kind) || b.s - a.s || a.i - b.i);
  const cap = q ? GROUP_MAX : GROUP_FIRST;
  const taken = new Map<SearchKind, number>();
  return sorted
    .filter((x) => {
      const n = taken.get(x.item.kind) ?? 0;
      taken.set(x.item.kind, n + 1);
      return n < cap;
    })
    .map((x) => x.item);
}
