// Many explorations asking for one piece (owner, 2026-11-09, worst case 10+): Library review never wraps a row onto
// several lines of tags, never draws a tag per way. The rules:
//   - List: the most recent exploration as a tag, then a quiet "+N more" that opens every one, grouped by product;
//   - One by one, its side list: "Contact page summary and 11 more"; the detail: "Asked by 12 explorations" with the
//     first 3 faces, then the full list on demand;
//   - a conflict says its number of ways ("3 ways");
//   - the Map folds an exploration column past 10 boxes into one "+N more" box that unfolds on click.
// Pure: no DOM. Read by components/ds/studio/LibraryReview.tsx, LibraryMap.tsx and LibraryReach.tsx. Tested in
// library-askers.test.ts.
import type { AskedBy, ReviewPiece } from './library-review';

/** Every exploration that asked for a piece, the most recent first (one without a date keeps its place, last). */
export function askersOf(p: Pick<ReviewPiece, 'asked' | 'also'>): AskedBy[] {
  const all = p.asked ? [p.asked, ...(p.also ?? [])] : [...(p.also ?? [])];
  const seen = new Set<string>();
  const list = all.filter((a) => (seen.has(a.key) ? false : (seen.add(a.key), true)));
  const t = (a: AskedBy) => (a.at ? Date.parse(a.at) : NaN);
  return list
    .map((a, i) => ({ a, i }))
    .sort((x, y) => {
      const tx = t(x.a);
      const ty = t(y.a);
      if (Number.isFinite(tx) && Number.isFinite(ty)) return ty - tx || x.i - y.i;
      if (Number.isFinite(tx)) return -1;
      if (Number.isFinite(ty)) return 1;
      return x.i - y.i;
    })
    .map((x) => x.a);
}

/** The List cell: the first exploration as a tag and the rest counted ("+11 more"), never a second line of tags. */
export function askedCell(list: readonly AskedBy[]): { first: AskedBy | null; more: number; label: string | null } {
  const more = Math.max(list.length - 1, 0);
  return { first: list[0] ?? null, more, label: more ? `+${more} more` : null };
}

export interface AskerGroup {
  product: string;
  askers: AskedBy[];
}

/** The "+N more" popover and the detail's full list: grouped by product (alphabetical), most recent first inside. */
export function groupAskers(list: readonly AskedBy[]): AskerGroup[] {
  const by = new Map<string, AskedBy[]>();
  for (const a of list) {
    const k = a.product ?? 'Library';
    by.set(k, [...(by.get(k) ?? []), a]);
  }
  return [...by].sort((a, b) => a[0].localeCompare(b[0])).map(([product, askers]) => ({ product, askers }));
}

/** The side list of One by one: "Contact page summary and 11 more". */
export function askedSubline(list: readonly AskedBy[]): string | null {
  if (!list.length) return null;
  return list.length === 1 ? list[0]!.name : `${list[0]!.name} and ${list.length - 1} more`;
}

/** The detail's line when several explorations ask: "Asked by 12 explorations". */
export const askedCountLine = (n: number): string => `Asked by ${n} ${n === 1 ? 'exploration' : 'explorations'}`;

/** The faces stacked before that line. */
export const FACES_SHOWN = 3;

/** A conflict's tag: its number of ways, never one tag per way. */
export const waysTag = (ways: number): string => `${ways} ways`;

/** How many boxes an exploration column of the Map shows before it folds the rest into "+N more". */
export const MAP_SOURCES_SHOWN = 10;

/**
 * A Map column that would hold more than `max` boxes: the first max - 1 and one "+N more" box (so the column never
 * grows past max boxes). Unfolded: every box.
 */
export function foldColumn<T>(items: readonly T[], open: boolean, max = MAP_SOURCES_SHOWN): { shown: T[]; more: number } {
  if (open || items.length <= max) return { shown: [...items], more: 0 };
  return { shown: items.slice(0, max - 1), more: items.length - (max - 1) };
}

/** How many rows the popover shows before it scrolls inside. */
export const POPOVER_ROWS = 8;
