// What a Studio's header search reads (Cmd+K, components/ds/SearchPalette.tsx), the first time the palette opens:
//   - at once, from what the page already has: the team's components and tokens (its repo model, scripts/team-data.ts,
//     or Bridge's own /search-index.json), its products (its settings) and Studio's pages;
//   - then from GitHub, through the cached reads Studio's own pages make (ghGet): the explorations (the Explorations
//     list's open pull requests and each product repository's), the pieces waiting in Library review (its own loader,
//     without the pictures) and the build requests of Being built (its own loader). No new permission, no token of
//     its own: a read the viewer cannot make simply adds nothing, and a piece only reaches who acts on it.
// The words of each result come from lib/studio-search.ts (pure).
import type { SearchItem } from '../lib/search';
import { explorationItems, pieceItems, productItems, requestItems, studioPageItems } from '../lib/studio-search';
import { studioHref } from '../lib/team-path';
import { productHref } from '../lib/product-page';
import type { ExplorationPullLike } from '../lib/explorations-view';
import type { LifecycleStage } from '../lib/review-state';
import type { ReviewData } from './library-review-data';

const hosted = () => document.documentElement.hasAttribute('data-hosted');

/** A hosted team's settings are read with its model: the products and the repository come after it. */
async function teamRead() {
  const { loadTeamData, teamOfPage } = await import('./team-data');
  return teamOfPage() ? loadTeamData() : null;
}

/** The kinds the page already holds: components, tokens, products and pages. */
export async function loadStudioLocal(): Promise<SearchItem[]> {
  let designSystem: SearchItem[] = [];
  if (hosted()) {
    const [team, { studioSearchIndex }] = await Promise.all([teamRead(), import('../lib/library/search-index')]);
    if (team) designSystem = studioSearchIndex(team.model, studioHref);
  } else {
    const [r, { studioOnly }] = await Promise.all([fetch('/search-index.json'), import('../lib/library/search-index')]);
    designSystem = studioOnly((await r.json()) as SearchItem[]);
  }
  const { configuredProducts } = await import('./product-repos');
  return [...productItems(configuredProducts(), productHref), ...designSystem, ...studioPageItems(studioHref)];
}

/** The explorations of the Explorations list, as it reads them. */
async function explorations(): Promise<SearchItem[]> {
  const [{ ghGet, readRepo }, { productPulls, configuredProducts }, { designTaskStages, taskUrlOf }, { siteApprovers }, { displayName }] = await Promise.all([
    import('./github-session'),
    import('./product-repos'),
    import('./design-task'),
    import('./teams'),
    import('./people'),
  ]);
  const { owner, repo } = readRepo();
  const open = (await ghGet<ExplorationPullLike[]>(`/repos/${owner}/${repo}/pulls?state=open&per_page=100`)).data;
  const inProducts = (await productPulls().catch(() => [])) as unknown as ExplorationPullLike[];
  const stages = await designTaskStages(inProducts).catch(() => new Map<string, LifecycleStage>());
  let approvers: readonly string[] = [];
  try {
    approvers = siteApprovers().design;
  } catch {
    // No roles read: an exploration in review reads from its pull request alone.
  }
  return explorationItems([...open, ...inProducts], {
    products: configuredProducts(),
    studio: studioHref,
    nameOf: (l) => displayName(l),
    approvers,
    taskStage: (p) => {
      const u = taskUrlOf(p.body);
      return u ? (stages.get(u) ?? null) : null;
    },
  });
}

/** The pieces waiting in Library review that the viewer acts on; nothing for a viewer Bridge does not know. */
async function pieces(): Promise<SearchItem[]> {
  const { loadLibraryReview, readViewer } = await import('./library-review-data');
  const viewer = readViewer();
  if (!viewer.reviews && !viewer.name) return [];
  const seen: ReviewData[] = [];
  await loadLibraryReview((d) => void seen.push(d), { pictures: false });
  const d = seen[seen.length - 1];
  return d ? pieceItems(d.pieces, d.viewer, studioHref, Date.now()) : [];
}

/** The build requests of Being built. */
async function requests(): Promise<SearchItem[]> {
  const { loadBuildData } = await import('./building-data');
  const d = await loadBuildData();
  return requestItems(d.views, { studio: studioHref, now: Date.now(), nameOf: d.nameOf });
}

/** The kinds read from GitHub, each on its own: one that cannot be read adds nothing, never fails the others. */
export async function loadStudioLive(): Promise<SearchItem[]> {
  await teamRead().catch(() => null);
  const parts = await Promise.all([explorations(), pieces(), requests()].map((p) => p.catch(() => [] as SearchItem[])));
  return parts.flat();
}
