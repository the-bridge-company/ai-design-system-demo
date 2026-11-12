// Library review in the browser (components/ds/studio/LibraryReview.tsx): what it reads and what it writes. Reads the
// same lists as Changes and the exploration page, no list of its own:
//   - the open changes of the design system repository (one read, shared through ghGet's cache with the nav count),
//     the library's own ones (the Library group of Changes: not an exploration, not Bridge's own work), and their
//     review statuses (scripts/pr-status loadStatuses, the same rule as every status pill);
//   - the recently closed ones, for Decided (what shipped);
//   - the open explorations of every product (scripts/product-repos productPulls, the read the exploration page makes
//     for conflicts): their recorded library pieces, the lead's decisions on them, and the conflicts between them.
// Writes are the exploration page's own (core decidePieceOnGitHub, chooseLibraryWayOnGitHub) and the review's own
// (scripts/reviews approveBranch, core commentOnGitHub), so a decision here is the decision there. On the sample team
// every write is refused before it leaves (the buttons carry data-demo-write, scripts/demo-gate).
// The rules are pure in lib/library-review.ts.
import {
  commentOnGitHub,
  decidePieceOnGitHub,
  chooseLibraryWayOnGitHub,
  effectiveTier,
  explorationKeyOf,
  impactItems,
  isToolingPull,
  isWaitingForLead,
  libraryConflicts,
  parseExplorationBody,
  parseNeededBy,
  parsePiecesRecord,
  productsOf,
  requesterOf,
  reviewQueue,
  type ImpactSource,
  type LibraryConflict,
  type ProductConfig,
  type ToolingConfig,
} from '@bridge-ds/core';
import { currentContributor, currentViewer, ghGet, getToken, readRepo, studioClient } from './github-session';
import { siteConfig } from './repo-context';
import { loadStatuses } from './pr-status';
import { productClient, productPulls } from './product-repos';
import { impactSourceOf } from './library-impact';
import { asIsOption, decisionConflicts } from '../lib/library-as-is';
import { viewerRole } from './needs-you';
import { viewerDecidesExplorations } from './design-lead';
import { deciderNames } from '../lib/design-lead';
import { siteApprovers, loadTeams } from './teams';
import { knownNames } from './people';
import { isHomeExploration } from '../lib/home-explorations';
import { needsReviewRead } from '../lib/review-state';
import { explorationHref } from '../lib/explorations-view';
import { studioHref } from '../lib/team-path';
import {
  explorationAskKey,
  mergePieces,
  pieceOfChange,
  pieceOfConflict,
  pieceOfExploration,
  type ReviewPiece,
  type Viewer,
} from '../lib/library-review';
import type { ThumbSpec } from '../lib/branch-thumb';
import { askingScreens, type ReachProductInput } from '../lib/library-reach';
import { previewOf } from '../lib/home-explorations';
import { shotThumb } from '../lib/preview-shots';

interface Pull {
  number: number;
  title: string;
  body: string | null;
  state: string;
  draft?: boolean;
  merged_at?: string | null;
  labels: { name: string }[];
  user: { login: string; type?: string };
  head: { ref: string; sha: string };
  base: { ref: string; sha: string };
  updated_at: string;
  html_url?: string;
  requested_reviewers?: { login: string }[] | null;
}

export interface ReviewData {
  pieces: ReviewPiece[];
  viewer: Viewer;
  /** The lead a designer's banner names ("Dana"), or null when Bridge does not know one. */
  lead: string | null;
  /** The tech owner a Tier 3 piece waits on, by name. */
  tech: string | null;
  /** Another lead, by name: who a lead's own change waits on. */
  secondLead: string | null;
  /** The statuses are still being read: tags may still move. */
  loading: boolean;
  failed: string | null;
  /** Before and after of a library change, once read (by piece key). */
  thumbs: Map<string, ThumbSpec>;
  /** The team's products, for Who gets it and the Map (lib/library-reach). */
  products: ReachProductInput[];
  /** The preview capture of each exploration that asked for a piece, by screenKey (its plate while none exists). */
  screens: Map<string, ThumbSpec>;
  /** Where on its preview each of those captures is ("/?t=a#/products"), by screenKey, when known. */
  screenRoutes: Map<string, string | null>;
}

/** The key of an asking exploration's screen in ReviewData.screens. */
export const screenKey = (s: { productKey: string | null; number: number }) => `${(s.productKey ?? '').toLowerCase()}#${s.number}`;

const same = (a?: string | null, b?: string | null) => Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

