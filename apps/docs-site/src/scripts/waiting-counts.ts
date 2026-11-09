// The explorations that wait on the viewer, remembered per team and viewer (lib/waiting-counts: one source per count).
// Home and Explorations write it once they have read; the nav badge on Explorations reads it on every page, so the
// three say one number. The library's count stays with Library review (scripts/needs-you rememberMine).
import type { WaitingExploration } from '../lib/waiting-counts';
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
