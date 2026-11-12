// Done exploring with the two reviews (docs/specs/two-reviews.md): which reviews it asks, to whom, what the dialog and
// the confirmation line say, and when the product manager's word is required. scripts/exploration-done.ts runs it with
// the team's facts; this file is pure (no DOM, no fetch) and unit tested in done-reviews.test.ts.
//
//   The team    an email team: the server's per product settings (scripts/contribute-session teamReview); a GitHub
//               team (designReview null): bridge.config.json (products[].designReview, governance.owners.design);
//               the sample team: SAMPLE_REVIEWS and its cast (Dana holds both hats).
//   The asks    lib/team-reviews reviewsToAsk; with no library check on the exploration, the pieces the designer
//               ticked stand in for the new pieces (as core libraryPendingOf does).
//   Neither     straight to Ready to build, and the line says why (core noReviewLine).
import { goesStraightToReady, noReviewLine, parsePiecesRecord, waitingFor, type ProductConfig, type Reviewer, type ReviewsAsked } from '@bridge-ds/core';
import { libraryOwners, reviewsToAsk, SAMPLE_REVIEWS, type DesignReviewMap, type ReviewMember, type TeamReviews } from './team-reviews';
import { SAMPLE_CAST } from './demo-cast';

/** The sample team's people as the reviews read them: its email members, Dana the library owner. */
export const SAMPLE_REVIEW_MEMBERS: readonly ReviewMember[] = SAMPLE_CAST.flatMap((p) => (p.via.kind === 'email' ? [{ name: p.name, ref: p.via.ref, role: p.via.role, ...(p.via.lead ? { libraryOwner: true } : {}) }] : []));

/** What Studio knows of a team's reviews, for Done exploring. */
export function teamReviewsForDone(x: {
  sample: boolean;
  /** The server's answer (teamReview): null map on a GitHub team. */
  review: { designReview: DesignReviewMap | null; members: readonly ReviewMember[]; note?: boolean | undefined } | null;
  githubOwners: readonly string[];
  products: readonly ProductConfig[];
}): TeamReviews {
  if (x.sample) return { designReview: SAMPLE_REVIEWS, members: SAMPLE_REVIEW_MEMBERS, githubOwners: [], products: x.products };
  return { designReview: x.review?.designReview ?? null, members: x.review?.members ?? [], githubOwners: x.githubOwners, products: x.products };
}

/**
 * The reviews Done exploring asks: reviewsToAsk, and when the exploration was never checked against the library, the
 * ticked pieces ask the library owners (never the author, unless they are the only one).
 */
export function reviewsAtDone(body: string | null | undefined, x: { team: TeamReviews; product: string | null | undefined; author: readonly string[]; ticked: readonly string[] }): ReviewsAsked {
  const asked = reviewsToAsk(body, x);
  if (asked.library || parsePiecesRecord(body) || !x.ticked.length) return asked;
  const mine = new Set(x.author);
  const all = libraryOwners(x.team);
  const others = all.filter((r) => !mine.has(r.id));
  return { ...asked, library: { owners: others.length ? others : all, pieces: [...x.ticked] } };
}

/**
 * Who core askReviewsOnGitHub writes as asked: GitHub logins only. A member who joined by email is never named on
 * GitHub (a reference could @mention a stranger there); Studio finds them again from the team's settings.
 */
export const githubAsked = (list: readonly Reviewer[]): string[] => list.filter((r) => !r.id.includes(':')).map((r) => r.id);

/** Whether any review applies (the dialog's "it goes to someone first"). */
export const asksSomeone = (asked: ReviewsAsked): boolean => !goesStraightToReady(asked);

/** The product's name as sentences read it: "Acme CRM", else "this product". */
export const productNameOf = (products: readonly Pick<ProductConfig, 'key' | 'name'>[], key: string | null | undefined): string => products.find((p) => p.key === key)?.name || key || 'this product';

/** The waiting phrase for these asks, without "Waiting for": "Dana's design review and library decision on Timeline". */
function waitingPhrase(asked: ReviewsAsked, product: string, titles: (id: string) => string): string | null {
  const line = waitingFor({
    design: asked.design ? { reviewers: asked.design.reviewers, product } : null,
    library: asked.library ? { owners: asked.library.owners, pieces: asked.library.pieces.map(titles) } : null,
  });
  return line ? line.replace(/^Waiting for /, '') : null;
}

/** The dialog's sentence when a review applies: "Dana's design review comes first. Your developers take it from there." */
export function doneDialogLine(asked: ReviewsAsked, product: string): string | null {
  const phrase = waitingPhrase({ ...asked, library: asked.library ? { ...asked.library, pieces: [] } : null }, product, (id) => id);
  if (!phrase) return null;
  return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)} ${asked.design && asked.library ? 'come' : 'comes'} first. Nothing closes, and your developers take it from there.`;
}

/**
 * The line after Done exploring.
 *   Asked:     "Sent. Waiting for Dana's design review and library decision on Timeline."
 *   Straight:  "Ready to build. No review needed: nothing new for the library, and Acme CRM has no design review."
 * When only the design review is missing because the author is its only reviewer, the line says so after the wait.
 */
export function doneConfirmationLine(asked: ReviewsAsked, x: { product: string; authorName?: string | null | undefined; titles?: (id: string) => string; requests?: number }): string {
  const titles = x.titles ?? ((id: string) => id);
  const why = noReviewLine({ product: x.product, noDesign: asked.noDesign, library: Boolean(asked.library), authorName: x.authorName });
  const phrase = waitingPhrase(asked, x.product, titles);
  if (phrase) return `Sent. Waiting for ${phrase}.${why ? ` ${why}.` : ''}`;
  const n = x.requests ?? 0;
  const went = n ? ` ${n} ${n === 1 ? 'piece went' : 'pieces went'} to the library as ${n === 1 ? 'a request' : 'requests'}.` : '';
  return `Ready to build. ${why ?? 'No review needed: the design review already said it looks right, and nothing new for the library'}.${went}`;
}

/**
 * The PM gate (board R1): the product's PM says Looks good (or agreed in a call) before the developers when the design
 * review does not apply to this exploration (off for the product, or nobody but the author to give it). A design
 * review given in an earlier round still stands, so no PM gate then.
 */
export const pmGateRequired = (asked: ReviewsAsked, designDone: boolean): boolean => !asked.design && !designDone;
