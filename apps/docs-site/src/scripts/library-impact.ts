// What an exploration changes in the library, read for the exploration page and Review all (boards LI1 to LI5): its own
// recorded library check (in its body), the other open explorations of the team (one read per product repository,
// shared with the lists: scripts/product-repos.ts productPulls) to find conflicts, and, once it was approved, whether
// the library released the requests it needs (one read per request). Pure rules: core library-impact.ts; the view:
// lib/library-impact-view.ts.
import { explorationKeyOf, explorationStatus, isArchivedExploration, libraryConflicts, parseExplorationBody, parsePiecesRecord, type ImpactSource, type LibraryConflict, type LibraryNeed } from '@bridge-ds/core';
import { ghGet } from './github-session';
import { productPulls, siteProductRepos } from './product-repos';

/** One exploration as the conflict check reads it, from its pull request. */
export function impactSourceOf(pull: { number: number; body?: string | null; title?: string; user?: { login?: string } | null }, repo: string, product: string): ImpactSource {
  const block = parseExplorationBody(pull.body);
  return {
    key: explorationKeyOf(repo, pull.number),
    name: block?.name ?? (pull.title ?? '').replace(/^Exploration:\s*/i, ''),
    product,
    designer: block?.memberName ?? block?.leadAskedByName ?? pull.user?.login ?? 'Someone',
    record: parsePiecesRecord(pull.body),
    library: block?.library ?? null,
  };
}

/** The other open explorations of the team (not archived, not shipped or closed), with their recorded checks. */
export async function otherExplorations(): Promise<ImpactSource[]> {
  const names = new Map(siteProductRepos().map((at) => [at.repo.toLowerCase(), at.product.name]));
  const pulls = await productPulls().catch(() => []);
  return pulls
    .filter((p) => !isArchivedExploration(p.labels) && !['shipped', 'closed'].includes(explorationStatus(p)))
    .map((p) => impactSourceOf(p as never, p.repo, names.get(p.repo.toLowerCase()) ?? p.product));
}

/** The conflicts of one exploration with the team's other open explorations. None when they cannot be read. */
export async function conflictsOf(mine: ImpactSource): Promise<LibraryConflict[]> {
  return (await conflictsWithOthers(mine)).conflicts;
}

/**
 * The conflicts, with the other explorations as read for them: the exploration page draws each way from its own
 * recorded piece (how it looks) and names who chose from either side's record.
 */
export async function conflictsWithOthers(mine: ImpactSource): Promise<{ conflicts: LibraryConflict[]; others: ImpactSource[] }> {
  if (!mine.record?.pieces.length) return { conflicts: [], others: [] };
  const others = await otherExplorations().catch(() => [] as ImpactSource[]);
  return { conflicts: libraryConflicts(mine, others), others };
}

const releasedBy = new Map<string, Promise<boolean>>();

/** The library released a request: its issue is closed as completed. Unknown (a failed read): not released. */
export function requestReleased(n: Pick<LibraryNeed, 'repo' | 'number'>): Promise<boolean> {
  const k = `${n.repo.toLowerCase()}#${n.number}`;
  let r = releasedBy.get(k);
  if (!r) {
    r = ghGet<{ state?: string; state_reason?: string | null }>(`/repos/${n.repo}/issues/${n.number}`)
      .then((f) => f.data.state === 'closed' && f.data.state_reason !== 'not_planned')
      .catch(() => false);
    releasedBy.set(k, r);
  }
  return r;
}

/** The requests of these needs the library released, by issue number. */
export async function releasedSet(needs: readonly LibraryNeed[]): Promise<Set<number>> {
  const done = await Promise.all(needs.map(async (n) => ((await requestReleased(n)) ? n.number : null)));
  return new Set(done.filter((x): x is number => x !== null));
}
