// Two reviews (docs/specs/two-reviews.md, approved 2026-11-12): what used to be one "In review" waiting on "the design
// lead" is two different reviews, each with its own people.
//
//   The library decision   Keep or not a new value, variant or component in the design system. The library owners
//                          decide, for every product at once (governance.owners.design, Settings > Reviews > The
//                          library). Never off.
//   The design review      Someone checks a product screen before the developers build it: that product's design
//                          reviewers (products[].designReview, a list, any one of them answers). Off per product.
//
// When a designer says Done exploring, Bridge asks the library owners when the screen has something new for the
// library (a new piece that is not the library as it is: library-impact asIsOption), and the product's design reviewers
// when its design review is on and someone other than the author can give it. Both start together and never wait on
// each other. The exploration is Ready to build once the design review said Looks right (or there was none) and every
// new piece has a library answer. With neither, Done exploring goes straight to Ready to build.
//
// No new status: "In review" always comes with who and why, as its second line (waitingFor). Pure: no DOM, no fetch.
// Unit tested in test/two-reviews.test.ts.

import type { ProductConfig } from './products';
import type { ReviewHat } from './explorations';

export type { ReviewHat };

/** Someone who can give a review: a GitHub login or an email member's reference as `id`, and the name people read. */
export interface Reviewer {
  /** Lower case GitHub login, or `member:<ref>` for a member who joined by email. */
  id: string;
  name: string;
}

/** The reviews Done exploring asks, and to whom. Null for a review that does not apply. */
export interface ReviewsAsked {
  design: { reviewers: Reviewer[] } | null;
  library: { owners: Reviewer[]; pieces: string[] } | null;
  /** Why there is no design review, when there is none: the product has it off, or the author is its only reviewer. */
  noDesign?: 'off' | 'author-only' | 'nobody' | undefined;
}

/** A product's design review as a team keeps it: off, on with named reviewers, or on with every designer but the author. */
export type DesignReviewSetting = { on: false } | { on: true; reviewers: string[] | 'any-designer' };

const norm = (s: string | null | undefined) => (s ?? '').trim().replace(/^@/, '').toLowerCase();

/**
 * The design review a product has in bridge.config.json: `false` is off, `{ reviewers }` names them. Absent: on, the
 * design owners review (the team default, what "the design lead" meant before), except the Library, where it is off.
 * GitHub teams ("org/slug") never review by themselves: only people.
 */
export function designReviewOf(product: Pick<ProductConfig, 'key' | 'designReview'> | null | undefined, designOwners: readonly string[]): DesignReviewSetting {
  if (!product) return { on: true, reviewers: people(designOwners) };
  if (product.designReview === false) return { on: false };
  if (product.designReview && Array.isArray(product.designReview.reviewers)) return { on: true, reviewers: people(product.designReview.reviewers) };
  if (product.key === 'library') return { on: false };
  return { on: true, reviewers: people(designOwners) };
}

const people = (list: readonly string[]): string[] => [...new Set(list.map(norm).filter((l) => l && !l.includes('/')))];

/**
 * The reviews Done exploring asks (the rules at the top). `author` is who started the exploration (a login or a member
 * id, see Reviewer); `designReviewers` the product's reviewers once resolved (null: the design review is off);
 * `libraryOwners` the team's; `newPieces` the new pieces' titles (or ids) that still need a library answer.
 *
 * Edge cases: the author never reviews their own exploration. The author being the product's only design reviewer
 * means no design review (`noDesign: 'author-only'`). The author being the only library owner: they decide and it is
 * recorded (a team with nobody else would wait forever, the same rule as soloOwnerCanApproveBoth on GitHub). A design
 * review already given (`designDone`, a Looks right kept from an earlier round) is not asked again.
 */
export function reviewsFor(x: {
  author: readonly string[];
  designReviewers: readonly Reviewer[] | null;
  libraryOwners: readonly Reviewer[];
  newPieces: readonly string[];
  designDone?: boolean | undefined;
}): ReviewsAsked {
  const mine = new Set(x.author.map(norm).filter(Boolean));
  const notMine = (r: Reviewer) => !mine.has(norm(r.id));
  let design: ReviewsAsked['design'] = null;
  let noDesign: ReviewsAsked['noDesign'];
  if (x.designDone) design = null;
  else if (!x.designReviewers) noDesign = 'off';
  else {
    const others = x.designReviewers.filter(notMine);
    if (others.length) design = { reviewers: others };
    else noDesign = x.designReviewers.length ? 'author-only' : 'nobody';
  }
  let library: ReviewsAsked['library'] = null;
  if (x.newPieces.length) {
    const others = x.libraryOwners.filter(notMine);
    // Nobody else: the only owner decides, and it is recorded. Nobody at all: still asked, the admin is told on Home.
    library = { owners: others.length ? others : [...x.libraryOwners], pieces: [...x.newPieces] };
  }
  return { design, library, ...(noDesign && !design ? { noDesign } : {}) };
}

