// The exploration page's summary of "What this changes in the library" (two reviews, board F of 2026-11-25): a count,
// one sentence, the three open pieces that need the most thought, and one way to Library review, filtered on this
// exploration, where every decision is made. The page never decides here: with twenty pieces a stack of compares
// buried the design review, and Library review already holds the List, the Map and the compare.
// Pure: the section's view in, the summary out. Painted by components/ds/studio/LibraryImpact.tsx (LibrarySummary).
// Tested in library-summary.test.ts.
import type { ImpactRowView, LibraryImpactView, PieceTag } from './library-impact-view';

type RowsView = Extract<LibraryImpactView, { state: 'rows' }>;

/** At most this many open pieces are shown; the rest are a count ("and 17 more"). */
export const SUMMARY_ROWS = 3;

export interface SummaryRow {
  id: string;
  name: string;
  /** What changes, in one line: the row's own summary. */
  what: string;
  tag: PieceTag | null;
  /** The piece in Library review (One by one on it), or null when the page has no address for it. */
  href: string | null;
}

export interface LibrarySummaryView {
  /** Pieces the library decides on (a piece used as it is never counts). */
  total: number;
  decided: number;
  /** "12 of 20 decided", "20 to decide", "All 20 decided". */
  count: string;
  /** Under the title while some wait: what the open pieces are. Null once all are decided. */
  sentence: string | null;
  /** The open pieces to show, the ones that need the most thought first: two ways, then new pieces, then changes. */
  rows: SummaryRow[];
  /** "and 17 more", or null. */
  more: string | null;
  /** The button to Library review: "Decide in Library review", "Continue in Library review". Null once all decided. */
  cta: string | null;
  /** Once all are decided: "13 added, 1 way chosen and 6 kept in Sofia's screen." */
  done: string | null;
  /** "Everything else comes from the library: Badge, Button." lines, unchanged from the section. */
  uses: string[];
}

const SETTLED = new Set(['approved', 'building', 'released', 'local', 'existing']);

const words = (xs: readonly string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
const n = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;
const possessive = (name: string) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

/** How much thought a piece asks for: ways to choose from first, then something new, then a change. */
function weight(r: ImpactRowView, conflicts: ReadonlySet<string>): number {
  if (conflicts.has(r.id)) return 0;
  if (/^new\b/i.test(r.kind)) return 1;
  return 2;
}

/**
 * The summary from the section's rows. `pieceHref` gives a piece's address in Library review (a conflict's id is its
 * piece on this exploration); `designer` names whose screen keeps what the library does not take.
 */
export function librarySummary(view: RowsView, o: { designer: string; pieceHref?: ((row: ImpactRowView, conflict: boolean) => string | null) | null }): LibrarySummaryView {
  const conflicts = new Set(view.conflicts.map((c) => c.piece));
  const pieces = view.rows.filter((r) => r.tag !== null);
  const open = pieces.filter((r) => !SETTLED.has(r.status.key));
  const total = pieces.length;
  const decided = total - open.length;
  const all = total > 0 && open.length === 0;
  const ordered = open.map((r, i) => ({ r, i })).sort((a, b) => weight(a.r, conflicts) - weight(b.r, conflicts) || a.i - b.i).map((x) => x.r);
  const ways = open.filter((r) => conflicts.has(r.id)).length;
  const fresh = open.filter((r) => !conflicts.has(r.id) && /^new\b/i.test(r.kind)).length;
  const changed = open.length - ways - fresh;
  const kinds = [ways ? `${ways} with ways to choose from` : '', fresh ? `${fresh} new` : '', changed ? n(changed, 'change') : ''].filter(Boolean);
  const sentence = all
    ? null
    : decided
      ? `${open.length} left: ${words(kinds)}.`
      : `${possessive(o.designer)} screen changes ${n(total, 'piece')} the library does not have: ${words(kinds)}.`;
  const added = pieces.filter((r) => !conflicts.has(r.id) && ['approved', 'building', 'released'].includes(r.status.key)).length;
  const chosen = pieces.filter((r) => conflicts.has(r.id) && SETTLED.has(r.status.key)).length;
  const local = pieces.filter((r) => r.status.key === 'local').length;
  const existing = pieces.filter((r) => r.status.key === 'existing' && !conflicts.has(r.id)).length;
  const tally = [added ? `${added} added` : '', chosen ? n(chosen, 'way chosen', 'ways chosen') : '', existing ? `${existing} use a library piece instead` : '', local ? `${local} kept in ${possessive(o.designer)} screen` : ''].filter(Boolean);
  const left = ordered.length - SUMMARY_ROWS;
  return {
    total,
    decided,
    count: all ? `All ${total} decided` : decided ? `${decided} of ${total} decided` : `${total} to decide`,
    sentence,
    rows: ordered.slice(0, SUMMARY_ROWS).map((r) => ({ id: r.id, name: r.title, what: r.summary, tag: r.tag, href: o.pieceHref?.(r, conflicts.has(r.id)) ?? null })),
    more: left > 0 ? `and ${left} more` : null,
    cta: all ? null : decided ? 'Continue in Library review' : 'Decide in Library review',
    done: all ? `${tally.length ? words(tally) : n(total, 'piece')}${tally.length ? '' : ' decided'}.` : null,
    uses: view.uses,
  };
}
