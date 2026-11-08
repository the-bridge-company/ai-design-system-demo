// The demo's activity (open branches, the recently closed ones, open suggestions), read once: what Changes > Waiting
// on me adds on a demo team (scripts/waiting-extras.ts). The demo's home itself is the Studio home of any team
// (scripts/team-home.ts, components/ds/studio/StudioHome.tsx).
//
// Three GitHub reads that the demo's activity snapshot answers (bridge-data branch, raw host, no API quota) when its
// recorded reads match these URLs exactly, kept by ghGet's cache when GitHub stops answering.
import { SUGGESTION_LABEL } from '@bridge-ds/core';
import { ghGet, readRepo } from './github-session';
import type { DemoPull, DemoSuggestion } from '../lib/demo-home';

/** What the demo's activity holds, wherever it comes from. */
export interface DemoActivity {
  /** Open branches (pull requests), drafts included. */
  open: DemoPull[];
  /** Recently closed branches (the 30 last updated): a merged exploration is kept. */
  closed?: DemoPull[];
  /** Open suggestions. */
  suggestions: DemoSuggestion[];
  /** Display names by lower-case login, when the source carries them (a snapshot can); read from GitHub otherwise. */
  names?: Record<string, string>;
}

/**
 * The demo's activity. Rejects with GitHub's error (RateLimitError when the anonymous reads ran out) when nothing could
 * be read.
 */
export async function readDemoActivity(repo: { owner: string; repo: string } = readRepo()): Promise<DemoActivity> {
  const base = `/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`;
  const [open, closed, suggestions] = await Promise.all([
    ghGet<DemoPull[]>(`${base}/pulls?state=open&per_page=100`),
    // The same read as Changes and the activity snapshot record, so the snapshot answers it.
    ghGet<DemoPull[]>(`${base}/pulls?state=closed&sort=updated&direction=desc&per_page=30`).catch(() => ({ data: [] as DemoPull[] })),
    ghGet<DemoSuggestion[]>(`${base}/issues?state=open&labels=${encodeURIComponent(SUGGESTION_LABEL)}&per_page=50&sort=created&direction=desc`).catch(() => ({ data: [] as DemoSuggestion[] })),
  ]);
  return { open: open.data, closed: closed.data, suggestions: suggestions.data };
}
