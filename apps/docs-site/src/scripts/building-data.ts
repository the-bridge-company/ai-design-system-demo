// Build requests in the browser: Being built (components/ds/studio/BeingBuilt.tsx), the home line and the Library
// "Figma is ahead" line read them here. Three list reads (component-change issues, bridge-build issues, pull
// requests), each kept in sessionStorage for 5 minutes and shared by every reader of the page. Every team reads its
// own repositories, the demo's sample team included. Rules: lib/building-view.ts and @bridge-ds/core build-requests.ts.
// Being built also lists Claude's fixes (the fix sessions of the team's Claude, api/mcp ?view=sessions) as rows of the
// same list, reconciled with the pull requests read here (lib/claude-connector fixRows). They stay out of `views`, so
// the home line and "Figma is ahead" count build requests only.
// Every row carries where it comes from (lib/build-origin withBuildOrigins); a row with no origin from the lead is
// not listed, so the page, the home line and every count agree with Explorations.
// Explorations handed to developers (Done exploring) are rows of the same list too, read from the pull requests read
// here (no read per row) and, for products with their own repository, from the one read of their open pull requests
// that Changes and the home make too (scripts/product-repos.ts). They stay out of `views` as well.
import type { LibraryNeed } from '@bridge-ds/core';
import { requestReleased } from './library-impact';
import { assembleBuildRequests, BUILD_REQUEST_LABEL, DEFAULT_PRODUCTS, liveAddressOf, parseExplorationBody, listBuildRequestsOnGitHub, REQUEST_LABEL, type BuildRequestView, type GitHubClient, type ProductConfig } from '@bridge-ds/core';
import { fixRows, fixStaysListed, isLoginLike, missingFixPulls, parseSession, type FixRow, type Session } from '../lib/claude-connector';
import { BUILD_CACHE_MS, buildCacheKey, explorationBuildRows, slimIssue, slimPull, toBuildIssue, toBuildPull, withLifecycle, withProducts, type ExplorationBuildRow, type LifecycleExtra, type RestIssue, type RestPull } from '../lib/building-view';
import { inNextRelease, libraryRelease, parseReleaseBody } from '../lib/release-view';
import { needsReviewRead } from '../lib/review-state';
import { readDesignTask } from './design-task';
import { libraryScope } from './next-release';
import { readReviews } from './review-reads';
import { siteApprovers } from './teams';
import { personName } from '../lib/people';
import { isNameAuthor, nameOfAuthor } from '../lib/author';
import { currentAccess, currentContributor, currentViewer, ghGet, hasWorkingToken, readRepo } from './github-session';
import { teamMember } from '../lib/developers-message';
import { previewShotOf } from './preview-shots';
import { knownNames, lookUpNames } from './people';
import { siteConfig } from './repo-context';
import { withBuildOrigins } from '../lib/build-origin';
import { isHosted } from '../lib/team-path';
import { KEPT_VERSION } from '../lib/kept-version';

export interface BuildData {
  views: (BuildRequestView & LifecycleExtra)[];
  /** The issue bodies by number, for the detail (what was sent). */
  bodies: Map<number, string>;
  /** Shown from this browser's cache because GitHub refused a read. */
  stale: boolean;
  nameOf: (login: string) => string;
  /** integrations.jira.baseUrl, for the Jira links. */
  jiraBase: string | null;
  /** Claude's fixes, as rows of the list (none when the site has no connector). */
  fixes?: FixRow[];
  /** The pull requests read, so the fixes can be read again while Claude works without reading GitHub again. */
  pulls?: RestPull[];
  /** Explorations handed to developers, as rows of the list. */
  explorations?: (ExplorationBuildRow & LifecycleExtra)[];
  /** bridge.config.json products, for the product filter. Absent: the default products. */
  products?: readonly ProductConfig[];
  /** Who You is in the people filter: the login or email, else nobody. */
  viewer?: string | null;
  /** The viewer's profile name: their rows read with it where only a name is recorded. */
  viewerName?: string | null;
}

const noRepoPage = () => typeof document !== 'undefined' && document.documentElement.hasAttribute('data-no-repo');

