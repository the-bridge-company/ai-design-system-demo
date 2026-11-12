// The two reviews as Studio reads them (docs/specs/two-reviews.md, core two-reviews.ts): who gives a product's design
// review, who decides what the library keeps, and what an exploration In review waits on. One pure place, read by
// Done exploring (scripts/exploration-done.ts), the exploration page, Home, Explorations, Library review and Settings >
// Reviews, so every surface names the same people for the same hat.
//
// Where the facts come from:
//   - a team whose members joined by email: the server (api/_lib/review-settings.ts, GET /api/contribute?members=1
//     `reviews.designReview`, and each member's `libraryOwner`);
//   - a GitHub team: bridge.config.json (products[].designReview, governance.owners.design), core designReviewOf;
//   - the sample team: its cast (SAMPLE_REVIEWS): Dana holds both hats, Acme CRM and Acme Prints design review = Dana.
// Reviewer ids: a lower case GitHub login, or `member:<ref>` for a member who joined by email (never an email).
//
// Pure: no DOM, no fetch. Unit tested in team-reviews.test.ts.
import { isSampleTeam } from './demo';
import {
  designReviewOf,
  impactItemOf,
  isDesignReviewWaiting,
  libraryPendingOf,
  parseExplorationBody,
  parsePiecesRecord,
  reviewsFor,
  waitingFor,
  type HatAsk,
  type ProductConfig,
  type Reviewer,
  type ReviewsAsked,
  type ReviewViewer,
  type WaitingDesign,
  type WaitingLibrary,
} from '@bridge-ds/core';

/** A product's design review as the server keeps it (api/_lib/review-settings.ts). */
export type DesignReviewSetting = { on: false } | { on: true; reviewers: string[] | 'any-designer' };
/** Per product key; "*" holds every product not listed. */
export type DesignReviewMap = Record<string, DesignReviewSetting>;
export const ANY_PRODUCT = '*';
/** Every designer decides what the library keeps (a shared team with no lead, migrated). */
export const OWNERS_ANY = '~library-owners';

/** An exploration's Bridge block as parsed (core parseExplorationBody). */
type ExplorationBlock = NonNullable<ReturnType<typeof parseExplorationBody>>;

/** A team member as the reviews read them. */
export interface ReviewMember {
  name: string;
  /** Member reference (email members). */
  ref?: string | undefined;
  /** GitHub login (GitHub people). */
  login?: string | undefined;
  role?: 'view' | 'edit' | 'admin' | undefined;
  /** Decides what the library keeps. */
  libraryOwner?: boolean | undefined;
}

/** What Studio knows about a team's two reviews. */
export interface TeamReviews {
  /** The email team's per product settings (server), or null for a GitHub team (bridge.config.json decides). */
  designReview: DesignReviewMap | null;
  members: readonly ReviewMember[];
  /** The GitHub design owners of bridge.config.json (governance.owners.design): library owners, and the default reviewers. */
  githubOwners: readonly string[];
  /** bridge.config.json products, for their names and their `designReview`. */
  products: readonly ProductConfig[];
  /** Settings shows "Reviews now have two parts" once after the migration. */
  note?: boolean | undefined;
}

/** The sample team (lib/demo.ts isSampleTeam): Dana decides what the library keeps and reviews every product's design. */
export const SAMPLE_REVIEWS: DesignReviewMap = { [ANY_PRODUCT]: { on: true, reviewers: ['a399f73add3dbb2d'] }, library: { on: false } };

const norm = (s: string | null | undefined) => (s ?? '').trim().replace(/^@/, '').toLowerCase();
const people = (l: readonly string[]) => l.map(norm).filter((x) => x && !x.includes('/'));

/**
 * The GitHub design owners a team's reviews may name: the people of its bridge.config.json, none on the sample team.
 * The sample team names only its cast (SAMPLE_REVIEWS); its repository's config names the real account hosting it,
 * which is never merged into the demo's reviews.
 */
export function reviewGithubOwners(repo: string | null | undefined, owners: readonly string[] | null | undefined): string[] {
  if (isSampleTeam(repo)) return [];
  return [...new Set(people(owners ?? []))];
}

export const memberId = (ref: string): string => `member:${ref}`;