function teamProducts(): ProductConfig[] {
  try {
    return productsOf(siteConfig() as { products?: ProductConfig[] });
  } catch {
    return productsOf(null);
  }
}

function tooling(): ToolingConfig | null {
  try {
    return (siteConfig() as { tooling?: ToolingConfig }).tooling ?? null;
  } catch {
    return null;
  }
}

function leadsPublishTier1(): boolean {
  try {
    return (siteConfig() as { governance?: { leadsPublishTier1?: boolean } }).governance?.leadsPublishTier1 !== false;
  } catch {
    return true;
  }
}

/** The viewer as this page reads them: the review right (the same as Home's queue and the nav count), and their name. */
export function readViewer(): Viewer {
  const member = currentContributor();
  const login = currentViewer()?.login ?? null;
  const name = member?.name ?? (login ? (knownNames()[login.toLowerCase()]?.name ?? login) : null);
  return { reviews: viewerRole() === 'reviewer' || viewerDecidesExplorations(), name: name ? name.split(/\s+/)[0]! : null, leadsPublishTier1: leadsPublishTier1() };
}

const firstName = (n: string | null | undefined) => (n?.trim() ? n.trim().split(/\s+/)[0]! : null);

/** The design lead and the tech owner, by name: an email lead of the team first, else the owners Bridge knows a name for. */
async function leadNames(me: string | null): Promise<{ lead: string | null; tech: string | null; secondLead: string | null }> {
  const { owner, repo } = readRepo();
  const names = knownNames();
  const nameOf = (l: string) => firstName(names[l.toLowerCase()]?.name) ?? null;
  const owners = siteApprovers();
  let lead = owners.design.map(nameOf).find(Boolean) ?? null;
  const tech = owners.tech.map(nameOf).find((n) => n && !same(n, me)) ?? null;
  let secondLead = owners.design.map(nameOf).find((n) => n && !same(n, me)) ?? null;
  try {
    const { contributeTeam } = await import('./contribute-session');
    const team = await contributeTeam(`${owner}/${repo}`, currentContributor() ? null : getToken());
    // The same lead the exploration page names (lib/design-lead deciderNames): the email lead who runs the team first.
    const emailLead = deciderNames(team.members, [])[0];
    if (emailLead) lead = emailLead;
    const other = team.members.find((m) => (m.lead || m.role === 'admin') && !same(firstName(m.name), me));
    if (other) secondLead = firstName(other.name);
  } catch {
    // No member list here (a GitHub-only team): the owners' names stay.
  }
  return { lead, tech, secondLead };
}

/** One exploration's designer, by name. */
const designerOf = (s: ImpactSource) => firstName(s.designer);

