// The words Studio says about the two reviews (docs/specs/two-reviews.md) on the surfaces that name a hat: the status
// second line (exploration page, Explorations list, Home cards), the author's steps, Home rows, and which waits count
// where. The people come from lib/team-reviews.ts, the words from core two-reviews.ts; this file only joins them.
//
//   In review        "Waiting for Dana's design review and the library decision on Timeline" (team-reviews waitingLineOf)
//   Ready to build   "No review needed: nothing new for the library, and Acme CRM has no design review" when Done
//                    exploring went straight there (core noReviewLine)
//   Home row         "Sofia's screen: your design review and a library decision", one row for both hats
//   Explorations     its count counts design reviews only; library decisions are Library review's
//
// Pure: no DOM, no fetch. Unit tested in review-lines.test.ts.
import { decisionsOf, homeRowLine, isPmKind, noReviewLine, parseExplorationBody, possessive, piecesWords, type HatAsk, type ReviewViewer, type WaitingDesign, type WaitingLibrary } from '@bridge-ds/core';
import { isCastLogin } from './demo-cast';
import { ANY_PRODUCT, memberId, reviewsToAsk, SAMPLE_REVIEWS, waitingLineOf, waitingReviews, type DesignReviewMap, type TeamReviews } from './team-reviews';

/** Where an exploration is said: the team's reviews, its product (key and name) and who opened its pull request. */
export interface LineContext {
  team: TeamReviews;
  product: string | null | undefined;
  productName?: string | null | undefined;
  prAuthor?: string | null;
  viewer?: ReviewViewer;
}

/**
 * Done exploring went straight to Ready to build: handed off with no review on record (no design yes, no Looks right,
 * no library answer). A screen that went through a review says that review's own words instead.
 */
export function wentStraight(body: string | null | undefined): boolean {
  const e = parseExplorationBody(body);
  if (!e?.doneAt) return false;
  if (e.designOkBy || e.designOkAt) return false;
  if (decisionsOf(e).some((d) => !isPmKind(d.kind) && d.kind === 'looks-right')) return false;
  return !(e.library?.decisions?.length);
}

/**
 * The status second line of an exploration: who and why while In review (the spec's table), the no review line when
 * Done exploring went straight to Ready to build, else null (the tag says it all).
 */
export function reviewSecondLine(body: string | null | undefined, x: LineContext & { authorName?: string | null | undefined }): string | null {
  const waiting = waitingLineOf(body, x);
  if (waiting) return waiting;
  if (!wentStraight(body)) return null;
  const e = parseExplorationBody(body);
  const author = [x.prAuthor, e?.author, e?.member ? memberId(e.member) : null].filter((a): a is string => Boolean(a));
  const asked = reviewsToAsk(body, { team: x.team, product: x.product, author });
  const product = x.productName ?? x.team.products.find((p) => p.key === x.product)?.name ?? 'This product';
  return noReviewLine({ product, noDesign: asked.noDesign ?? 'off', library: false, authorName: x.authorName ?? e?.memberName ?? null });
}

/** One step of the author's card: who gives which review, now. */
export interface ReviewStep {
  text: string;
  when: string;
  current: true;
  /** Both reviews in the one current step: one line per review still waiting, each naming who and the hat. */
  lines?: string[];
}

const isYou = (viewer: ReviewViewer, id: string | undefined) => Boolean(id && (viewer ?? []).some((v) => v && v.toLowerCase() === id.toLowerCase()));

/**
 * The reviews an exploration waits on as steps, both current (they run at the same time): "Dana reviews the design",
 * "Dana decides on Timeline for the library". The viewer's own reads "You". Empty when nothing waits.
 */