/** The id and name of one entry of a reviewers list: a member reference or a GitHub login. */
function reviewerOf(entry: string, team: Pick<TeamReviews, 'members'>): Reviewer {
  const e = norm(entry);
  const byRef = team.members.find((m) => m.ref && m.ref.toLowerCase() === e);
  if (byRef) return { id: memberId(byRef.ref!), name: byRef.name };
  const byLogin = team.members.find((m) => m.login && norm(m.login) === e);
  return { id: e, name: byLogin?.name ?? e };
}

const uniq = (list: Reviewer[]): Reviewer[] => list.filter((r, i) => list.findIndex((x) => x.id === r.id) === i);

/** The setting of one product on an email team: its own, else "*", else off for the Library. */
export function settingOf(map: DesignReviewMap, product: string | null | undefined): DesignReviewSetting {
  if (product && map[product]) return map[product]!;
  if (product === 'library') return { on: false };
  return map[ANY_PRODUCT] ?? { on: false };
}

/**
 * A product's design reviewers, everyone who may give it (the author is taken out by core reviewsFor). Null when the
 * product's design review is off. An empty named list reads as the GitHub design owners (as "the design lead" did).
 */
export function productReviewers(team: TeamReviews, productKey: string | null | undefined): Reviewer[] | null {
  const product = team.products.find((p) => p.key === productKey) ?? null;
  if (team.designReview) {
    const s = settingOf(team.designReview, productKey);
    if (!s.on) return null;
    if (s.reviewers === 'any-designer') return team.members.filter((m) => m.role === 'edit' || m.role === 'admin').map((m) => (m.ref ? { id: memberId(m.ref), name: m.name } : { id: norm(m.login), name: m.name }));
    if (s.reviewers.length) return uniq(s.reviewers.map((r) => reviewerOf(r, team)));
    return uniq(people(team.githubOwners).map((l) => reviewerOf(l, team)));
  }
  const s = designReviewOf(product ?? (productKey ? { key: productKey } : null), team.githubOwners);
  return s.on ? uniq((s.reviewers === 'any-designer' ? [] : s.reviewers).map((r) => reviewerOf(r, team))) : null;
}

/** The library owners: members marked so (or every designer, OWNERS_ANY), and the GitHub design owners. */
export function libraryOwners(team: TeamReviews): Reviewer[] {
  const every = team.designReview?.[OWNERS_ANY];
  const any = Boolean(every && every.on && every.reviewers === 'any-designer');
  const members = team.members.filter((m) => m.libraryOwner || (any && (m.role === 'edit' || m.role === 'admin'))).map((m) => (m.ref ? { id: memberId(m.ref), name: m.name } : { id: norm(m.login), name: m.name }));
  return uniq([...members, ...people(team.githubOwners).map((l) => reviewerOf(l, team))]);
}

/** The new pieces of an exploration, as titles, from its library check (the library as it is never counts). */
function pieceTitles(body: string | null | undefined, ids: readonly string[]): string[] {
  const record = parsePiecesRecord(body);
  return ids.map((id) => {
    const p = record?.pieces.find((x) => x.id === id);
    if (!p) return id;
    const i = impactItemOf(p);
    return i.of && i.kind !== 'component' ? `${i.of} ${i.title.toLowerCase()}` : i.title;
  });
}

/** The ids an exploration's author reads as: their login and their member id. */
export function authorIds(body: string | null | undefined, prAuthor?: string | null): string[] {
  const e = parseExplorationBody(body);
  return [prAuthor, e?.author, e?.member ? memberId(e.member) : null].map((x) => (x?.startsWith('member:') ? x : norm(x))).filter((x): x is string => Boolean(x));
}

/**
 * What Done exploring asks for this exploration (core reviewsFor): the product's design review unless off or only the
 * author could give it (or its yes stands from an earlier round), and the library decision when a new piece waits.
 */
export function reviewsToAsk(body: string | null | undefined, x: { team: TeamReviews; product: string | null | undefined; author: readonly string[] }): ReviewsAsked {
  const e = parseExplorationBody(body);
  const record = parsePiecesRecord(body);
  // The pieces a library ask would wait on, as if asked now.
  const asked = e ? { ...e, doneAt: undefined, library: { ...(e.library ?? {}), askedAt: '9999' } } : e;
  const pending = libraryPendingOf(asked, record);
  return reviewsFor({ author: x.author, designReviewers: productReviewers(x.team, x.product), libraryOwners: libraryOwners(x.team), newPieces: pending, designDone: Boolean(e?.designOkAt) });
}

