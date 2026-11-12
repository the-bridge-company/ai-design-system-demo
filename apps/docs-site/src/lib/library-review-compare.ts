// One by one, a conflict (owner, 2026-11-10, direction D2 "compare stage"): two or more explorations change the same
// part of the same component differently. Above, one compare stage: Overlay by default for room inside (the chosen
// way's component drawn for real at 150%, the other ways' content boxes outlined and labelled "Today and Sofia: 20 px",
// "Leo: 12 px (Compact)"), or the ways Side by side. Below, one radio list: a colour key, the person, the value and its word
// ("20 px roomier") and where it is used; today first as the reference; then "Both, as two sizes". One footer: who is
// told, "Comment to both", and one primary that names the outcome ("Keep Sofia's way"). Words are the exploration
// page's own (lib/library-impact-view.ts: roomier, tighter, keep both as sizes).
// Pure: no DOM. Read by components/ds/studio/LibraryReview.tsx (Detail). Tested in library-review-compare.test.ts.
import { wayWords, type WayLook } from './library-impact-view';
import { baselineOf, knownLibraryOptions } from './library-baseline';
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
  /** A way whose value is today's: keeping it changes nothing in the library ("20 px · same as today"). */
  sameAsToday: boolean;
  /**
   * The library option a way's value already is, other than today's default ("Compact"): the way needs nothing new,
   * its screen uses that option ("Leo's way: 12 px, Compact in the library"). Null otherwise.
   */
  libraryOption: string | null;
}

export interface CompareView {
  /** The component the ways change ("Card"). */
  component: string;
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
  // Today's value, the one baseline the exploration page also reads (lib/library-baseline): the library's own value,
  // else the check's, else the library's component as it renders now (measured by the page), never a guess.
  const today = baselineOf(c.component, c.property, num(c.today), measuredToday);
  const values = c.ways.map((w) => num(w.value));
  const known = values.filter((v): v is number => v !== null);
  const part = p.kind.replace(/\s+change$/i, '') || 'This part';
  // An option the library already has at a way's value (Card padding Compact 12 px): said plainly, never "tighter".
  const existing = (value: number | null) => (value === null ? null : (knownLibraryOptions(c.component, c.property)?.find((o) => o.px === value && !o.isDefault)?.name ?? null));
  const ways: CompareOption[] = c.ways.map((w, i) => {
    const value = values[i] ?? null;
    const same = value !== null && today !== null && value === today;
    const option = same ? null : existing(value);
    return {
      key: w.key,
      who: w.designer,
      name: `${w.designer}'s way`,
      value,
      valueText: value === null ? w.value : `${value} px`,
      // "12 px Compact in the library": the same pattern as today's "20 px in the library", on one line in its column.
      words: same ? 'same as today' : option ? `${option} in the library` : wordOf(c.property, value, today, known),
      where: { exploration: w.exploration, product: w.product, href: w.key === p.asked?.key ? (p.asked?.href ?? null) : null },
      hue: i + 1,
      sameAsToday: same,
      libraryOption: option,
    };
  });
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
        sameAsToday: false,
        libraryOption: null,
      }
    : null;
  const people = [...new Set(c.ways.map((w) => w.designer))];
  return {
    component: c.component,
    part,
    overlay: PAD.test(c.property.toLowerCase()) && all,
    today: { key: 'today', who: null, name: 'Today', value: today, valueText: today === null ? null : `${today} px`, words: 'in the library', where: { text: todayWhere }, hue: 0, sameAsToday: false, libraryOption: null },
    ways,
    both,
    told: `${peopleWords(people)} ${people.length === 1 ? 'is' : 'are'} told.`,
    people,
  };
}

/**
 * The one primary: it names the outcome of the option selected, in the selected row's own words. "Keep Sofia's way",
 * "Keep both as sizes"; a way equal to today still names the way picked, then says it changes nothing in the library:
 * "Keep Sofia's way, same as today" (never "Keep today's Card" while Sofia's way is the one selected); a way equal to
 * an option the library has names that option: "Keep Leo's way, the library's Compact".
 */
export function compareKeepLabel(pick: string, ways: readonly (Pick<CompareOption, 'key' | 'who' | 'sameAsToday'> & { libraryOption?: string | null })[], component = 'piece'): string {
  if (pick === BOTH) return ways.length === 2 ? 'Keep both as sizes' : 'Keep all as sizes';
  if (pick === 'today') return `Keep today's ${component}`;
  const w = ways.find((x) => x.key === pick);
  const name = w?.who ? `Keep ${w.who}'s way` : 'Keep this way';
  if (w?.sameAsToday) return `${name}, same as today`;
  return w?.libraryOption ? `${name}, the library's ${w.libraryOption}` : name;
}

/**
 * The stage's outlines and their labels, one per value: options with the same value share one outline and one label,
 * today first ("Today and Sofia: 20 px"), so no two outlines or labels sit on top of each other; a value the library
 * already has as another option names it ("Leo: 12 px (Compact)"). Largest first.
 */
