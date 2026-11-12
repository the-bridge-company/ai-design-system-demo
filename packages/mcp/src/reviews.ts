// The two reviews (docs/specs/two-reviews.md, core two-reviews.ts) as the MCP tools and the CLI read them from
// bridge.config.json: who decides what the library keeps (governance.owners.design, the library owners, for every
// product) and who reviews a product's design before the developers (products[].designReview, core designReviewOf).
// The same computation as Studio's team-reviews.ts for a GitHub team: people are GitHub logins, named by their login.
// Teams whose members joined by email keep their settings on Bridge's server; the hosted connector reads them there.
//
// Pure: no fetch. Tested through the tools (test/explorations.test.ts, test/branches.test.ts).
import {
  designReviewOf,
  HAT_WORDS,
  impactItemOf,
  isDesignReviewWaiting,
  libraryPendingOf,
  noReviewLine,
  parseExplorationBody,
  parsePiecesRecord,
  productOfBranch,
  productsOf,
  reviewsFor,
  waitingFor,
  type BridgeConfig,
  type GitHubClient,
  type HatAsk,
  type PieceVerdict,
  type ProductConfig,
  type PullRequestSummary,
  type Reviewer,
  type ReviewsAsked,
  type ReviewViewer,
  type WaitingDesign,
  type WaitingLibrary,
} from '@bridge-ds/core';

const norm = (s: string | null | undefined) => (s ?? '').trim().replace(/^@/, '').toLowerCase();
const people = (l: readonly string[]) => [...new Set(l.map(norm).filter((x) => x && !x.includes('/')))];

/** A GitHub login as a reviewer: the login is the name people read. A member id (`member:<ref>`) keeps its id. */
export const reviewerOf = (login: string): Reviewer => ({ id: login.startsWith('member:') ? login : norm(login), name: login.startsWith('member:') ? login.slice(7) : norm(login) });

/** Decides what the library keeps: the design owners of bridge.config.json (people, never GitHub teams). */
export function libraryOwnersOf(config: BridgeConfig): Reviewer[] {
  return people(config.governance.owners.design).map(reviewerOf);
}

/** A product's design reviewers (everyone who may give it; the author is taken out later). Null when it is off. */
export function productReviewersOf(config: BridgeConfig, product: Pick<ProductConfig, 'key' | 'designReview'> | null): Reviewer[] | null {
  const s = designReviewOf(product, config.governance.owners.design);
  if (!s.on) return null;
  // bridge.config.json names people; "any designer" is a setting of email teams, read on the server.
  return s.reviewers === 'any-designer' ? libraryOwnersOf(config) : s.reviewers.map(reviewerOf);
}

/** The product an exploration belongs to: the product repository it lives in, else its product label. */
export function productOfExploration(config: BridgeConfig, x: { product?: ProductConfig | string | null | undefined; labels?: readonly string[] | null | undefined }): ProductConfig {
  const products = productsOf(config);
  if (x.product && typeof x.product === 'object') return x.product;
  if (typeof x.product === 'string') {
    const hit = products.find((p) => p.key === x.product);
    if (hit) return hit;
  }
  return productOfBranch(products, { labels: x.labels ?? [], files: null });
}

/** The new pieces of an exploration, as titles ("Timeline", "Badge overdue tone"). */
export function pieceTitles(body: string | null | undefined, ids: readonly string[]): string[] {
  const record = parsePiecesRecord(body);
  return ids.map((id) => {
    const p = record?.pieces.find((x) => x.id === id);
    if (!p) return id;
    const i = impactItemOf(p);
    return i.of && i.kind !== 'component' ? `${i.of} ${i.title.toLowerCase()}` : i.title;
  });
}

/** The ids an exploration's author reads as: the person saying Done exploring, the block's author, the pull request's. */
export function authorIdsOf(body: string | null | undefined, extra: readonly (string | null | undefined)[]): string[] {
  const e = parseExplorationBody(body);
  return [...new Set([...extra, e?.author, e?.member ? `member:${e.member}` : null].map((x) => (x?.startsWith('member:') ? x : norm(x))).filter((x): x is string => Boolean(x)))];
}

/**
 * What Done exploring asks for this exploration (core reviewsFor): the product's design review unless off, only the
 * author could give it, or its Looks right stands from an earlier round; the library decision when a new piece waits.
 */
export function reviewsToAsk(config: BridgeConfig, body: string | null | undefined, x: { product: ProductConfig; author: readonly string[] }): ReviewsAsked {
  const e = parseExplorationBody(body);
  // The pieces a library ask would wait on, as if asked now.
  const asked = e ? { ...e, doneAt: undefined, library: { ...(e.library ?? {}), askedAt: '9999' } } : e;
  const pending = libraryPendingOf(asked, parsePiecesRecord(body));
  return reviewsFor({ author: x.author, designReviewers: productReviewersOf(config, x.product), libraryOwners: libraryOwnersOf(config), newPieces: pending, designDone: Boolean(e?.designOkAt) });
}

/** The line when nothing is asked, or when only the author could give the design review (core noReviewLine). */
export function noReviewOf(asked: ReviewsAsked, x: { product: ProductConfig; authorName?: string | null | undefined }): string | null {
  return noReviewLine({ product: x.product.name, noDesign: asked.noDesign, library: Boolean(asked.library), authorName: x.authorName });
}

