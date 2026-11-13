// The header search of a Studio (Cmd+K, components/ds/SearchPalette.tsx) beyond components and tokens: the team's
// explorations, the pieces waiting in Library review, the build requests of Being built, the products and Studio's own
// pages. Each kind is built from what its own Studio page already reads, in that page's words, so a result says what
// its row says. Pure: the reads live in scripts/studio-search.ts. Unit tested in studio-search.test.ts.
//
// Decisions (owner, 2026-11-13):
//   - Results are grouped by kind, in this order: Explorations, Library review, Being built, Products, Components,
//     Tokens, Pages (STUDIO_KIND_ORDER, lib/palette-search rankGrouped).
//   - Each viewer finds only what Studio already shows them: no new read for a role, nothing a role cannot open.
//   - Archived explorations stay out, as they stay out of the Explorations list (its Archived filter finds them).
import { isArchivedExploration, parseExplorationBody, requesterOf, type ProductConfig } from '@bridge-ds/core';
import type { SearchItem, SearchKind } from './search';
import { explorationHref, isListedExploration, type ExplorationPullLike } from './explorations-view';
import { needsReviewRead, type LifecycleStage, type PullReviewLike } from './review-state';
import { explorationState } from './exploration-state';
import { STATE_LABEL, statusOf } from './explorations-page';
import { explorationProduct } from './home-explorations';
import { explorationTitle } from './pr-title';
import { explorationAuthorFor } from './author';
import { agentMade } from './work-nature';
import { waitingForLibraryLine } from './library-impact-view';
import { askedByViewer, decidedTag, type ReviewPiece, type Viewer } from './library-review';
import { waysTag } from './library-askers';
import { authorPerson, CLAUDE, person, requesterPerson, waitingLabel } from './home-model';
import { buildStateOf, NOT_SHIPPED } from './building-page';
import { detailQuery, rowLine, statusTag, viewTitle, type LifecycleExtra } from './building-view';
import type { BuildRequestView } from '@bridge-ds/core';
import { joinSep } from './sep';

/** Studio's kinds, in the order the palette groups them. */
export const STUDIO_KIND_ORDER: readonly SearchKind[] = ['exploration', 'piece', 'request', 'product', 'component', 'token', 'page'];

/** The heading of each group in the palette: the name of the Studio page each kind lives on. */
export const GROUP_LABEL: Record<SearchKind, string> = {
  exploration: 'Explorations',
  piece: 'Library review',
  request: 'Being built',
  product: 'Products',
  component: 'Components',
  token: 'Tokens',
  page: 'Pages',
};

/** Turns a Studio path ("explorations/?exploration=12") into the team's address (lib/team-path studioHref). */
export type StudioHref = (path: string) => string;

// ---------------------------------------------------------------------------------------------------------------
// Studio pages

interface StudioSearchPage {
  /** Relative to the Studio root ('' is Home). */
  route: string;
  label: string;
  meta: string;
  /** Former names and words people look for, so the page that replaced them answers (lib/search.ts formerly). */
  keys: string;
}

/**
 * Studio's pages (the rail, lib/nav studioNav) and the Settings bands people look for by name. The rail's labels and
 * lines; studio-search.test.ts keeps them in step with the nav.
 */
export const STUDIO_SEARCH_PAGES: readonly StudioSearchPage[] = [
  { route: '', label: 'Home', meta: 'What waits for you, suggestions and activity', keys: 'overview start' },
  { route: 'explorations/', label: 'Explorations', meta: 'Every exploration, what waits on you first, from exploring to shipped', keys: 'changes branches drafts history versions reviews pull requests visual impact' },
  { route: 'library-review/', label: 'Library review', meta: 'What enters the library: every piece an exploration asks for, decided one by one or as a list', keys: 'review queue approvals pieces decide' },
  { route: 'building/', label: 'Being built', meta: 'Changes sent from Figma that developers are building, where each one stands, and the next release', keys: 'build requests component change requests figma push developers in progress shipped' },
  { route: 'products/', label: 'All products', meta: 'Every product of the team, and where its explorations stand', keys: 'products apps' },
  { route: 'components/', label: 'Components', meta: 'Status, tokens, code and Figma links per component', keys: 'catalog' },
  { route: 'tokens/', label: 'Tokens', meta: 'Edit tokens into a draft, with live preview and guardrails', keys: 'variables colors token lookup hex' },
  { route: 'quality/', label: 'Quality', meta: 'Contrast gate, token validation, docs completeness and adoption, most severe first', keys: 'checks contrast gate token validation adoption audit docs completeness guidance' },
  { route: 'settings/', label: 'Settings', meta: 'GitHub connection, the repository this workspace reads, and who approves what', keys: 'settings github connection repository governance' },
];