/**
 * An exploration asked before the two reviews (one ask to the lead, `leadAskedAt`, no library ask on record): that one
 * review also decided its new pieces, so while it waits its new pieces wait for a library decision too, asked at the
 * same time (two-reviews decision 7: one row names both hats). Asked with the two reviews, or once the design review
 * answered, the exploration as it is.
 */
export function legacyLibraryAsk(e: ExplorationBlock | null | undefined): ExplorationBlock | null | undefined {
  if (!e || e.library?.askedAt || !e.designAskedAt || e.designOkAt || e.doneAt) return e;
  return { ...e, library: { ...(e.library ?? {}), askedAt: e.designAskedAt } };
}

/** What an exploration In review waits on, for core waitingFor. Both null when nothing waits. */
export function waitingReviews(body: string | null | undefined, x: { team: TeamReviews; product: string | null | undefined; productName?: string | null | undefined; prAuthor?: string | null }): { design: WaitingDesign | null; library: WaitingLibrary | null } {
  const e = parseExplorationBody(body);
  if (!e || e.doneAt) return { design: null, library: null };
  const author = new Set(authorIds(body, x.prAuthor));
  let design: WaitingDesign | null = null;
  if (isDesignReviewWaiting(e)) {
    const asked = (e.designAskedTo ?? []).map((l) => reviewerOf(l, x.team));
    const all = asked.length ? asked : (productReviewers(x.team, x.product) ?? people(x.team.githubOwners).map((l) => reviewerOf(l, x.team)));
    const takerName = e.designTakenByName;
    const takerMember = takerName ? x.team.members.find((m) => m.name === takerName && m.ref) : undefined;
    const taken: Reviewer | null = e.designTakenBy ? reviewerOf(e.designTakenBy, x.team) : takerMember ? { id: memberId(takerMember.ref!), name: takerMember.name } : takerName ? { id: `name:${takerName}`, name: takerName } : null;
    design = { reviewers: all.filter((r) => !author.has(r.id)), takenBy: taken, product: x.productName ?? x.team.products.find((p) => p.key === x.product)?.name ?? null };
  }
  const pending = libraryPendingOf(legacyLibraryAsk(e), parsePiecesRecord(body));
  let library: WaitingLibrary | null = null;
  if (pending.length) {
    const asked = (e.library?.askedTo ?? []).map((l) => reviewerOf(l, x.team));
    const owners = asked.length ? asked : libraryOwners(x.team);
    const others = owners.filter((r) => !author.has(r.id));
    library = { owners: others.length ? others : owners, pieces: pieceTitles(body, pending) };
  }
  return { design, library };
}

/** The second line of an exploration In review: "Waiting for Dana's design review". Null when nothing waits. */
export function waitingLineOf(body: string | null | undefined, x: Parameters<typeof waitingReviews>[1] & { viewer?: ReviewViewer }): string | null {
  return waitingFor({ ...waitingReviews(body, x), viewer: x.viewer });
}

/** The hats an exploration asks of the viewer right now: one Home row names both (owner decision 7). */
export function viewerHats(body: string | null | undefined, x: Parameters<typeof waitingReviews>[1] & { viewer: ReviewViewer }): HatAsk[] {
  const ids = new Set((x.viewer ?? []).map((v) => (v?.startsWith('member:') ? v : norm(v))).filter(Boolean));
  if ([...authorIds(body, x.prAuthor)].some((a) => ids.has(a))) return [];
  const w = waitingReviews(body, x);
  const hats: HatAsk[] = [];
  if (w.design && (w.design.takenBy ? ids.has(w.design.takenBy.id) : w.design.reviewers.some((r) => ids.has(r.id)))) hats.push('design-review');
  if (w.library && w.library.owners.some((r) => ids.has(r.id))) hats.push('library');
  return hats;
}

/** The viewer's ids for the functions above: their GitHub login and their member id. */
export const viewerIds = (login: string | null | undefined, ref: string | null | undefined): string[] => [login ? norm(login) : null, ref ? memberId(ref) : null].filter((x): x is string => Boolean(x));
