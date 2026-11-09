// The Library review count (one source, lib/waiting-counts): what waits for the viewer's decision there, read with the
// page's own loader and rule (scripts/library-review-data loadLibraryReview, lib/library-review waitingForYou), so
// Home, the nav badge and Library review's "N wait for you" are one number. Remembered for the other pages
// (scripts/needs-you rememberMine).
import { waitingForYou } from '../lib/library-review';
import { rememberMine } from './needs-you';

let reading: Promise<number | null> | null = null;

/** Reads Library review's pieces once per page and counts what waits for the viewer; null when it could not be read. */
export function countLibraryWaiting(): Promise<number | null> {
  reading ??= (async () => {
    const { loadLibraryReview } = await import('./library-review-data');
    let last: number | null = null;
    await loadLibraryReview((d) => {
      if (!d.loading && !d.failed) last = waitingForYou(d.pieces, d.viewer);
    }).catch(() => undefined);
    if (last !== null) rememberMine(last);
    return last;
  })();
  return reading;
}