/**
 * The Settings bands people look for by name, at the anchor each Studio's Settings page really has: a team's
 * (pages/team-shell/settings, its bands in TeamSettings.tsx) or Bridge's own (pages/studio/settings). A band one of them
 * lacks is not listed there; studio-search.test.ts reads both pages to keep the anchors true.
 */
export const SETTINGS_SEARCH_BANDS: readonly (Omit<StudioSearchPage, 'route'> & { anchor: { team: string | null; own: string | null } })[] = [
  { label: 'Members', meta: 'Who is in the team, and how they joined', keys: 'people invite team join', anchor: { team: 'team', own: 'team' } },
  { label: 'Review rules', meta: 'Who checks a change before it reaches the library', keys: 'roles owners approvals governance risk tiers reviewers leads', anchor: { team: 'roles', own: 'roles' } },
  { label: 'Figma and Claude', meta: 'Work on the library from Figma or from your own Claude', keys: 'figma plugin mcp claude tools integrations', anchor: { team: 'figma', own: 'tools' } },
];

/** Studio's pages and the Settings bands this Studio has (`team`: a team's Studio, else Bridge's own). */
export function studioPageItems(studio: StudioHref, where: { team: boolean }): SearchItem[] {
  const pages = STUDIO_SEARCH_PAGES.map((p) => ({ kind: 'page' as const, title: p.label, href: studio(p.route), meta: p.meta, keys: p.keys }));
  const bands = SETTINGS_SEARCH_BANDS.flatMap((b) => {
    const anchor = where.team ? b.anchor.team : b.anchor.own;
    return anchor ? [{ kind: 'page' as const, title: b.label, href: studio(`settings/#${anchor}`), meta: b.meta, keys: b.keys }] : [];
  });
  return [...pages, ...bands];
}

// ---------------------------------------------------------------------------------------------------------------
// Products

/** The team's products (the library left out: it is Explorations under Design system), each opening its page. */
export function productItems(products: readonly ProductConfig[], productHref: (key: string) => string): SearchItem[] {
  return products
    .filter((p) => !p.default)
    .map((p) => ({ kind: 'product', title: p.name, href: productHref(p.key), meta: 'Product', keys: p.key }));
}

// ---------------------------------------------------------------------------------------------------------------
// Explorations

export interface ExplorationSearchOptions {
  products: readonly ProductConfig[];
  studio: StudioHref;
  /** A login's profile name, when this browser knows it (scripts/people knownNames): the person reads its first name. */
  profileName?: (login: string) => string | null | undefined;
  /** The design approvers (scripts/teams siteApprovers), as the Explorations list passes them. */
  approvers?: readonly string[];
  /**
   * The developers' tasks, once read (scripts/design-task designTaskStages, keyed by task URL); null while not read.
   * An exploration with a task says no status until they are.
   */
  tasks?: ReadonlyMap<string, LifecycleStage> | null;
  /**
   * The reviews of the explorations the list reads them for (lib/review-state needsReviewRead), keyed as the list keys
   * them ("12", "shop#12"), once read (scripts/review-reads readReviews); null while not read. Such an exploration says
   * no status until they are.
   */
  reviews?: ReadonlyMap<string, readonly PullReviewLike[]> | null;
}

/** The key the Explorations list keeps an exploration by: "12", or "shop#12" in a product's own repository. */
export const explorationSearchKey = (p: Pick<ExplorationPullLike, 'number' | 'product'>) => (p.product ? `${p.product}#${p.number}` : String(p.number));

const taskUrlOf = (body: string | null | undefined): string | null => parseExplorationBody(body ?? null)?.task ?? null;

/** The explorations the Explorations list shows: open, not archived, the ones handed back for review included. */
export function listedExplorations<P extends ExplorationPullLike>(pulls: readonly P[]): P[] {
  const seen = new Set<string>();
  return pulls.filter((p) => {
    if (p.state !== 'open' || seen.has(explorationSearchKey(p))) return false;
    seen.add(explorationSearchKey(p));
    if (isArchivedExploration(p.labels)) return false;
    return isListedExploration(p) || needsReviewRead(p);
  });
}

/**
 * An exploration's status word as the Explorations list says it (scripts/reviews.ts listRow: lib/exploration-state
 * explorationState, then lib/explorations-page statusOf), from the same inputs: its task and its reviews. Null while an
 * input it needs is not read yet, so a row never says another word than the list.
 */
export function explorationStatusWord(p: ExplorationPullLike, o: Pick<ExplorationSearchOptions, 'approvers' | 'tasks' | 'reviews'>): string | null {
  const url = taskUrlOf(p.body);
  if (url && !o.tasks) return null;
  if (needsReviewRead(p) && !o.reviews) return null;
  const stage = explorationState({ pull: p, task: url ? (o.tasks?.get(url) ?? null) : null, approvers: o.approvers ?? [], reviews: o.reviews?.get(explorationSearchKey(p)) ?? null });
  const body = p.body ?? null;
  return STATE_LABEL[statusOf({ lifecycle: 'exploration', stage, body, archived: false, waitsForLibrary: Boolean(body && waitingForLibraryLine(body, () => false)) })];
}