export interface StageLabel {
  value: number;
  hue: number;
  keys: string[];
  /** The whole label, as one line of text ("Today and Sofia: 20 px"). */
  label: string;
  /** Whose look it is ("Today and Sofia"), and the library option the value already is ("Compact"), apart for the caption. */
  who: string;
  option: string | null;
}

export function stageLabels(view: Pick<CompareView, 'today' | 'ways'>): StageLabel[] {
  const out: { value: number; hue: number; keys: string[]; names: string[]; option: string | null }[] = [];
  for (const o of [view.today, ...view.ways]) {
    if (o.value === null || o.hue === null) continue;
    const at = out.find((x) => x.value === o.value);
    const name = o.who ?? 'Today';
    if (at) {
      at.keys.push(o.key);
      at.names.push(name);
    } else out.push({ value: o.value, hue: o.hue, keys: [o.key], names: [name], option: o.libraryOption ?? null });
  }
  return out
    .sort((a, b) => b.value - a.value)
    .map((x) => ({ value: x.value, hue: x.hue, keys: x.keys, label: `${peopleWords(x.names)}: ${x.value} px${x.option ? ` (${x.option})` : ''}`, who: peopleWords(x.names), option: x.option }));
}

// ---------------------------------------------------------------------------------------------------------------
// The checked rows (owner, 2026-11-12): every row is a checkbox, today included; no "Both" row. What is checked
// drives the stage (one look per value) and says the outcome; it records the pick values the exploration page and
// core chooseLibraryWayOnGitHub already read: "today", one way's key, "both" or "sizes:<key> <key>" (keptKeys).

/** The pick that keeps today's component as it is (lib/library-impact-view KEEP_TODAY). */
export const TODAY = 'today';

type Rows = Pick<CompareView, 'today' | 'ways'>;
const rowsOf = (view: Rows) => [view.today, ...view.ways];

/**
 * What the stage starts with: today and the way that differs most from it, so the first look is the real choice. A way
 * equal to today adds nothing to look at. Without today's value, the first way.
 */
export function defaultChecked(view: Rows): string[] {
  const t = view.today.value;
  const differ = view.ways.filter((w) => w.value === null || t === null || w.value !== t);
  if (!differ.length) return [view.today.key];
  const far = t === null ? differ[0]! : differ.reduce((a, b) => (Math.abs((b.value ?? t) - t) > Math.abs((a.value ?? t) - t) ? b : a));
  return [view.today.key, far.key];
}

/** The checked rows from a recorded pick: what the decision kept, today included when it stays the default. */
export function checkedOfPick(pick: string, view: Rows): string[] {
  if (pick === TODAY) return [view.today.key];
  if (pick === BOTH) return rowsOf(view).map((o) => o.key);
  if (pick.startsWith('sizes:')) {
    const keys = pick
      .slice('sizes:'.length)
      .split(/\s+/)
      .map((k) => k.split('=')[0]!);
    return [view.today.key, ...view.ways.filter((w) => keys.includes(w.key)).map((w) => w.key)];
  }
  return view.ways.some((w) => w.key === pick) ? [pick] : [];
}

/**
 * The stage's looks for the checked rows: one per value, in row order. Options with the same value share one look and
 * its label names all of them ("Today and Sofia: 20 px"), checked or not, since they look the same.
 */
export function checkedLooks(view: Rows, checked: readonly string[]): StageLabel[] {
  const order = rowsOf(view).map((o) => o.key);
  const first = (keys: string[]) => Math.min(...keys.filter((k) => checked.includes(k)).map((k) => order.indexOf(k)));
  return stageLabels(view)
    .filter((l) => l.keys.some((k) => checked.includes(k)))
    .sort((a, b) => first(a.keys) - first(b.keys));
}

/**
 * What the checked rows record, on the pick values that exist: null with nothing checked; "today" when nothing new is
 * kept; one way's key when one new value replaces today's; else the new values as sizes next to today's ("both" when
 * that is every way). A way equal to today counts as today.
 */
export function checkedPick(view: Rows, checked: readonly string[]): string | null {
  const on = rowsOf(view).filter((o) => checked.includes(o.key));
  if (!on.length) return null;
  const t = view.today.value;
  const isToday = (o: CompareOption) => o.key === view.today.key || (t !== null && o.value === t);
  const adds = view.ways.filter((w) => checked.includes(w.key) && !isToday(w));
  if (!adds.length) return TODAY;
  const id = (o: CompareOption) => (o.value === null ? o.key : `${o.value}`);
  const values = new Set(adds.map(id));
  if (!on.some(isToday) && values.size === 1) return adds[0]!.key;
  // Every way with a kept value, so each exploration keeps its own (same value, two screens).
  const kept = view.ways.filter((w) => !isToday(w) && values.has(id(w)));
  return kept.length === view.ways.length ? BOTH : `sizes:${kept.map((w) => w.key).join(' ')}`;
}

