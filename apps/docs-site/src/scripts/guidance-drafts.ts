// The usage guidance drafts waiting for review on main (docs.json needsReview), one read for every surface that shows
// them (owner decision 2026-11-13): Home's rows (scripts/team-home) and Library review's Docs pieces
// (scripts/library-review-data) take the same list (lib/team-facts teamGuidance) and the same age (guidanceSince).
import type { GuidanceDraft } from '../lib/home-model';
import { teamGuidance } from '../lib/team-facts';
import { ghGet } from './github-session';

interface CommitRead {
  commit?: { committer?: { date?: string | null } | null; author?: { date?: string | null } | null } | null;
}

const sinceRead = new Map<string, Promise<string | null>>();

/**
 * When a draft was flagged for review: the date of the last commit to its docs.json on main (the commit that set
 * needsReview: later commits to a flagged file keep it flagged and are drafts too). Null when it cannot be read.
 */
export function flaggedAt(repo: string, path: string): Promise<string | null> {
  const k = `${repo.toLowerCase()}:${path}`;
  let r = sinceRead.get(k);
  if (!r) {
    r = ghGet<CommitRead[]>(`/repos/${repo}/commits?path=${encodeURIComponent(path)}&per_page=1`)
      .then((x) => x.data[0]?.commit?.committer?.date ?? x.data[0]?.commit?.author?.date ?? null)
      .catch(() => null);
    sinceRead.set(k, r);
  }
  return r;
}

/** The drafts with their age (flaggedAt), read once per draft and page. */
export async function guidanceSince<G extends GuidanceDraft>(repo: string, drafts: readonly G[]): Promise<G[]> {
  return Promise.all(drafts.map(async (g) => (g.since || !g.path ? g : { ...g, since: await flaggedAt(repo, g.path) })));
}

/** A team's drafts, with their age: what Library review lists under Docs and Home's rows say. Empty off a team page. */
export async function loadGuidanceDrafts(): Promise<(GuidanceDraft & { excerpt: string | null })[]> {
  const { teamOfPage, loadTeamData } = await import('./team-data');
  if (!teamOfPage()) return [];
  const data = await loadTeamData();
  return guidanceSince(`${data.owner}/${data.repo}`, teamGuidance(data));
}