/**
 * Who explores it, by first name, as the Explorations list shows the person (components/ds/studio/BranchesList
 * personOf): the "Requested by" person, else Claude AI for an agent's work, else the exploration's author.
 */
export function explorationPersonName(p: Pick<ExplorationPullLike, 'user' | 'body' | 'labels'>, profileName: (login: string) => string | null | undefined = () => null): string | null {
  const resolve = (login: string) => person(login, profileName(login.replace(/^@/, '').toLowerCase()) ?? null);
  const body = p.body ?? null;
  const requester = requesterOf(body);
  const author = explorationAuthorFor(p.user?.login ?? null, body) ?? p.user?.login ?? null;
  const agent = agentMade({ body, labels: p.labels as never });
  const pp = (requester && requesterPerson(requester, resolve)) ?? (agent ? CLAUDE : author ? authorPerson(author, resolve) : null);
  return pp?.name?.trim() || null;
}

/**
 * The explorations as results, newest activity first. Title: its name; line: its status (when known), who explores it
 * and its product ("In review · Sofia · Acme CRM").
 */
export function explorationItems(pulls: readonly ExplorationPullLike[], o: ExplorationSearchOptions): SearchItem[] {
  return listedExplorations(pulls)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.number - a.number)
    .map((p) => {
      const person = explorationPersonName(p, o.profileName);
      const product = explorationProduct(p, o.products);
      return {
        kind: 'exploration' as const,
        title: explorationTitle(p),
        href: o.studio(`explorations/${explorationHref({ number: p.number, product: p.product })}`),
        meta: joinSep([explorationStatusWord(p, o), person, product]),
        keys: [person, product, p.product].filter(Boolean).join(' '),
      };
    });
}

// ---------------------------------------------------------------------------------------------------------------
// Library review

/**
 * The state words of a piece, as its row on Library review says them (components/ds/studio/LibraryReview.tsx, the
 * State column): what was decided, the ways to pick, the viewer's own approval, an exception, else how long it has
 * waited for a reviewer (lib/home-model waitingLabel, the same tag as Home's). Null when the row shows none.
 */
export function pieceStateWords(p: ReviewPiece, viewer: Pick<Viewer, 'reviews'>, now: number): string | null {
  const d = decidedTag(p);
  if (d) return d.label;
  if (p.conflict && !p.conflict.pick) return waysTag(p.conflict.ways.length);
  if (p.mine && p.designApproved) return 'You approved';
  if (p.exception) return p.exception;
  if (p.state === 'waiting' && p.at && viewer.reviews) return waitingLabel(p.at, now);
  return null;
}

/**
 * The pieces waiting in Library review that the viewer acts on: every waiting piece for someone with the review
 * right, opened in One by one (?piece=); for anyone else only the pieces they asked for, opened on their list (Library
 * review opens a designer on her own pieces, and only a reviewer opens a piece). Title: the piece; line: what it is
 * and its state ("New size · Waiting 2 days").
 */
export function pieceItems(pieces: readonly ReviewPiece[], viewer: Viewer, studio: StudioHref, now: number): SearchItem[] {
  return pieces
    .filter((p) => p.state === 'waiting' && (viewer.reviews || askedByViewer(p, viewer.name)))
    .map((p) => ({
      kind: 'piece' as const,
      title: p.title,
      href: studio(viewer.reviews ? `library-review/?piece=${encodeURIComponent(p.key)}` : 'library-review/'),
      meta: joinSep([p.kind, pieceStateWords(p, viewer, now)]),
      keys: [p.category, p.asked?.designer, p.asked?.name, p.asked?.product, p.by].filter(Boolean).join(' '),
    }));
}

// ---------------------------------------------------------------------------------------------------------------
// Being built

/**
 * The build requests Being built lists by default (Not shipped yet: waiting, being built, in review; lib/building-page
 * NOT_SHIPPED), each opening its detail there. Title: "Avatar: Add a xl size"; line: its status tag, then its row line ("Being built · Malik builds it").
 */
export function requestItems(views: readonly (BuildRequestView & LifecycleExtra)[], o: { studio: StudioHref; now: number; nameOf?: (login: string) => string }): SearchItem[] {
  return views
    .filter((v) => {
      const s = buildStateOf(v, o.now);
      return s !== null && NOT_SHIPPED.includes(s);
    })
    .map((v) => ({
      kind: 'request' as const,
      title: viewTitle(v),
      href: o.studio(`building/${detailQuery(v)}`),
      meta: joinSep([statusTag(v).label, rowLine(v, o.now, o.nameOf)]),
      keys: [v.component, ...v.builders, v.requestedBy].filter(Boolean).join(' '),
    }));
}
