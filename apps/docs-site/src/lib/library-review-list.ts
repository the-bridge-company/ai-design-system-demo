// The List of Library review as chapters (owner, 2026-11-10, direction C "chapters with a group rail"): each family
// (Foundations, Components, Docs, the same treatment for all three) is a chapter with its line icon, its name, its
// count, one plain line on what it holds and, on its end, the products it reaches, named once. One card per family:
// the group name (Colors, Spacing, a component) sits in a left rail beside its rows, so ten groups never make ten
// cards. Families in this order: Foundations (colors, spacing, corners, type, elevation, motion, brands), Components
// (one group per component), Docs. Inside a family the most recent group comes first. The lead's own sections (For you
// to decide, Yours, Published) keep their order, each its own chapter without a rail. The tally at the end of the
// filters row says how many pieces wait, split by family. The same chapters in Decided and in the designer's view.
// Pure: no DOM. Read by components/ds/studio/LibraryReview.tsx (ListView, OneByOne). Tested in library-review-list.test.ts.
import { askersOf } from './library-askers';
import { canDecide, type PieceGroup, type ReviewFilters, type ReviewPiece, type Viewer } from './library-review';
import type { Measured, Reach } from './library-reach';

export type Family = 'foundations' | 'components' | 'docs' | 'sections';
type IconOf = 'grid' | 'diamonds' | 'doc';

/** A family's chapter name. Docs is a family like the others; its one group named Docs leaves the rail empty. */
export const FAMILY_LABEL: Record<Family, string | null> = { foundations: 'Foundations', components: 'Components', docs: 'Docs', sections: null };

/** The one plain line under a family's name. */
export const FAMILY_NOTE: Record<Family, string | null> = {
  foundations: 'Colors, spacing and type every screen uses',
  components: 'Building blocks teams put on their screens',
  docs: 'Guidance on how and when to use a piece',
  sections: null,
};

/** A family's line icon, the one its page has in the side nav (brand/icons.ts): Tokens' grid, Components' diamonds, a doc. */
export const FAMILY_ICON: Record<Family, IconOf | null> = { foundations: 'grid', components: 'diamonds', docs: 'doc', sections: null };

const FOUNDATIONS = new Set(['colors', 'spacing', 'corners', 'type', 'elevation', 'motion', 'brands', 'library']);

/** Which family a group belongs to. */
export function familyOf(g: Pick<PieceGroup, 'label' | 'section' | 'key'>): Family {
  if (g.section !== 'decide' || g.key === 'decide') return 'sections';
  const label = g.label.toLowerCase();
  if (label === 'docs') return 'docs';
  if (FOUNDATIONS.has(label)) return 'foundations';
  return 'components';
}

/** The family of one piece, from its group (its category). */
export const familyOfPiece = (p: Pick<ReviewPiece, 'category'>): Exclude<Family, 'sections'> => familyOf({ key: 'g', label: p.category, section: 'decide' }) as Exclude<Family, 'sections'>;

/** The most recent date of a piece: its own, or its askers'. NaN when Bridge knows none. */
export function recencyOf(p: ReviewPiece): number {
  const times = [p.at, ...askersOf(p).map((a) => a.at)].map((t) => (t ? Date.parse(t) : NaN)).filter(Number.isFinite);
  return times.length ? Math.max(...times) : NaN;
}

const groupRecency = (g: PieceGroup) => {
  const t = g.pieces.map(recencyOf).filter(Number.isFinite);
  return t.length ? Math.max(...t) : NaN;
};

export interface FamilyBlock {
  family: Family;
  label: string | null;
  groups: PieceGroup[];
}

