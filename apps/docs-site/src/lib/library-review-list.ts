// The List of Library review in blocks (owner, 2026-11-09, Gestalt proximity and similarity): each group (Colors,
// Spacing, a component, Docs) is its own block with space between blocks and a plain heading above it, never a grey
// band. Blocks sit in families, each with a small overline, in this order: Foundations (colors, spacing, corners,
// type, elevation, motion, brands), then Components (one block per component), then Docs. Inside a family the most
// recent block comes first. The lead's own sections (For you to decide, Yours, Published) keep their order, with no
// overline. The same blocks in Decided and in the designer's view.
// Pure: no DOM. Read by components/ds/studio/LibraryReview.tsx (ListView). Tested in library-review-list.test.ts.
import { askersOf } from './library-askers';
import type { PieceGroup, ReviewPiece } from './library-review';

export type Family = 'foundations' | 'components' | 'docs' | 'sections';

/** Docs has one block named Docs: no overline that would say it twice. */
export const FAMILY_LABEL: Record<Family, string | null> = { foundations: 'Foundations', components: 'Components', docs: null, sections: null };

const FOUNDATIONS = new Set(['colors', 'spacing', 'corners', 'type', 'elevation', 'motion', 'brands', 'library']);

/** Which family a group belongs to. */
export function familyOf(g: Pick<PieceGroup, 'label' | 'section' | 'key'>): Family {
  if (g.section !== 'decide' || g.key === 'decide') return 'sections';
  const label = g.label.toLowerCase();
  if (label === 'docs') return 'docs';
  if (FOUNDATIONS.has(label)) return 'foundations';
  return 'components';
}

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