/** Whether Done exploring goes straight to Ready to build: no review applies. */
export const goesStraightToReady = (r: Pick<ReviewsAsked, 'design' | 'library'>): boolean => !r.design && !r.library;

/**
 * Ready to build once both reviews settled: the design review said Looks right or there was none, and every new piece
 * has a library answer (Add to the library, Keep in the screen only, Use an existing piece instead).
 */
export const reviewsSettled = (x: { designWaiting: boolean; libraryPending: number }): boolean => !x.designWaiting && x.libraryPending === 0;

// ---------------------------------------------------------------------------------------------------------------
// Words

const andList = (parts: readonly string[]) => (parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);

/** "Dana's", "James'". */
export const possessive = (name: string): string => `${name}${/s$/i.test(name) ? "'" : "'s"}`;

/** "Timeline", "Timeline and Stat card", "3 new pieces". */
export function piecesWords(pieces: readonly string[]): string {
  if (pieces.length <= 2) return andList(pieces);
  return `${pieces.length} new pieces`;
}

/** The viewer, as a review reads them: a login and a member id, either may be missing. */
export type ReviewViewer = readonly (string | null | undefined)[] | null | undefined;

const isViewer = (viewer: ReviewViewer, r: Reviewer | null | undefined): boolean => {
  if (!viewer || !r) return false;
  const ids = new Set(viewer.map(norm).filter(Boolean));
  return ids.has(norm(r.id));
};

/** What one waiting review is, for waitingFor. */
export interface WaitingDesign {
  reviewers: readonly Reviewer[];
  /** The reviewer who took it ("I'll look"), when one did. */
  takenBy?: Reviewer | null | undefined;
  /** The product's name: "the Acme CRM design review" when several reviewers and nobody took it. */
  product?: string | null | undefined;
}

export interface WaitingLibrary {
  owners: readonly Reviewer[];
  /** The new pieces still waiting, in words ("Timeline"). */
  pieces: readonly string[];
}

/**
 * The second line of "In review" (the spec's table): who and why. `viewer` holds the viewer's ids: a review they hold
 * reads "your". Null when neither review waits.
 *
 *   Waiting for Dana's design review and the library decision on Timeline
 *   Waiting for your design review and your library decision on Timeline
 *   Waiting for Dana's design review
 *   Waiting for the library decision on Timeline
 */
export function waitingFor(x: { design: WaitingDesign | null; library: WaitingLibrary | null; viewer?: ReviewViewer }): string | null {
  const parts: string[] = [];
  let designName: string | null = null;
  if (x.design) {
    const d = x.design;
    const one = d.takenBy ?? (d.reviewers.length === 1 ? d.reviewers[0]! : null);
    const mine = d.takenBy ? isViewer(x.viewer, d.takenBy) : d.reviewers.some((r) => isViewer(x.viewer, r));
    if (mine) parts.push('your design review');
    else if (one) {
      designName = one.name;
      parts.push(`${possessive(one.name)} design review`);
    } else parts.push(d.product ? `the ${d.product} design review` : 'the design review');
  }
  if (x.library) {
    const l = x.library;
    const on = l.pieces.length ? ` on ${piecesWords(l.pieces)}` : '';
    const mine = l.owners.some((r) => isViewer(x.viewer, r));
    const one = l.owners.length === 1 ? l.owners[0]! : null;
    if (mine) parts.push(`your library decision${on}`);
    else if (one && designName && one.name === designName) parts[parts.length - 1] = `${possessive(one.name)} design review and library decision${on}`;
    else if (one) parts.push(`${possessive(one.name)} library decision${on}`);
    else parts.push(`the library decision${on}`);
  }
  return parts.length ? `Waiting for ${andList(parts)}` : null;
}

/**
 * The second line when Done exploring went straight to Ready to build, or when one review did not apply:
 *   No review needed: nothing new for the library, and Acme CRM has no design review
 *   No design review: Dana is Acme Prints' only reviewer
 */
export function noReviewLine(x: { product: string; noDesign: ReviewsAsked['noDesign']; library: boolean; authorName?: string | null | undefined }): string | null {
  if (!x.noDesign) return null;
  if (x.noDesign === 'author-only' && x.authorName) return `No design review: ${x.authorName} is ${possessive(x.product)} only reviewer`;
  if (x.library) return null;
  return `No review needed: nothing new for the library, and ${x.product} has no design review`;
}

/** The title of the Library impact block: "Nothing new for the library" (no count), else the new pieces only. */
export function libraryImpactTitle(newPieces: number): string {
  if (newPieces <= 0) return 'Nothing new for the library';
  return newPieces === 1 ? '1 new piece' : `${newPieces} new pieces`;
}

/** What a Home row or a queue item asks of the viewer: one hat or both (one row, owner decision 7). */
export type HatAsk = 'design-review' | 'library';

/**
 * A Home row that names the hat: "Sofia's screen: your design review and a library decision", "Leo's screen: your
 * design review", "Sofia's screen: a library decision". One row even when the viewer holds both hats.
 */