/** Reads everything the page shows, painting as it goes. */
export async function loadLibraryReview(paint: (d: ReviewData) => void): Promise<void> {
  // A team address: the team's settings (products, owners, governance) are read first, as every team page does.
  const { teamOfPage, loadTeamData } = await import('./team-data');
  if (teamOfPage()) await loadTeamData().catch(() => null);
  const { owner, repo } = readRepo();
  const ds = `${owner}/${repo}`;
  const products = teamProducts();
  const productName = (key: string | null) => (key ? (products.find((p) => p.key.toLowerCase() === key.toLowerCase())?.name ?? key) : null);
  let viewer = readViewer();
  const data: ReviewData = {
    pieces: [],
    viewer,
    lead: null,
    tech: null,
    secondLead: null,
    loading: true,
    failed: null,
    thumbs: new Map(),
    products: products.map((p) => ({ key: p.key, name: p.name, default: Boolean(p.default) })),
    screens: new Map(),
    screenRoutes: new Map(),
  };
  const emit = () => paint({ ...data, viewer, pieces: [...data.pieces], thumbs: new Map(data.thumbs), screens: new Map(data.screens), screenRoutes: new Map(data.screenRoutes) });

  let open: Pull[];
  try {
    open = (await ghGet<Pull[]>(`/repos/${ds}/pulls?state=open&per_page=100`)).data;
  } catch {
    data.loading = false;
    data.failed = 'GitHub could not be reached. Reload the page to try again.';
    emit();
    return;
  }
  await loadTeams().catch(() => undefined);
  viewer = readViewer();
  const closedRead = ghGet<Pull[]>(`/repos/${ds}/pulls?state=closed&sort=updated&direction=desc&per_page=30`)
    .then((r) => r.data.filter((p) => p.merged_at))
    .catch(() => [] as Pull[]);
  const namesRead = leadNames(viewer.name).then((n) => Object.assign(data, n));

  // The library's own changes: the Library group of Changes.
  const library = (list: Pull[]) =>
    reviewQueue(list.map((p) => ({ ...p, state: p.state ?? 'open' })) as never as Pull[]).filter(
      (p) => !isHomeExploration(p as never, products) && !needsReviewRead(p as never) && !isToolingPull({ title: p.title, headRef: p.head.ref, labels: p.labels, files: null }, tooling()),
    );
  const changes = library(open);
  const statuses = new Map<number, string | null>();
  const mineOf = (p: Pull) => {
    const req = requesterOf(p.body);
    const v = currentViewer();
    if (req?.login ? same(req.login, v?.login) : req?.name ? same(firstName(req.name), viewer.name) : same(p.user.login, v?.login)) return true;
    return false;
  };
  const byOf = (p: Pull) => firstName(requesterOf(p.body)?.name) ?? firstName(knownNames()[p.user.login.toLowerCase()]?.name) ?? null;
  // Who explored each open exploration (lib/author explorerName, read from the exploration itself): a change it needs
  // names that person, never whoever asked for the change. Filled once the explorations are read.
  const designers = new Map<string, string>();
  const changePiece = (p: Pull, merged = false) =>
    pieceOfChange(
      {
        repo: ds,
        number: p.number,
        title: p.title,
        body: p.body,
        labels: p.labels,
        headRef: p.head.ref,
        statusKind: merged ? 'merged' : (statuses.get(p.number) ?? null),
        merged,
        tier: effectiveTier(p.labels, p.body, null),
        mine: mineOf(p),
        by: byOf(p),
        designers,
        nearest: parseNeededBy(p.body)?.nearest ?? null,
        at: p.updated_at ?? null,
      },
      products,
    );

  // The explorations' own pieces, and the conflicts between them.
  let explorationPieces: ReviewPiece[] = [];
  let conflictPieces: ReviewPiece[] = [];
  const linked = new Set<string>();
  for (const p of open) {
    const n = parseNeededBy(p.body);
    if (n?.piece && n.repo && n.pr) linked.add(`${n.repo.toLowerCase()}#${n.pr}:${n.piece}`);
  }
  const explorationsRead = (async () => {
    const pulls = (await productPulls().catch(() => [])) as (ReturnType<typeof Object> & { number: number; title?: string; body?: string | null; repo: string; product: string; user?: { login?: string } | null })[];
    const own = open.filter((p) => isHomeExploration(p as never, products)).map((p) => ({ ...p, repo: ds, product: products.find((x) => x.default)?.key ?? 'library' }));
    const all = [...pulls, ...own];
    const sources = all.map((p) => ({ p, s: impactSourceOf(p as never, p.repo, productName(p.product) ?? p.product) }));
    for (const { p, s } of sources) {
      const who = designerOf(s);
      if (who) designers.set(explorationAskKey({ number: p.number, productKey: p.repo.toLowerCase() === ds.toLowerCase() ? null : p.product, name: s.name }, ds), who);
    }
    const xpPieces: ReviewPiece[] = [];
    const seenConflicts = new Map<string, ReviewPiece>();
    for (const { p, s } of sources) {
      const record = s.record;
      if (!record?.pieces.length) continue;
      for (const l of record.links) linked.add(`${p.repo.toLowerCase()}#${p.number}:${l.piece}`);
      const block = parseExplorationBody(p.body);
      const href = studioHref(`explorations/${explorationHref({ number: p.number, product: p.repo.toLowerCase() === ds.toLowerCase() ? null : p.product })}`);
      const mine = same(designerOf(s), viewer.name) || same(p.user?.login, currentViewer()?.login);
      for (const item of impactItems(record)) {
        const raw = record.pieces.find((x) => x.id === item.id);
        const decision = block?.library?.decisions?.find((d) => d.piece === item.id) ?? null;
        // A change at a value the library already has (Compact) uses the library as is: not a decision, no item.
        if (!decision && raw && asIsOption(raw)) continue;
        const piece = pieceOfExploration({
          repo: p.repo,
          number: p.number,
          name: s.name,
          product: s.product,
          productKey: p.repo.toLowerCase() === ds.toLowerCase() ? null : p.product,
          href,
          designer: designerOf(s),
          item,
          decision,
          nearest: raw?.nearest ? { label: raw.nearest.label, level: raw.nearest.level } : null,
          asked: isWaitingForLead(p.body),
          mine,
          at: (p as { updated_at?: string }).updated_at ?? null,
        });
        if (piece) xpPieces.push(piece);
      }
      // Only the parts where a way is new to the library are decisions (lib/library-as-is).
      const conflicts: LibraryConflict[] = decisionConflicts(
        libraryConflicts(
          s,
          sources.map((x) => x.s),
        ),
        sources.map((x) => x.s),
      );
      for (const c of conflicts) {
        const k = `${c.component.toLowerCase()}|${c.property.toLowerCase()}`;
        if (seenConflicts.has(k)) continue;
        // The other side's own piece of the same part, and today's value when either check knows it.
        const part = (x: ImpactSource) => impactItems(x.record).find((i) => i.of?.toLowerCase() === c.component.toLowerCase() && i.property?.toLowerCase() === c.property.toLowerCase());
        const other = sources.find((x) => x.s.key === c.other.key)?.s;
        const mineItem = part(s);
        const otherItem = other ? part(other) : undefined;
        seenConflicts.set(
          k,
          pieceOfConflict(c, { name: s.name, product: s.product, href, productKey: p.repo.toLowerCase() === ds.toLowerCase() ? null : p.product }, viewer.name, {
            otherPiece: otherItem?.id ?? null,
            today: mineItem?.before ?? otherItem?.before ?? null,
          }),
        );
      }
    }
    explorationPieces = xpPieces;
    conflictPieces = [...seenConflicts.values()];
  })().catch(() => undefined);

  let closed: Pull[] = [];
  const build = () => {
    const changeList = [...changes.map((p) => changePiece(p)), ...library(closed.map((p) => ({ ...p, state: 'open' }))).map((p) => changePiece(p, true))];
    data.pieces = mergePieces(changeList, explorationPieces, conflictPieces, linked);
  };
  build();
  emit();
  await Promise.all([
    loadStatuses(changes as never, (p, st) => {
      statuses.set(p.number, st?.kind ?? null);
    }).then(() => (build(), emit())),
    explorationsRead.then(() => (build(), emit())),
    closedRead.then((c) => ((closed = c), build(), emit())),
    namesRead.then(() => emit()),
  ]);
  data.loading = false;
  build();
  emit();
  // Before and after of each library change, read after the list (the home's own read and cache), and the preview
  // capture of each exploration that asked for a piece (Who gets it): the same capture as its card and its page.
  const { thumbOf } = await import('./home-data');
  const { previewShotOf } = await import('./preview-shots');
  const asking = new Map<string, { number: number; productKey: string | null; name: string; product: string | null }>();
  for (const p of data.pieces)
    for (const sc of askingScreens(p, data.products)) if (sc.number) asking.set(screenKey(sc), { number: sc.number, productKey: sc.productKey, name: sc.name, product: productName(sc.productKey) });
  await Promise.all([
    ...changes.map(async (p) => {
      const spec = await thumbOf(p as never, false).catch(() => null);
      if (spec) data.thumbs.set(`c:${ds.toLowerCase()}#${p.number}`, spec);
    }),
    ...[...asking].map(async ([k, sc]) => {
      const shot = await previewShotOf({ number: sc.number, product: sc.productKey }).catch(() => null);
      const plate = { product: sc.product ?? '', screen: sc.name, seed: k };
      data.screens.set(k, previewOf(shot ? shotThumb(shot, plate) : null, plate));
      data.screenRoutes.set(k, shot?.route ?? null);
    }),
  ]);
  emit();
}

