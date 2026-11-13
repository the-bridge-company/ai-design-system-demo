// The explorations that wait on the viewer, remembered per team and viewer (lib/waiting-counts: one source per count).
// Home and Explorations write it once they have read; the nav badge on Explorations reads it on every page, so the
// three say one number. The library's count stays with Library review (scripts/needs-you rememberMine).
import { waitingCounts, type WaitingExploration } from '../lib/waiting-counts';
import { currentContributor, currentViewer, readRepo } from './github-session';

const KEY = 'bridge.waiting.explorations';
/** Told on `document` when the remembered set changes: the badge and the Explorations page follow. */
export const WAITING_EVENT = 'bridge:waiting-explorations';

const team = (): string => {
  const r = readRepo();
  return `${r.owner}/${r.repo}`.toLowerCase();
};
const viewer = (): string | null => currentViewer()?.login ?? currentContributor()?.email ?? null;

/** Remembers what waits on the viewer among the explorations of this team, and tells the page. */
export function rememberWaitingExplorations(list: readonly WaitingExploration[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ team: team(), viewer: viewer(), list, at: new Date().toISOString() }));
  } catch {
    /* private mode: the badge waits for the next read */
  }
  if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent(WAITING_EVENT, { detail: list.length }));
}

/** The last set this browser saw for this team and viewer, or null. */
export function rememberedWaitingExplorations(): WaitingExploration[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null') as { team?: unknown; viewer?: unknown; list?: unknown } | null;
    if (!v || v.team !== team() || v.viewer !== viewer() || !Array.isArray(v.list)) return null;
    return (v.list as WaitingExploration[]).filter((x) => x && typeof x.key === 'string' && typeof x.line === 'string');
  } catch {
    return null;
  }
}

const BUILD_KEY = 'bridge.waiting.building';
/** Told on `document` when the remembered build count changes: the Being built badge follows. */
export const BUILDING_EVENT = 'bridge:waiting-building';

/**
 * Remembers the build requests nobody picked up yet that a developer's Home counted (lib/waiting-counts
 * waitingToBePickedUp), per team and viewer: the Being built badge says the same number on every page (A6).
 */
export function rememberBuildWaiting(n: number): void {
  try {
    localStorage.setItem(BUILD_KEY, JSON.stringify({ team: team(), viewer: viewer(), n, at: new Date().toISOString() }));
  } catch {
    /* private mode: the badge waits for the next Home */
  }
  if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent(BUILDING_EVENT, { detail: n }));
}

/** The last build count this browser saw for this team and viewer, or null. */
export function rememberedBuildWaiting(): number | null {
  try {
    const v = JSON.parse(localStorage.getItem(BUILD_KEY) || 'null') as { team?: unknown; viewer?: unknown; n?: unknown } | null;
    return v && v.team === team() && v.viewer === viewer() && typeof v.n === 'number' ? v.n : null;
  } catch {
    return null;
  }
}

let reading: Promise<number | null> | null = null;

/** Reads again what waits on the viewer, after an answer that changed it (the sample team's Looks right). */
export function recountWaitingExplorations(): Promise<number | null> {
  reading = null;
  return countWaitingExplorations();
}

/**
 * Reads what waits on the viewer once per page, with Home's own loader and rule (scripts/home-data loadHome,
 * lib/waiting-counts waitingCounts), for a page opened before Home or Explorations remembered anything this visit
 * (Settings, Tokens, All products opened directly): the badge then says the same number everywhere. Remembered for the
 * next pages; null when it could not be read.
 */
export function countWaitingExplorations(): Promise<number | null> {
  reading ??= (async () => {
    const [{ loadHome }, { loadTeamData }] = await Promise.all([import('./home-data'), import('./team-data')]);
    const got: { list: WaitingExploration[] | null } = { list: null };
    await new Promise<void>((resolve) => {
      // The count is known once the rows are settled: the thumbnails Home reads after that are not waited for. On a
      // team, its products (bridge.config.json) are read first, as Home waits for them before their explorations.
      void loadHome(
        { guidance: [], contrastFail: 0 },
        (d) => {
          if (d.loading || !d.settled) return;
          if (!d.failed && d.viewer) got.list = waitingCounts(d.needs).explorations;
          resolve();
        },
        undefined,
        loadTeamData().catch(() => null),
      )
        .catch(() => undefined)
        .finally(resolve);
    });
    if (got.list) rememberWaitingExplorations(got.list);
    return got.list ? got.list.length : null;
  })();
  return reading;
}