export function homeRowLine(author: string, hats: readonly HatAsk[]): string {
  const words: string[] = [];
  if (hats.includes('design-review')) words.push('your design review');
  if (hats.includes('library')) words.push('a library decision');
  return `${possessive(author)} screen: ${andList(words)}`;
}

/** Library review's subtitle: "12 library decisions wait for you, as design system owner". */
export function libraryQueueLine(n: number): string {
  return n === 1 ? '1 library decision waits for you, as design system owner' : `${n} library decisions wait for you, as design system owner`;
}

/** The pointer under Library review's subtitle. */
export const LIBRARY_QUEUE_POINTER = 'Screens waiting for your design review are in Explorations, not here.';

/** The hat words on each step of the exploration page. */
export const HAT_WORDS = {
  designTurn: 'Your turn: design review',
  designAs: (product: string) => `You review the screen as ${product} design lead`,
  libraryTurn: 'Library decision',
  libraryAs: 'You decide as design system owner, apart from the screen',
  libraryRole: 'Decides what the library keeps',
  designRole: 'Reviews the design before developers',
  migrated: 'Reviews now have two parts. Check who reviews each product\'s design.',
} as const;

// ---------------------------------------------------------------------------------------------------------------
// Migration from the one review mode (api/_lib/review-mode.ts: one | shared | shared-none), run once per team

export type LegacyReviewMode = 'one' | 'shared' | 'shared-none';

export interface ReviewSettings {
  /** Ids of the library owners (Reviewer ids). */
  libraryOwners: string[];
  /** Per product key. */
  designReview: Record<string, DesignReviewSetting>;
}

/**
 * The two reviews a team gets from its old review mode (the spec's migration table; nothing silently skips review):
 *
 *   one          library owners = leads + design owners; design review ON for every product, reviewers = the leads,
 *                else the design owners
 *   shared       library owners = leads + design owners, else every designer; design review ON, any designer
 *   shared-none  library owners = the same; design review OFF (the team chose no review)
 *   solo team    the owner; design review OFF, as before (nobody else to ask)
 *
 * The Library itself has its design review off in every case: the library decision is its only review. Pure and
 * idempotent: the same inputs give the same settings.
 */
export function migrateReviews(x: {
  mode: LegacyReviewMode;
  /** Email members who were Design lead, and the GitHub design owners, as ids. */
  leads: readonly string[];
  designOwners: readonly string[];
  /** Every designer of the team (Can edit), as ids. */
  designers: readonly string[];
  /** Everyone on the team, to tell a team of one. */
  people: readonly string[];
  products: readonly Pick<ProductConfig, 'key'>[];
}): ReviewSettings {
  const uniq = (l: readonly string[]) => [...new Set(l.map(norm).filter(Boolean))];
  const leadsAndOwners = uniq([...x.leads, ...x.designOwners]);
  const everyone = uniq(x.people);
  const solo = everyone.length <= 1;
  const libraryOwners = solo ? everyone : x.mode === 'one' ? leadsAndOwners : leadsAndOwners.length ? leadsAndOwners : uniq(x.designers);
  const reviewers = uniq(x.leads).length ? uniq(x.leads) : uniq(x.designOwners);
  const designReview: Record<string, DesignReviewSetting> = {};
  for (const p of x.products) {
    if (solo || p.key === 'library' || x.mode === 'shared-none' || (x.mode === 'one' && !reviewers.length)) designReview[p.key] = { on: false };
    else if (x.mode === 'shared') designReview[p.key] = { on: true, reviewers: 'any-designer' };
    else designReview[p.key] = { on: true, reviewers };
  }
  return { libraryOwners, designReview };
}

/** The reviewers of a setting, for a team: named ones, or every designer for `any-designer`. Null when off. */
export function reviewersOfSetting(s: DesignReviewSetting | null | undefined, designers: readonly string[]): string[] | null {
  if (!s || !s.on) return null;
  return s.reviewers === 'any-designer' ? [...designers] : [...s.reviewers];
}

/**
 * Turning a product's design review off while explorations wait: the ones waiting only on it go to Ready to build
 * (with the activity line); the ones also waiting on the library keep waiting for it alone. Turning it on sends
 * nothing back.
 */
export function afterDesignReviewOff(waiting: { designWaiting: boolean; libraryPending: number }): 'ready-to-build' | 'library-only' | 'unchanged' {
  if (!waiting.designWaiting) return 'unchanged';
  return waiting.libraryPending > 0 ? 'library-only' : 'ready-to-build';
}

/** The activity line when a design review is switched off: "Design review turned off by Dana". */
export const designReviewOffLine = (by: string): string => `Design review turned off by ${by}`;

/**
 * A reviewer removed from the team: their asks go to the other reviewers; with none left the admin is told on Home
 * (`orphan`).
 */
export function withoutReviewer(reviewers: readonly string[], removed: string): { reviewers: string[]; orphan: boolean } {
  const left = reviewers.filter((r) => norm(r) !== norm(removed));
  return { reviewers: left, orphan: reviewers.length > 0 && left.length === 0 };
}