const NUMBER_WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six'];
const listOf = (xs: readonly (string | number)[]) => (xs.length < 2 ? `${xs[0] ?? ''}` : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** The values a sizes pick leaves in the library, today's included, smallest first. */
function sizesOf(pick: string, view: Rows): number[] {
  const keys = checkedOfPick(pick, view);
  const values = [...view.ways.filter((w) => keys.includes(w.key)).map((w) => w.value), view.today.value];
  return [...new Set(values.filter((v): v is number => v !== null))].sort((a, b) => a - b);
}

/**
 * The ways a sizes pick adds next to today's value, when every one of them is an option the library already has
 * (Leo's 12 px is Card's Compact): the pick adds nothing to the library, those screens use the option. Null otherwise.
 */
function existingOnly(pick: string, view: Rows): CompareOption[] | null {
  if (pick === TODAY || view.ways.some((w) => w.key === pick)) return null;
  const keys = checkedOfPick(pick, view);
  const t = view.today.value;
  const adds = view.ways.filter((w) => keys.includes(w.key) && !(t !== null && w.value === t));
  return adds.length && adds.every((w) => w.libraryOption) ? adds : null;
}

/** "Leo's screen uses Compact (12 px)", "Leo's and Ann's screens use Compact (12 px) and None (0 px)". */
const usesLine = (adds: readonly CompareOption[]) => {
  const owners = [...new Set(adds.map((w) => `${w.who ?? 'This'}'s`))];
  const options = [...new Set(adds.map((w) => `${w.libraryOption} (${w.value} px)`))];
  return `${listOf(owners)} ${owners.length === 1 ? 'screen uses' : 'screens use'} ${listOf(options)}`;
};

/**
 * The decision line under the rows, from the checked rows: "Keep Leo's way: 12 px everywhere", "Keep 12 and 20 px as
 * two sizes, today's 20 stays the default", "Keep today's Card: 20 px everywhere". A value the library already has
 * as an option says so instead of a new size: "Nothing new in the library: Leo's screen uses Compact (12 px), today's
 * 20 stays the default". Null with nothing checked.
 */
export function checkedOutcome(view: Rows & Pick<CompareView, 'component'>, checked: readonly string[]): string | null {
  const pick = checkedPick(view, checked);
  if (pick === null) return null;
  const t = view.today.value;
  if (pick === TODAY) return t === null ? `Keep today's ${view.component} as it is` : `Keep today's ${view.component}: ${t} px everywhere`;
  const one = view.ways.find((w) => w.key === pick);
  if (one) {
    if (one.value === null) return `Keep ${one.name}`;
    return one.libraryOption ? `Keep ${one.name}: the library's ${one.libraryOption}, ${one.value} px everywhere` : `Keep ${one.name}: ${one.value} px everywhere`;
  }
  const existing = existingOnly(pick, view);
  if (existing) return `Nothing new in the library: ${usesLine(existing)}${t === null ? '' : `, today's ${t} stays the default`}`;
  const values = sizesOf(pick, view);
  return `Keep ${listOf(values)} px as ${NUMBER_WORDS[values.length] ?? values.length} sizes${t === null ? '' : `, today's ${t} stays the default`}`;
}

/**
 * The one primary for the checked rows, naming the outcome: "Keep Leo's way", "Keep today's Card", "Keep both as
 * sizes", "Keep 3 sizes"; "Keep today's Card, Leo uses Compact" when the other value is an option the library has;
 * "Decide" (off) with nothing checked.
 */
export function checkedKeepLabel(view: Rows & Pick<CompareView, 'component'>, checked: readonly string[]): string {
  const pick = checkedPick(view, checked);
  if (pick === null) return 'Decide';
  if (pick === TODAY) return `Keep today's ${view.component}`;
  if (view.ways.some((w) => w.key === pick)) return compareKeepLabel(pick, view.ways, view.component);
  const existing = existingOnly(pick, view);
  if (existing) {
    const who = [...new Set(existing.map((w) => w.who ?? 'This screen'))];
    const opts = [...new Set(existing.map((w) => w.libraryOption!))];
    return `Keep today's ${view.component}, ${listOf(who)} ${who.length === 1 ? 'uses' : 'use'} ${listOf(opts)}`;
  }
  const n = sizesOf(pick, view).length;
  return n === 2 ? 'Keep both as sizes' : `Keep ${n} sizes`;
}

/** The words of a recorded pick, for the note both designers read: "Leo's way (12 px)", "today's Card", "12 and 20 px as two sizes". */
export function pickWords(pick: string, view: Rows & Pick<CompareView, 'component'>): string {
  if (pick === TODAY) return `today's ${view.component}`;
  const one = view.ways.find((w) => w.key === pick);
  if (one) return one.valueText ? `${one.name} (${one.valueText}${one.libraryOption ? `, the library's ${one.libraryOption}` : ''})` : one.name;
  const existing = existingOnly(pick, view);
  if (existing) return `today's ${view.component}, ${usesLine(existing)}`;
  const out = checkedOutcome(view, checkedOfPick(pick, view));
  return out ? out.replace(/^Keep /, '') : 'every way, as sizes';
}
