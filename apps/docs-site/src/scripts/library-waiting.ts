// The Library review counts (one source each, lib/waiting-counts), read with the page's own loader and rules
// (scripts/library-review-data loadLibraryReview, lib/library-review):
//   - forYou: the library decisions waiting for the viewer (lib/library-queue libraryQueueCount), so Home, the nav badge and Library review's
//     "N wait for you" are one number. Remembered for the other pages (scripts/needs-you rememberMine).
//   - yours: the viewer's own pieces still waiting (yourWaitingPieces), what Asked by: You lists, for Home's sentence.
import { yourWaitingPieces } from '../lib/library-review';
import { libraryQueueCount } from '../lib/library-queue';
import { rememberMine } from './needs-you';

export interface LibraryCounts {
  forYou: number;
  yours: number;
  /** Every piece still waiting for a decision: Library review's own count ("0 of 13 decided"), the Library card's. */
  waiting: number;
}

let reading: Promise<LibraryCounts | null> | null = null;

/** Reads Library review's pieces once per page and counts them; null when they could not be read. */
export function readLibraryCounts(): Promise<LibraryCounts | null> {
  reading ??= (async () => {
    const { loadLibraryReview } = await import('./library-review-data');
    let last: LibraryCounts | null = null;
    await loadLibraryReview((d) => {
      if (!d.loading && !d.failed) last = { forYou: libraryQueueCount(d.pieces, d.viewer), yours: yourWaitingPieces(d.pieces, d.viewer), waiting: d.pieces.filter((p) => p.state === 'waiting').length };
    }).catch(() => undefined);
    if (last !== null) rememberMine((last as LibraryCounts).forYou);
    return last;
  })();
  return reading;
}

/** What waits for the viewer's decision in Library review; null when it could not be read. */
export function countLibraryWaiting(): Promise<number | null> {
  return readLibraryCounts().then((c) => (c ? c.forYou : null));
}
