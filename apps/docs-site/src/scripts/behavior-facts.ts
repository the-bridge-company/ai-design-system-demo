// What a behavior request's detail in Being built reads, once it opens (components/ds/studio/BeingBuilt.tsx):
//   - who made it the default and when, from the comment Bridge writes (core madeDefaultOf): one comments read;
//   - on a team, from the team's repository at the head it was read at (scripts/team-data): the behavior's keys in the
//     component's docs.json, the component's real files (one folder listing: its source, its docs.json, its tests) and
//     the Base UI primitive its source imports (one file read, core basePrimitivesOf). A pattern: its pattern file.
// Nothing is guessed: what cannot be read stays out. Off a team (Bridge's own site), only the comment is read.
import { basePrimitivesOf, madeDefaultOf, PATTERN_SUFFIX, PATTERNS_DIR, readBehaviors, type BehaviorAsk, type BehaviorFacts } from '@bridge-ds/core';
import { ghGet, readRepo } from './github-session';
import { isHosted } from '../lib/team-path';

export interface BehaviorDetailFacts {
  facts: BehaviorFacts;
  madeDefault: { by: string | null; at: string | null } | null;
}

const cache = new Map<string, Promise<BehaviorDetailFacts>>();

/** The facts of one behavior request, read once per page. */
export function behaviorFactsOf(number: number, ask: BehaviorAsk): Promise<BehaviorDetailFacts> {
  const key = `${number}`;
  if (!cache.has(key)) cache.set(key, read(number, ask));
  return cache.get(key)!;
}

async function read(number: number, ask: BehaviorAsk): Promise<BehaviorDetailFacts> {
  const { owner, repo } = readRepo();
  const [comments, facts] = await Promise.all([
    ghGet<{ body?: string | null; created_at?: string | null }[]>(`/repos/${owner}/${repo}/issues/${number}/comments?per_page=100`)
      .then((f) => f.data)
      .catch(() => []),
    repoFacts(ask).catch(() => ({})),
  ]);
  return { facts, madeDefault: madeDefaultOf(comments) };
}

/** Keys, files and the Base UI primitive, from the team's repository. Empty off a team or when it cannot be read. */
async function repoFacts(ask: BehaviorAsk): Promise<BehaviorFacts> {
  if (!isHosted()) return {};
  const { loadTeamData } = await import('./team-data');
  const data = await loadTeamData();
  if (ask.of === 'pattern') {
    const known = (data.model.patterns ?? []).some((p) => p.id === ask.id);
    return known ? { files: [`${PATTERNS_DIR}/${ask.id}${PATTERN_SUFFIX}`] } : {};
  }
  const c = data.model.components?.list.find((x) => x.name === ask.id);
  if (!c) return {};
  const entry = ask.behavior ? readBehaviors(c.docs?.behaviors).find((b) => b.id === ask.behavior) : undefined;
  const listed = await data.client.listDirectory(c.dir, data.sha).catch(() => []);
  const paths = new Set(listed.filter((f) => f.type === 'file').map((f) => f.path));
  const tests = [...paths].filter((p) => /\.test\.[jt]sx?$/.test(p)).sort();
  const source = paths.has(c.files.tsx) ? c.files.tsx : null;
  const docs = paths.has(c.files.docs) ? c.files.docs : null;
  const text = source ? await data.client.readFile(source, data.sha).catch(() => undefined) : undefined;
  const primitives = basePrimitivesOf(text);
  return {
    ...(entry?.keys?.length ? { keys: entry.keys } : {}),
    ...(docs ? { docsPath: docs } : {}),
    files: [...(source ? [source] : []), ...(docs ? [docs] : []), ...tests],
    ...(primitives.length ? { primitives } : {}),
  };
}