/** The groups in families, in the order Foundations, Components, Docs; most recent block first inside a family. */
export function familiesOf(groups: readonly PieceGroup[]): FamilyBlock[] {
  const order: Family[] = ['sections', 'foundations', 'components', 'docs'];
  const by = new Map<Family, PieceGroup[]>();
  for (const g of groups) {
    const f = familyOf(g);
    by.set(f, [...(by.get(f) ?? []), g]);
  }
  return order
    .filter((f) => by.has(f))
    .map((f) => {
      const list = by.get(f)!;
      const sorted =
        f === 'sections'
          ? list
          : list
              .map((g, i) => ({ g, i, t: groupRecency(g) }))
              .sort((a, b) => (Number.isFinite(a.t) && Number.isFinite(b.t) ? b.t - a.t || a.i - b.i : Number.isFinite(a.t) ? -1 : Number.isFinite(b.t) ? 1 : a.i - b.i))
              .map((x) => x.g);
      return { family: f, label: FAMILY_LABEL[f], groups: sorted };
    });
}

/** The columns a list shows: only the ones some row fills. */
export function shownColumns(o: { state: boolean; next: boolean; action: boolean }): ('state' | 'next' | 'action')[] {
  return (['state', 'next', 'action'] as const).filter((k) => o[k]);
}

/**
 * A chapter of the List: a family (its icon, name, line and groups in a rail), or one of the lead's own sections
 * (For you to decide, Yours, Published), which has no rail: its rows come from every family.
 */
export interface Chapter {
  key: string;
  family: Family;
  label: string;
  note: string | null;
  icon: IconOf | null;
  groups: PieceGroup[];
  rail: boolean;
}

export function chaptersOf(groups: readonly PieceGroup[]): Chapter[] {
  return familiesOf(groups).flatMap((f): Chapter[] =>
    f.family === 'sections'
      ? f.groups.map((g) => ({ key: g.key, family: f.family, label: g.label, note: g.note, icon: null, groups: [g], rail: false }))
      : [{ key: f.family, family: f.family, label: f.label ?? '', note: FAMILY_NOTE[f.family], icon: FAMILY_ICON[f.family], groups: f.groups, rail: true }],
  );
}

/** The rail's group name, or nothing when the chapter already says it (the one Docs group of Docs). */
export const railLabel = (g: Pick<PieceGroup, 'label'>, c: Pick<Chapter, 'label'>): string | null => (g.label.toLowerCase() === c.label.toLowerCase() ? null : g.label);

const FAMILY_ORDER: Exclude<Family, 'sections'>[] = ['foundations', 'components', 'docs'];

/** The tally at the end of the filters row: one number, its words, and its split by family as icon counts. */
export interface Tally {
  /** The number in Fraunces, or null when nothing is counted (the words say it: "Nothing waits for you"). */
  n: number | null;
  words: string;
  families: { family: Exclude<Family, 'sections'>; icon: IconOf; label: string; n: number }[];
  /** The viewer's own pieces that wait on someone else: "3 of yours wait on others". */
  note: string | null;
}

export function tallyOf(all: readonly ReviewPiece[], shown: readonly ReviewPiece[], v: Viewer, f: Pick<ReviewFilters, 'status'>): Tally {
  const decided = f.status.length === 1 && f.status[0] === 'decided';
  const plain = !v.reviews || decided;
  const counted = plain ? [...shown] : shown.filter((p) => canDecide(p, v));
  const n = counted.length;
  const words = !v.reviews ? (n === 1 ? 'piece' : 'pieces') : decided ? 'decided' : n === 1 ? 'waits for you' : 'wait for you';
  const families = FAMILY_ORDER.map((family) => ({ family, icon: FAMILY_ICON[family]!, label: FAMILY_LABEL[family]!, n: counted.filter((p) => familyOfPiece(p) === family).length })).filter((x) => x.n > 0);
  const own = plain ? 0 : all.filter((p) => p.mine && p.state === 'waiting').length;
  const note = own ? `${own} of yours ${own === 1 ? 'waits' : 'wait'} on others` : null;
  if (!n) return { n: null, words: !v.reviews ? 'No piece' : decided ? 'Nothing decided' : 'Nothing waits for you', families: [], note };
  return { n, words, families, note };
}