/** The team's fix sessions, or none (no connector here, signed out). */
async function readSessions(repo: string): Promise<Session[]> {
  if (noRepoPage()) return [];
  try {
    const api = await import('./connector-api');
    return (await api.listFixSessions(repo)).map(parseSession).filter((s): s is Session => Boolean(s));
  } catch {
    return [];
  }
}

/** Claude's fixes read again (every 10 seconds while Claude works), against the pull requests already read. */
export async function readFixes(data: Pick<BuildData, 'pulls' | 'nameOf' | 'products'>): Promise<FixRow[]> {
  const pulls = data.pulls ?? [];
  return withBuildOrigins(withProducts(fixRows(await readSessions(repoName()), pulls, Date.now(), data.nameOf).filter(fixStaysListed), { pulls, products: data.products ?? DEFAULT_PRODUCTS }));
}

const repoName = () => {
  const r = readRepo();
  return `${r.owner}/${r.repo}`;
};

function cached<T>(key: string): T[] | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as { at: number; data: T[]; v?: string };
    // Kept by another build or in an older shape (lib/kept-version.ts): read again.
    return v.v === KEPT_VERSION && Date.now() - v.at < BUILD_CACHE_MS && Array.isArray(v.data) ? v.data : null;
  } catch {
    return null;
  }
}

function keep(key: string, data: unknown[]) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), data, v: KEPT_VERSION }));
  } catch {
    /* private mode or quota: one more read next time */
  }
}

async function list<T>(repo: string, what: 'requests' | 'builds' | 'pulls', path: string, slim: (x: T) => T): Promise<{ data: T[]; stale: boolean }> {
  const key = buildCacheKey(repo, what);
  const hit = cached<T>(key);
  if (hit) return { data: hit.map(slim), stale: false };
  const f = await ghGet<T[]>(path);
  const data = f.data.map(slim);
  if (!f.stale) keep(key, data);
  return { data, stale: f.stale };
}

const jiraBase = (): string | null => {
  try {
    const j = (siteConfig() as { integrations?: { jira?: { baseUrl?: string } } }).integrations?.jira?.baseUrl;
    return typeof j === 'string' && j ? j : null;
  } catch {
    return null;
  }
};

let loading: Promise<BuildData> | null = null;