/** What an exploration In review waits on, for core waitingFor. Both null when nothing waits. */
export function waitingReviewsOf(config: BridgeConfig, body: string | null | undefined, x: { product: ProductConfig; prAuthor?: string | null | undefined }): { design: WaitingDesign | null; library: WaitingLibrary | null } {
  const e = parseExplorationBody(body);
  if (!e || e.doneAt) return { design: null, library: null };
  const author = new Set(authorIdsOf(body, [x.prAuthor]));
  let design: WaitingDesign | null = null;
  if (isDesignReviewWaiting(e)) {
    const asked = (e.designAskedTo ?? []).map(reviewerOf);
    const all = asked.length ? asked : (productReviewersOf(config, x.product) ?? libraryOwnersOf(config));
    const taken: Reviewer | null = e.designTakenBy ? reviewerOf(e.designTakenBy) : e.designTakenByName ? { id: `name:${e.designTakenByName}`, name: e.designTakenByName } : null;
    design = { reviewers: all.filter((r) => !author.has(r.id)), takenBy: taken, product: x.product.name };
  }
  const pending = libraryPendingOf(e, parsePiecesRecord(body));
  let library: WaitingLibrary | null = null;
  if (pending.length) {
    const asked = (e.library?.askedTo ?? []).map(reviewerOf);
    const owners = asked.length ? asked : libraryOwnersOf(config);
    const others = owners.filter((r) => !author.has(r.id));
    library = { owners: others.length ? others : owners, pieces: pieceTitles(body, pending) };
  }
  return { design, library };
}

/** The second line of an exploration In review ("Waiting for peterbono's design review"), or null when nothing waits. */
export function waitingLineOf(config: BridgeConfig, body: string | null | undefined, x: { product: ProductConfig; prAuthor?: string | null | undefined; viewer?: ReviewViewer }): string | null {
  return waitingFor({ ...waitingReviewsOf(config, body, x), viewer: x.viewer });
}

/** The hats an exploration asks of the viewer right now (one queue item names both). Never on their own exploration. */
export function viewerHatsOf(config: BridgeConfig, body: string | null | undefined, x: { product: ProductConfig; prAuthor?: string | null | undefined; viewer: string | null }): HatAsk[] {
  const me = norm(x.viewer);
  if (!me || authorIdsOf(body, [x.prAuthor]).includes(me)) return [];
  const w = waitingReviewsOf(config, body, x);
  const hats: HatAsk[] = [];
  if (w.design && (w.design.takenBy ? w.design.takenBy.id === me : w.design.reviewers.some((r) => r.id === me))) hats.push('design-review');
  if (w.library && w.library.owners.some((r) => r.id === me)) hats.push('library');
  return hats;
}

/** A library answer in words, for Claude to tell the designer which hat said what. */
export const VERDICT_WORDS: Record<PieceVerdict, string> = {
  approved: 'Add to the library',
  changes: 'Ask for changes',
  local: 'Keep in the screen only',
  existing: 'Use an existing piece instead',
};

/** The library owners' answer on each piece of an exploration (block.library.decisions). */
export function libraryAnswersOf(body: string | null | undefined) {
  const e = parseExplorationBody(body);
  const decisions = e?.library?.decisions ?? [];
  const titles = pieceTitles(body, decisions.map((d) => d.piece));
  return decisions.map((d, i) => ({
    piece: d.piece,
    title: titles[i]!,
    verdict: d.verdict,
    answer: VERDICT_WORDS[d.verdict],
    ...(d.text ? { text: d.text } : {}),
    ...(d.use ? { use: d.use } : {}),
    by: d.byName ?? d.by ?? null,
    at: d.at,
  }));
}

/** Both roles of Settings > Reviews, as bridge.config.json holds them (bridge_get_settings, bridge_get_config). */
export function reviewRolesOf(config: BridgeConfig) {
  const owners = libraryOwnersOf(config);
  return {
    library: {
      role: HAT_WORDS.libraryRole,
      scope: 'The whole team, for every product (one library). Never off.',
      who: owners.map((r) => `@${r.id}`),
      from: 'governance.owners.design',
    },
    designReview: {
      role: HAT_WORDS.designRole,
      scope: 'Each product, before the developers build its screens. Off per product.',
      from: 'products[].designReview (absent: the design owners; the Library: off)',
      products: productsOf(config).map((p) => {
        const r = productReviewersOf(config, p);
        return { key: p.key, name: p.name, on: r !== null, reviewers: r ? r.map((x) => `@${x.id}`) : [] };
      }),
    },
    rule: 'Done exploring asks the library decision when the screen has something new for the library, and the product\'s design review when it is on and someone other than the author can give it. Both start together. Ready to build once both answered; with neither, straight to Ready to build. Nobody reviews their own exploration.',
  };
}

/**
 * A client that keeps every pull request its listings return (body and labels included), keyed "owner/name#n", so a
 * list reads each exploration's reviews without another GitHub read.
 */
export function keepingPulls(client: GitHubClient, sink: Map<string, PullRequestSummary>): GitHubClient {
  return new Proxy(client, {
    get(target, key) {
      const v = Reflect.get(target, key, target) as unknown;
      if (key === 'listPullRequests' && typeof v === 'function') {
        return async (...args: unknown[]) => {
          const list = (await (v as (...a: unknown[]) => Promise<PullRequestSummary[]>).apply(target, args)) ?? [];
          for (const p of list) sink.set(`${target.fullName.toLowerCase()}#${p.number}`, p);
          return list;
        };
      }
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v;
    },
  });
}