const listWords = (xs: readonly string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/**
 * The tally as the page's summary sentence, under the title: "12 wait for you:" in bold, then the split in words,
 * "5 foundations, 5 components and 2 docs." (no icons alone: the words say what each number counts).
 */
export function tallySentence(t: Tally): { strong: string; rest: string } {
  const note = t.note ? ` ${t.note.replace(/^./, (c) => c.toUpperCase())}.` : '';
  if (t.n === null) return { strong: `${t.words}.`, rest: note.trim() };
  const split = t.families.map((f) => `${f.n} ${f.label.toLowerCase()}`);
  const fix = (x: string) => (/^1 /.test(x) ? x.replace(/s$/, '') : x);
  return { strong: `${t.n} ${t.words}${split.length ? ':' : '.'}`, rest: `${split.length ? `${listWords(split.map(fix))}.` : ''}${note}`.trim() };
}

/**
 * A product's mark: the initial of its last word ("Acme CRM" C). When two products would share an initial, both get
 * two letters ("Acme Prints" Pr, "Acme Pay" Pa), so no two marks read the same.
 */
export function productMarks(names: readonly string[]): Map<string, string> {
  const last = (n: string) => n.trim().split(/\s+/).pop() ?? n;
  const one = (n: string) => last(n).charAt(0).toUpperCase();
  const two = (n: string) => {
    const w = last(n);
    return w.charAt(0).toUpperCase() + w.charAt(1).toLowerCase();
  };
  const list = [...new Set(names.filter(Boolean))];
  const count = new Map<string, number>();
  for (const n of list) count.set(one(n), (count.get(one(n)) ?? 0) + 1);
  return new Map(list.map((n) => [n, (count.get(one(n)) ?? 0) > 1 ? two(n) : one(n)]));
}

/** How many product marks a chapter shows before "+N". */
export const MARKS_SHOWN = 5;

export interface ChapterReach {
  products: { key: string; name: string }[];
  /** The marks shown, at most MARKS_SHOWN, then "+N". */
  shown: { key: string; name: string }[];
  more: number;
  /** "Acme Prints, Acme CRM" up to three products, else "8 products". Null: not on a screen yet. */
  names: string | null;
}

/**
 * What a chapter reaches, named once on its end: the products where a row changes a screen, as measured
 * (lib/library-reach measuredReach); while a row is still measured, the products it reaches by the rule (a change to
 * what exists, or a new piece some screen asked for). None: the chapter says "Not on a screen yet".
 */
export function chapterReach(rows: readonly { reach: Reach; measured: Pick<Measured, 'status' | 'products'> }[], max = MARKS_SHOWN): ChapterReach {
  const products: { key: string; name: string }[] = [];
  const add = (p: { key: string; name: string }) => {
    if (!products.some((x) => x.key === p.key)) products.push({ key: p.key, name: p.name });
  };
  for (const { reach: r, measured: m } of rows) {
    if (m.status === 'measured' || m.status === 'asked') {
      for (const p of m.products) if (p.screens.length) add(p);
    } else if (m.status === 'measuring' && !r.stays && (r.everywhere || r.screens > 0)) for (const p of r.products) add(p);
  }
  if (!products.length) return { products, shown: [], more: 0, names: null };
  return { products, shown: products.slice(0, max), more: Math.max(products.length - max, 0), names: products.length <= 3 ? products.map((p) => p.name).join(', ') : `${products.length} products` };
}

/**
 * The small group title above pieces in the side list, said once: a group of one piece whose title already starts with
 * the group's name ("Timeline" over "Timeline", "Avatar" over "Avatar: xl size") has no title of its own.
 */
export function sideLabel(label: string | null, pieces: readonly { title: string }[]): string | null {
  if (!label) return null;
  const only = pieces.length === 1 ? pieces[0]!.title.trim().toLowerCase() : null;
  const name = label.trim().toLowerCase();
  return only !== null && (only === name || only.startsWith(`${name}:`) || only.startsWith(`${name} `)) ? null : label;
}
