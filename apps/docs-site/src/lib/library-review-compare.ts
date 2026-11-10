// One by one, a conflict (owner, 2026-11-10, direction D2 "compare stage"): two or more explorations change the same
// part of the same component differently. Above, one compare stage: Overlay by default for room inside (the chosen
// way's component drawn for real at 150%, the other ways' content boxes outlined and labelled "20 Sofia", "16 Today",
// "12 Leo"), or the ways Side by side. Below, one radio list: a colour key, the person, the value and its word
// ("20 px roomier") and where it is used; today first as the reference; then "Both, as two sizes". One footer: who is
// told, "Comment to both", and one primary that names the outcome ("Keep Sofia's way"). Words are the exploration
// page's own (lib/library-impact-view.ts: roomier, tighter, keep both as sizes).
// Pure: no DOM. Read by components/ds/studio/LibraryReview.tsx (Detail). Tested in library-review-compare.test.ts.
import { wayWords, type WayLook } from './library-impact-view';
import { peopleWords } from './library-askers';
import type { ReviewPiece } from './library-review';

/** The pick that keeps every way, each as its own size (core chooseLibraryWayOnGitHub, lib/library-impact-view keptKeys). */
export const BOTH = 'both';

/** The stage's scale: the component drawn at 150% so a 4 px difference reads. */
export const STAGE_SCALE = 1.5;

export interface CompareOption {
  /** The way's exploration key, "today", or BOTH. */
  key: string;
  /** The person, for a way. */
  who: string | null;
  /** "Today", "Sofia's way", "Both, as two sizes". */
  name: string;
  /** The value in pixels, when Bridge knows it. */
  value: number | null;
  /** "20 px", "12 and 20 px", or null when unknown. */
  valueText: string | null;
  /** After the value: "roomier", "in the library", "today's 16 stays the default". */
  words: string;
  /** Where it is used: an exploration (its screen) or plain words ("Every screen", "Each screen keeps its way"). */
  where: { exploration: string; product: string; href: string | null } | { text: string };
  /** The colour key of the way: 0 for today, 1, 2... for each way in order; null for Both. */
  hue: number | null;
}

export interface CompareView {
  /** "Room inside": the part that differs, said once above the stage. */
  part: string;
  /** Overlay can draw it: room inside or the space between items, every value known. */
  overlay: boolean;
  today: CompareOption;
  ways: CompareOption[];
  /** "Both, as two sizes" (every way kept as its own size), when every way's value is known. */
  both: CompareOption | null;
  /** "Sofia and Leo are told." */
  told: string;
  people: string[];
}

const num = (v: string | null | undefined): number | null => {
  if (v === null || v === undefined) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

const PAD = /^(padding|gap|row-gap|column-gap)/;

/** A way's word against today (else against the other ways): roomier or tighter, rounder or squarer, bigger or smaller. */
function wordOf(property: string, value: number | null, ref: number | null, values: number[]): string {
  if (value === null) return '';
  const prop = property.toLowerCase();
  if (PAD.test(prop)) {
    const looks: WayLook[] = values.map((padding) => ({ padding, gap: null, radius: null, borderless: false, filled: false, shadowless: false }));
    const i = values.indexOf(value);
    const w = wayWords(looks, ref)[i]?.size ?? '';
    return /^(Roomier|Tighter)$/.test(w) ? w.toLowerCase() : '';
  }
  const base = ref ?? (values.length > 1 ? (value === Math.min(...values) ? Math.max(...values) : Math.min(...values)) : null);
  if (base === null || base === value) return '';
  const more = value > base;
  if (prop.includes('radius')) return more ? 'rounder' : 'squarer';
  if (prop === 'font-size') return more ? 'bigger' : 'smaller';
  return more ? 'larger' : 'smaller';
}

/** The conflict of a piece as the compare stage and its radio list read it. */
export function compareView(p: Pick<ReviewPiece, 'conflict' | 'kind' | 'asked'>, todayWhere: string, measuredToday: number | null = null): CompareView | null {
  const c = p.conflict;
  if (!c) return null;
  // Today's value: the check's, else the library's component as it renders now (measured by the page), never a guess.
  const today = num(c.today) ?? measuredToday;
  const values = c.ways.map((w) => num(w.value));
  const known = values.filter((v): v is number => v !== null);
  const part = p.kind.replace(/\s+change$/i, '') || 'This part';
  const ways: CompareOption[] = c.ways.map((w, i) => ({
    key: w.key,
    who: w.designer,
    name: `${w.designer}'s way`,
    value: values[i] ?? null,
    valueText: values[i] === null ? w.value : `${values[i]} px`,
    words: wordOf(c.property, values[i] ?? null, today, known),
    where: { exploration: w.exploration, product: w.product, href: w.key === p.asked?.key ? (p.asked?.href ?? null) : null },
    hue: i + 1,
  }));
  const sorted = [...known].sort((a, b) => a - b);
  const all = known.length === c.ways.length && c.ways.length >= 2;
  const both: CompareOption | null = all
    ? {
        key: BOTH,
        who: null,
        name: c.ways.length === 2 ? 'Both, as two sizes' : `All ${c.ways.length}, as sizes`,
        value: null,
        valueText: `${sorted.slice(0, -1).join(', ')} and ${sorted[sorted.length - 1]} px`,
        words: today !== null ? `today's ${today} stays the default` : '',
        where: { text: 'Each screen keeps its way' },
        hue: null,
      }
    : null;
  const people = [...new Set(c.ways.map((w) => w.designer))];
  return {
    part,
    overlay: PAD.test(c.property.toLowerCase()) && all,
    today: { key: 'today', who: null, name: 'Today', value: today, valueText: today === null ? null : `${today} px`, words: 'in the library', where: { text: todayWhere }, hue: 0 },
    ways,
    both,
    told: `${peopleWords(people)} ${people.length === 1 ? 'is' : 'are'} told.`,
    people,
  };
}

/** The one primary: it names the outcome. "Keep Sofia's way", "Keep both as sizes". */
export function compareKeepLabel(pick: string, ways: readonly { key: string; who: string | null }[]): string {
  if (pick === BOTH) return ways.length === 2 ? 'Keep both as sizes' : 'Keep all as sizes';
  const w = ways.find((x) => x.key === pick);
  return w?.who ? `Keep ${w.who}'s way` : 'Keep this way';
}
