// What waits on the viewer besides branches, for Branches > Waiting on me (components/ds/studio/BranchesList, handed
// over with scripts/reviews.ts setWaitingExtras): the usage guidance drafts on main and the suggestions.
//   - Signed in: the suggestions that wait on the viewer (scripts/suggestions.ts loadSuggestionQueue).
//   - Otherwise (signed out, an email member): nothing waits on anyone.
import { productsOf } from '@bridge-ds/core';
import { currentViewer } from './github-session';
import { siteConfig } from './repo-context';
import { guidanceNeed } from '../lib/home-model';
import { guidanceExtra, suggestionExtra, type WaitingExtra } from '../lib/review-categories';

export async function readWaitingExtras(x: { owner: string; repo: string; guidance: { name: string; href: string; since: string | null }[] }): Promise<WaitingExtra[]> {
  const now = Date.now();
  const viewer = currentViewer();
  if (!viewer) return [];
  const products = productsOf(siteConfig() as { products?: never });
  const guidance = x.guidance.map((g) => guidanceExtra(guidanceNeed(g, now)));
  const [{ loadSuggestionQueue }, { personOf }] = await Promise.all([import('./suggestions'), import('./home-data')]);
  const asked = await loadSuggestionQueue(personOf).catch(() => []);
  return [...asked.map((a) => suggestionExtra(a.need, a.need.number!, a.labels, products)), ...guidance];
}