// ---------------------------------------------------------------------------------------------------------------
// Writes: the exploration page's and the review's own.

const me = () => {
  const member = currentContributor();
  const viewer = currentViewer()?.login ?? null;
  return member ? { byName: member.name } : viewer ? { by: viewer } : {};
};

const clientFor = (repo: string) => {
  const { owner, repo: name } = readRepo();
  return repo.toLowerCase() === `${owner}/${name}`.toLowerCase() ? studioClient(repo) : productClient(repo);
};

export type Decision = 'add' | 'keep' | 'existing' | 'keep-both';

/**
 * Decides one piece. A library change: Add approves it (the review's own approval), Keep records "kept in this
 * screen" on the exploration that asked for it. An exploration's piece: the exploration page's own answer.
 */
export async function decide(p: ReviewPiece, d: Decision): Promise<string> {
  const products = teamProducts();
  if (d === 'keep-both') {
    // A conflict kept in both screens: each exploration answers its own piece, as its page would.
    const ways = p.conflict?.ways ?? [];
    for (const w of ways) {
      const at = /^(.+)#(\d+)$/.exec(w.key);
      if (!at || !w.piece) continue;
      await decidePieceOnGitHub(clientFor(at[1]!), Number(at[2]), { piece: w.piece, verdict: 'local', ...me(), products });
    }
    return `Kept ${p.title} in both screens. ${ways.map((w) => w.designer).join(' and ')} are told.`;
  }
  if (p.source.kind === 'change') {
    if (d === 'add') {
      const { approveBranch } = await import('./reviews');
      await approveBranch(p.source.number);
      return `Added ${p.title} to the library.`;
    }
    // Kept: the exploration that asked for it records it, as its own page would.
    const pull = (await ghGet<Pull>(`/repos/${p.source.repo}/pulls/${p.source.number}`)).data;
    const n = parseNeededBy(pull.body);
    if (!n?.pr || !n.piece) throw new Error('Bridge cannot tell which exploration asked for this. Open the change to decide it.');
    const repo = n.repo ?? p.source.repo;
    await decidePieceOnGitHub(clientFor(repo), n.pr, { piece: n.piece, verdict: 'local', ...me(), products });
    return `Kept ${p.title} in ${p.asked?.designer ? `${p.asked.designer}'s` : 'its'} screen.`;
  }
  const verdict = d === 'add' ? 'approved' : d === 'keep' ? 'local' : 'existing';
  const { owner, repo } = readRepo();
  await decidePieceOnGitHub(clientFor(p.source.repo), p.source.number, {
    piece: p.source.piece,
    verdict,
    ...(d === 'existing' && p.match ? { use: p.match.label } : {}),
    ...me(),
    ...(p.source.repo.toLowerCase() !== `${owner}/${repo}`.toLowerCase() ? { library: studioClient(`${owner}/${repo}`) } : {}),
    products,
    source: 'studio',
  });
  return d === 'add' ? `Added ${p.title} to the library.` : d === 'keep' ? `Kept ${p.title} in its screen.` : `${p.asked?.designer ?? 'The designer'} is asked to use ${p.match?.label ?? 'the existing piece'} instead.`;
}