export function reviewSteps(w: { design: WaitingDesign | null; library: WaitingLibrary | null }, viewer?: ReviewViewer, when = 'now'): ReviewStep[] {
  const steps: ReviewStep[] = [];
  if (w.design) {
    const one = w.design.takenBy ?? (w.design.reviewers.length === 1 ? w.design.reviewers[0]! : null);
    const mine = w.design.takenBy ? isYou(viewer, w.design.takenBy.id) : w.design.reviewers.some((r) => isYou(viewer, r.id));
    const text = mine ? 'You review the design' : one ? `${one.name} reviews the design` : `The ${w.design.product ? `${w.design.product} ` : ''}design reviewers review it`;
    steps.push({ text, when, current: true });
  }
  if (w.library) {
    const on = w.library.pieces.length ? ` on ${piecesWords(w.library.pieces)}` : '';
    const mine = w.library.owners.some((r) => isYou(viewer, r.id));
    const one = w.library.owners.length === 1 ? w.library.owners[0]! : null;
    const text = mine ? `You decide${on} for the library` : one ? `${one.name} decides${on} for the library` : `The library owners decide${on}`;
    steps.push({ text, when, current: true });
  }
  return steps;
}

/** The author's steps for an exploration body (team-reviews waitingReviews), for the page's turn block. */
export const reviewStepsOf = (body: string | null | undefined, x: LineContext, when = 'now'): ReviewStep[] => reviewSteps(waitingReviews(body, x), x.viewer, when);

/**
 * Both reviews as the one current step of the DS Stepper, which marks a single step current (a second current step
 * would read "to come"). The step shows one line per review ("Dana reviews the design", "Dana decides on Timeline for
 * the library"), and its text joins them for anything that reads one sentence ("Dana reviews the design and decides on
 * Timeline for the library", "Dana reviews the design, the library owners decide on Timeline"). One review stays as it
 * is: one line.
 */
export function asOneStep(steps: readonly ReviewStep[]): ReviewStep[] {
  if (steps.length < 2) return [...steps];
  const [a, b] = steps as [ReviewStep, ReviewStep];
  const subject = (t: string) => (/^(The library owners|The [\w ]+design reviewers|You|\S+)\s/.exec(t)?.[1] ?? '');
  const sa = subject(a.text);
  const text = sa && sa === subject(b.text) ? `${a.text} and ${b.text.slice(sa.length + 1)}` : `${a.text}, ${b.text.replace(/^The /, 'the ')}`;
  return [{ text, when: a.when, current: true, lines: [a.text, b.text] }];
}

/** The title of the author's card while In review: the second line itself ("Waiting for Dana's design review"). */
export const waitingTitleOf = (body: string | null | undefined, x: LineContext): string | null => waitingLineOf(body, x);

/** A Home row's line for the hats the viewer holds on one exploration: one row, both hats named (owner decision 7). */
export const hatRowLine = (author: string, hats: readonly HatAsk[]): string | null => (hats.length ? homeRowLine(author, hats) : null);

/** The Explorations count counts design reviews: a row asking only a library decision belongs to Library review. */
export const countsOnExplorations = (hats: readonly HatAsk[] | null | undefined): boolean => !hats || hats.length === 0 || hats.includes('design-review');

/** After Looks right with library pieces still waiting: the line under the design review card. */
export function stillWaitsLine(pieces: readonly string[], owners: readonly { name: string }[]): string {
  const on = pieces.length ? ` on ${piecesWords(pieces)}` : '';
  const who = owners.length === 1 ? `${possessive(owners[0]!.name)} library decision` : 'the library decision';
  return `Your design review is in. It still waits for ${who}${on}.`;
}

/**
 * The sample team's reviews when the server keeps none yet (lib/demo isSampleTeam): Dana reviews every product's design
 * (the Library has none) and decides what the library keeps. A team's own settings always win.
 */
export function withSampleReviews(t: TeamReviews, sample: boolean): TeamReviews {
  if (!sample) return t;
  // Only the cast: never the GitHub owners of the repository hosting the sample team (lib/team-reviews reviewGithubOwners).
  const cast = t.members.filter((m) => !m.login || m.ref || isCastLogin(m.login));
  const designReview: DesignReviewMap = t.designReview && Object.keys(t.designReview).length ? t.designReview : SAMPLE_REVIEWS;
  const dana = (SAMPLE_REVIEWS[ANY_PRODUCT] as { reviewers: string[] }).reviewers[0]!;
  const owned = cast.some((m) => m.libraryOwner);
  const members = owned ? cast : cast.map((m) => (m.ref === dana ? { ...m, libraryOwner: true } : m));
  return { ...t, githubOwners: [], designReview, members };
}