/** Every build request of this page's team, with its status. One load per page; `fresh` reads again. */
export function loadBuildData(opts: { fresh?: boolean } = {}): Promise<BuildData> {
  if (loading && !opts.fresh) return loading;
  loading = read().catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

async function read(): Promise<BuildData> {
  const repo = repoName();
  const now = Date.now();
  // A team shell knows the team's settings (its products and their repositories, the approvers, Jira) once the team is
  // read. Opened directly, no other page read them first: read them here (the one memoized team load), or the product
  // repositories are unknown and their explorations handed to developers never show.
  await teamSettings();
  const R = `/repos/${repo}`;
  const issuePath = (label: string) => `${R}/issues?labels=${encodeURIComponent(label)}&state=all&per_page=100&sort=created&direction=desc`;
  // Loaded on demand, as the home does: the product repositories' reads and the site's products.
  const productRepos = import('./product-repos').catch(() => null);
  const [requests, builds, pulls, sessions, productPulls] = await Promise.all([
    list<RestIssue>(repo, 'requests', issuePath(REQUEST_LABEL), slimIssue),
    list<RestIssue>(repo, 'builds', issuePath(BUILD_REQUEST_LABEL), slimIssue),
    list<RestPull>(repo, 'pulls', `${R}/pulls?state=all&per_page=100&sort=updated&direction=desc`, slimPull),
    readSessions(repo),
    // The open explorations of products with their own repository: the same read as Changes and the home.
    productRepos.then((m) => m?.productPulls() ?? []).catch(() => []),
  ]);
  const seen = new Set<number>();
  // The issues list also answers pull requests carrying the label (a library branch from Figma): they come from the
  // pull request list instead.
  // A request closed as a duplicate is not listed: another request carries the work (GitHub's "Close as duplicate").
  const issues = [...requests.data, ...builds.data].filter((i) => !i.pull_request && i.state_reason !== 'duplicate' && !seen.has(i.number) && seen.add(i.number));
  // Builders and senders by their profile names, as Branches shows them (people.ts), not by their GitHub login.
  // Who asked Claude for a fix too (the connector grant's GitHub login): a name the server wrote stays as written.
  const askers = sessions.flatMap((s) => s.steps.map((x) => x.by)).filter(isLoginLike);
  const explored = [...pulls.data, ...(productPulls as unknown as RestPull[])];
  const doneBy = explored.map((p) => parseExplorationBody(p.body)?.doneBy);
  const logins = [...issues.flatMap((i) => [i.user?.login, ...(i.assignees ?? []).map((a) => a.login)]), ...pulls.data.map((p) => p.user?.login), ...askers, ...doneBy].filter((l): l is string => Boolean(l));
  // The lifecycle (lib/review-state): the reviews of the few pull requests in review (open explorations handed to
  // developers that are no longer drafts, build requests in review), read at once and cached; and the library release
  // (the release pull request the changesets action keeps open, already in the list read) for In the next release.
  const assembled = assembleBuildRequests({ issues: issues.map(toBuildIssue), pulls: pulls.data.map(toBuildPull), now, nameOf: (l) => l });
  const inReview = new Set(assembled.filter((v) => v.status === 'in-review' && v.pull?.state === 'open').map((v) => v.pull!.number));
  const toRead = [
    ...explored.filter((p) => needsReviewRead(p) || (!p.product && inReview.has(Number(p.number)) && p.state === 'open' && p.draft === false)),
  ].map((p) => {
    const own = (p as RestPull & { repo?: string }).repo;
    return { key: p.product ? `${p.product}#${p.number}` : String(p.number), repo: p.product && own ? own : repo, number: Number(p.number), version: p.updated_at ?? p.head?.sha ?? null };
  });
  // The developers' tasks of the design copy's explorations handed to them (one read each, a few at most).
  const taskUrls = [...new Set(explored.filter((p) => p.state === 'open').map((p) => parseExplorationBody(p.body)?.task).filter((u): u is string => Boolean(u)))];
  // Claude's fixes whose pull request is older than the list read: one read each, so a merged one reads Shipped.
  const [names, reviews, tasks, olderFixPulls] = await Promise.all([
    lookUpNames([...new Set(logins)]).catch(() => knownNames()),
    readReviews(toRead.filter((x, i, all) => all.findIndex((y) => y.key === x.key) === i)),
    // Their comments are not read here: Being built says where it stands, the exploration page shows a question.
    Promise.all(taskUrls.map(async (u) => [u, await readDesignTask(u, { comments: false })] as const)).then((all) => new Map(all)),
    readFixPulls(R, missingFixPulls(sessions, pulls.data)),
  ]);
  const nameOf = (l: string) => (isNameAuthor(l) ? nameOfAuthor(l) : personName(l, names));
  // Products added from their address: team members copy their developers a message, with the preview's screenshot
  // when Bridge kept one (one raw file for every exploration, no GitHub API call).
  const products = (await productRepos)?.configuredProducts() ?? DEFAULT_PRODUCTS;
  const member = teamMember({ emailMember: Boolean(currentContributor()), signedIn: Boolean(hasWorkingToken() && currentViewer()), access: currentAccess()?.state ?? null });
  const shots = new Map<string, string>();
  if (member) {
    const elsewhere = explored.filter((p) => p.product && p.state === 'open' && liveAddressOf(products.find((x) => x.key === p.product)));
    await Promise.all(
      elsewhere.map((p) =>
        previewShotOf({ number: Number(p.number), product: p.product })
          .then((s) => s && shots.set(`${p.product}#${p.number}`, s.src))
          .catch(() => undefined),
      ),
    );
  }
  const fixPulls = [...pulls.data, ...olderFixPulls];
  const releaseBody = pulls.data.find((p) => p.state === 'open' && /^changeset-release\//.test(p.head?.ref ?? ''))?.body ?? null;
  const ids = releaseBody ? libraryRelease(parseReleaseBody(releaseBody), libraryScope()).ids : new Set<string>();
  const nextRelease = (p: RestPull) => inNextRelease(p.merge_commit_sha, ids);
  const viewer = currentViewer()?.login ?? null;
  const lifecycle = { reviews: (k: string) => reviews.get(k) ?? null, nextRelease, nameOf, viewer };
  const task = (u: string) => tasks.get(u) ?? null;
  // Waiting for the library (board LI6): one read per library request an approved exploration needs.
  const needs = explored.flatMap((p) => parseExplorationBody(p.body)?.library?.neededBy ?? []);
  const releasedKeys = new Set((await Promise.all(needs.map(async (n) => ((await requestReleased(n)) ? `${n.repo.toLowerCase()}#${n.number}` : null)))).filter((k): k is string => Boolean(k)));
  const released = (n: LibraryNeed) => releasedKeys.has(`${n.repo.toLowerCase()}#${n.number}`);
  // Only what comes from the lead is listed (lib/build-origin): an exploration sent to developers, or a library change
  // the lead approved. Every reader of these rows (the page, the home line, the counts) follows.
  const origins = { issues, pulls: pulls.data, products };
  return {
    views: withBuildOrigins(withProducts(withLifecycle(assembleBuildRequests({ issues: issues.map(toBuildIssue), pulls: pulls.data.map(toBuildPull), now, nameOf }), { pulls: pulls.data, ...lifecycle }), { issues, pulls: pulls.data, products }), origins),
    bodies: new Map(issues.map((i) => [i.number, i.body ?? ''])),
    stale: requests.stale || builds.stale || pulls.stale,
    nameOf,
    jiraBase: jiraBase(),
    fixes: withBuildOrigins(withProducts(fixRows(sessions, fixPulls, now, nameOf).filter(fixStaysListed), { pulls: fixPulls, products }), origins),
    pulls: fixPulls,
    explorations: withBuildOrigins(explorationBuildRows(explored, { products, now, approvers: approversNow(), ...lifecycle, task, member, shot: (k) => shots.get(k) ?? null, released }), origins),
    products,
    ...viewerOf(),
  };
}

/** Who You is, as on Changes: the signed-in person (a GitHub login, or an email member's address), else nobody. */
function viewerOf(): Pick<BuildData, 'viewer' | 'viewerName'> {
  const me = currentViewer();
  const login = me?.login ?? currentContributor()?.email ?? null;
  return { viewer: login, viewerName: me?.name ?? currentContributor()?.name ?? null };
}

/** On a team shell, the team's settings read (scripts/team-data, memoized per page); a failed read keeps the defaults. */
async function teamSettings(): Promise<void> {
  if (!isHosted()) return;
  await import('./team-data').then((m) => m.loadTeamData()).catch(() => null);
}

/** The fix pull requests the list did not return, read at once; one GitHub refuses is left out (the row stays In review). */
async function readFixPulls(R: string, numbers: readonly number[]): Promise<RestPull[]> {
  const read = await Promise.all(numbers.map((n) => ghGet<RestPull>(`${R}/pulls/${n}`).then((f) => slimPull(f.data), () => null)));
  return read.filter((p): p is RestPull => p !== null);
}

/** The design approvers, teams expanded once read (none when the roles cannot be read). */
function approversNow(): string[] {
  try {
    return siteApprovers().design;
  } catch {
    return [];
  }
}

/** The open build requests' views of a team read with its own client (a team's Library page). */
export async function buildViewsFor(_repo: string, client: GitHubClient): Promise<{ views: BuildRequestView[]; nameOf: (login: string) => string }> {
  const known = (names: ReturnType<typeof knownNames>) => (l: string) => (isNameAuthor(l) ? nameOfAuthor(l) : personName(l, names));
  const views = await listBuildRequestsOnGitHub(client, { nameOf: known(knownNames()) });
  // The people building them by their names ("Malik", never "acme-malik"), as Studio says them (scripts/people
  // lookUpNames: once a week per person); the login stays only when GitHub gives no name.
  const logins = [...new Set(views.flatMap((v) => v.builders).filter((l) => !isNameAuthor(l)))];
  const names = logins.length ? await lookUpNames(logins).catch(() => knownNames()) : knownNames();
  return { views, nameOf: known(names) };
}