/** Picks one way of a conflict (or both): the exploration page's own choice, kept on both explorations. */
export async function pickWay(p: ReviewPiece, pick: string, myName: string | null): Promise<string> {
  const c = p.conflict;
  if (!c || p.source.kind !== 'piece') throw new Error('This choice is no longer needed. Reload the page.');
  const other = c.ways.find((w) => w.key !== p.asked?.key) ?? c.ways[1]!;
  const at = /^(.+)#(\d+)$/.exec(other.key);
  if (!at) throw new Error('Bridge cannot find the other exploration.');
  const kept = c.ways.find((w) => w.key === pick);
  // The pick of the checked rows (lib/library-review-compare checkedPick): one way, today as it is, or sizes.
  const chosen = kept ? `${kept.designer}'s way (${kept.value})` : pick === 'today' ? `today's ${c.component} as it is` : pick === 'both' ? 'both ways, as two sizes' : `new sizes next to today's`;
  const note = `${myName ?? 'A library owner'} chose ${chosen} for ${c.component}, where ${c.ways[0]!.designer} and ${c.ways[1]!.designer} changed it differently. This answers both explorations: comment here if you see it otherwise.`;
  await chooseLibraryWayOnGitHub(clientFor(p.source.repo), p.source.number, { component: c.component, property: c.property, pick, ...me(), other: { gh: clientFor(at[1]!), number: Number(at[2]) }, note });
  return `${kept ? `Kept ${kept.designer}'s way for ${c.component}` : pick === 'today' ? `Kept today's ${c.component}` : `Kept new sizes for ${c.component}`}. ${c.ways[0]!.designer} and ${c.ways[1]!.designer} are told.`;
}

/** A comment on the piece: on the library change, or on the exploration that asked for it (its designer reads it). */
export async function commentOn(p: ReviewPiece, text: string): Promise<string> {
  const words = text.trim();
  if (!words) throw new Error('Write a comment first.');
  await commentOnGitHub(clientFor(p.source.repo), p.source.number, words);
  return p.asked?.designer ? `Comment sent. ${p.asked.designer} sees it on ${p.asked.name}.` : 'Comment sent.';
}

/** For the tests and the key of a piece's exploration. */
export const explorationKey = explorationKeyOf;

/** "Ask someone else" (a row's menu, the viewer's own change): the review's own request to the other reviewers. */
export async function askOther(p: ReviewPiece): Promise<string> {
  if (p.source.kind !== 'change') throw new Error('Only a library change can be sent to someone else.');
  const { askSomeoneElse } = await import('./reviews');
  const names = await askSomeoneElse(p.source.number);
  return names.length ? `Asked ${names.join(' and ')} to look.` : 'Asked the other reviewers to look.';
}
