// Library review's one count (two reviews, docs/specs/two-reviews.md): the library decisions that wait for the
// viewer, as design system owner. One function feeds the page's subtitle, its list's "for you" rows and the sidebar
// badge (LibraryReview.tsx, scripts/library-waiting.ts), so they never say two numbers.
//
// Why they did (bug seen on the prod sample team, "11 wait for you" under 12 in the list and the badge): the subtitle
// counted the filtered list after the decisions made on the page (the undo window marks a piece decided at once),
// while the badge counted the pieces as read, before those decisions and whatever the filters. Now both count the same
// pieces, with the page's own decisions applied, whatever the filters show.
//
// Screens waiting only for a design review are never here: they are explorations, not library pieces.
// Pure: no DOM. Unit tested in library-queue.test.ts.
import { LIBRARY_QUEUE_POINTER, libraryQueueLine } from '@bridge-ds/core';
import { canDecide, type ReviewPiece, type Viewer } from './library-review';

/** A decision the page made and has not read back yet: the piece reads decided at once. */
export type LocalDecisions = ReadonlyMap<string, ReviewPiece['decided']>;

/** The pieces as the page shows them: read, then the page's own decisions on top. */
export function withLocal(pieces: readonly ReviewPiece[], local?: LocalDecisions | null): ReviewPiece[] {
  if (!local?.size) return [...pieces];
  return pieces.map((p) => (local.has(p.key) ? { ...p, state: 'decided' as const, decided: local.get(p.key) ?? 'added', waitsOn: 'nobody' as const } : p));
}

/** The library decisions that wait for the viewer: the one list behind the subtitle, the rows for you and the badge. */
export function libraryDecisionsForYou(pieces: readonly ReviewPiece[], v: Viewer, local?: LocalDecisions | null): ReviewPiece[] {
  return withLocal(pieces, local).filter((p) => canDecide(p, v));
}

/** The one count: how many library decisions wait for the viewer. */
export const libraryQueueCount = (pieces: readonly ReviewPiece[], v: Viewer, local?: LocalDecisions | null): number => libraryDecisionsForYou(pieces, v, local).length;

/**
 * Library review's subtitle for whoever decides: "12 library decisions wait for you, as design system owner." and the
 * pointer to Explorations for design reviews. Null for a viewer who does not decide (the page says who does).
 */
export function libraryQueueSubtitle(pieces: readonly ReviewPiece[], v: Viewer, local?: LocalDecisions | null): { strong: string; rest: string } | null {
  if (!v.reviews) return null;
  const n = libraryQueueCount(pieces, v, local);
  return { strong: n ? `${libraryQueueLine(n)}.` : 'No library decision waits for you.', rest: LIBRARY_QUEUE_POINTER };
}
