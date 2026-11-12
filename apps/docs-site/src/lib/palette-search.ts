// The search palette's ranking (Cmd+K, components/ds/SearchPalette.tsx): a subsequence fuzzy score over titles and
// extra keys, components first, then pages, then tokens. Pure, browser-safe.
import type { SearchItem } from './search';

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

const WEIGHT = { page: 40, component: 60, token: 0 } as const;

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
