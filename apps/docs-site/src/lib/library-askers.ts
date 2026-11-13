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
import { peopleNames } from './people-line';
import { AGENT_NAME } from './people';

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

/**
 * Who asked, as the List's Asked by cell and the side list's sub line read it (owner, 2026-11-10, one kind of content
 * per column): the person's face wearing the product's mark, then the exploration's name; a lead's own change is the
 * person alone; a conflict is its people ("Sofia and Leo"); several explorations are three faces and "+N".
 */
export type AskedFaces =
  | { kind: 'person'; person: string }
  | { kind: 'one'; asker: AskedBy }
  | { kind: 'people'; people: string[]; words: string }
  | { kind: 'many'; askers: AskedBy[]; faces: AskedBy[]; more: number; words: string };

/** "Sofia and Leo", "Sofia, Leo and Ann", "Sofia, Leo and 2 others". */
export const peopleWords = peopleNames;

export function askedFaces(p: Pick<ReviewPiece, 'asked' | 'also' | 'conflict' | 'mine' | 'by'>): AskedFaces {
  if (p.conflict) {
    const people = [...new Set(p.conflict.ways.map((w) => w.designer))];
    return { kind: 'people', people, words: peopleWords(people) };
  }
  const list = askersOf(p);
  if (!list.length) return { kind: 'person', person: p.mine ? 'You' : (p.by ?? 'A lead') };
  if (list.length === 1) return { kind: 'one', asker: list[0]! };
  const more = Math.max(list.length - FACES_SHOWN, 0);
  return { kind: 'many', askers: list, faces: list.slice(0, FACES_SHOWN), more, words: more ? `+${more}` : `${list.length} explorations` };
}

/** A compact "+N" tag (owner, 2026-11-10: never "+N more" text) and what it says to a screen reader. */
export const moreTag = (n: number, what = 'explorations'): { tag: string; label: string } => ({ tag: `+${n}`, label: `${n} more ${n === 1 ? what.replace(/s$/, '') : what}` });

/** The face of an asker: the designer, else the exploration (an exploration Bridge knows no designer for). */
export const faceName = (a: Pick<AskedBy, 'designer' | 'name'>): string => a.designer ?? a.name;

/** A person's first name ("Sofia Ramos" -> "Sofia"), as the Asked by column shows it. */
export const firstName = (name: string): string => (name.trim() === AGENT_NAME ? AGENT_NAME : name.trim().split(/\s+/)[0] || name);

/** Where a piece came from, as the From column reads it: an exploration (and how many more), or asked directly. */
export type AskedFrom = { kind: 'direct' } | { kind: 'exploration'; first: AskedBy; more: number; all: AskedBy[]; product: string | null };

/**
 * The List's two columns for who asked (owner, 2026-11-12: one kind of info per column, the same anatomy on every
 * row). Asked by: the first person's face and first name, then "+N" when more people asked (a conflict's other
 * designer, other explorations' designers). From: the most recent exploration on one line, its product under it, then
 * "+N" when more explorations asked; a piece no exploration asked for says "Asked directly". The side list of One by
 * one reads the same model on one line: "Sofia · Contact page summary".
 */
export interface AskedColumns {
  /** Whose face and first name the Asked by column shows. */
  person: string;
  /** Every person who asked, first names, the most recent first. */
  people: string[];
  /** People past the first: the "+N" tag after the name. */
  morePeople: number;
  from: AskedFrom;
}

/** The line under the exploration: its product, or "2 products" when the explorations span several. */
function productLine(list: readonly AskedBy[]): string | null {
  const names = [...new Set(list.map((a) => a.product).filter((x): x is string => Boolean(x)))];
  return names.length <= 1 ? (names[0] ?? null) : `${names.length} products`;
}

export function askedColumns(p: Pick<ReviewPiece, 'asked' | 'also' | 'conflict' | 'mine' | 'by'>): AskedColumns {
  const explorations: AskedBy[] = p.conflict
    ? p.conflict.ways.map((w) => ({ key: w.key, name: w.exploration, product: w.product, productKey: null, href: null, designer: w.designer }))
    : askersOf(p);
  const people = [...new Set(explorations.map((a) => a.designer).filter((x): x is string => Boolean(x)).map(firstName))];
  const list = people.length ? people : [p.mine ? 'You' : p.by ? firstName(p.by) : 'A lead'];
  const from: AskedFrom = explorations.length ? { kind: 'exploration', first: explorations[0]!, more: explorations.length - 1, all: explorations, product: productLine(explorations) } : { kind: 'direct' };
  return { person: list[0]!, people: list, morePeople: list.length - 1, from };
}

/** The From column's words for a piece no exploration asked for (a lead's own change). */
export const ASKED_DIRECTLY = 'Asked directly';

/** What a usage guidance draft says where others say who asked: Home's row says the same (home-model guidanceNeed). */
export const DRAFTED_FROM_CODE = 'Drafted it from the code';

/** The From words of a piece no exploration asked for: Claude AI's guidance draft says where it comes from. */
export const directWords = (p: Pick<ReviewPiece, 'source'>): string => (p.source.kind === 'docs' ? DRAFTED_FROM_CODE : ASKED_DIRECTLY);
