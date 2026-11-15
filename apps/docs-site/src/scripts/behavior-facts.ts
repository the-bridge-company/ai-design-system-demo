// What a behavior request's detail in Being built reads, once it opens (components/ds/studio/BeingBuilt.tsx), with the
// same reader as the list (github-session ghGet: the viewer's GitHub token, or Bridge's read of the team for an email
// member and for the sample team's visitor, the developer they play included), never a client of its own:
//   - who made it the default and when, from the comment Bridge writes (core madeDefaultOf): one comments read;
//   - the component's folder (components.dir: the team's model, else this site's config): one folder listing, so
//     only files that exist (its source, its docs.json, its tests); its docs.json (the behavior's keys) and its source
//     (the Base UI primitive it imports, core basePrimitivesOf), one read each. A pattern: its pattern file, when it is
//     there.
// Nothing is guessed: what cannot be read stays out, and the detail then says nothing about it.
import { basePrimitivesOf, madeDefaultOf, PATTERN_SUFFIX, PATTERNS_DIR, readBehaviors, type BehaviorAsk, type BehaviorFacts } from '@bridge-ds/core';
import { ghGet, readRepo } from './github-session';
import { siteConfig } from './repo-context';

export interface BehaviorDetailFacts {
  facts: BehaviorFacts;
  madeDefault: { by: string | null; at: string | null } | null;
}

const RAW = { accept: 'application/vnd.github.raw', raw: true } as const;
const cache = new Map<string, Promise<BehaviorDetailFacts>>();

/** The facts of one behavior request, read once per page. */
export function behaviorFactsOf(number: number, ask: BehaviorAsk, component?: string | null): Promise<BehaviorDetailFacts> {
  const { owner, repo } = readRepo();
  const key = `${owner}/${repo}#${number}`;
  // The folder and files are named after the component ("Select"), while the ask may carry its page slug ("select").
  const name = component?.trim() && /^[A-Za-z][A-Za-z0-9]*$/.test(component.trim()) ? component.trim() : ask.id;
  if (!cache.has(key)) cache.set(key, read(`/repos/${owner}/${repo}`, number, ask.of === 'component' ? { ...ask, id: name } : ask));
  return cache.get(key)!;
}

async function read(R: string, number: number, ask: BehaviorAsk): Promise<BehaviorDetailFacts> {
  const [comments, facts] = await Promise.all([
    ghGet<{ body?: string | null; created_at?: string | null }[]>(`${R}/issues/${number}/comments?per_page=100`)
      .then((f) => f.data)
      .catch(() => []),
    repoFacts(R, ask).catch(() => ({})),
  ]);
  return { facts, madeDefault: madeDefaultOf(comments) };
}

/** The folder components live in: the team's model (its bridge.config.json read), else this site's config, else the default. */
async function componentsDir(): Promise<string> {
  const fromModel = await import('./team-data')
    .then((m) => (m.teamOfPage() ? m.loadTeamData() : null))
    .then((d) => d?.model.components?.dir ?? d?.model.config.components?.dir ?? null)
    .catch(() => null);
  if (fromModel) return fromModel.replace(/\/+$/, '');
  try {
    const dir = (siteConfig() as { components?: { dir?: unknown } }).components?.dir;
    if (typeof dir === 'string' && dir.trim()) return dir.replace(/\/+$/, '');
  } catch {
    /* no site config on this page */
  }
  return 'packages/react/src/components';
}

const encodePath = (p: string) => p.split('/').map(encodeURIComponent).join('/');

/** Keys, files and the Base UI primitive, read from the repository. Empty when it cannot be read. */
async function repoFacts(R: string, ask: BehaviorAsk): Promise<BehaviorFacts> {
  if (ask.of === 'pattern') {
    const path = `${PATTERNS_DIR}/${ask.id}${PATTERN_SUFFIX}`;
    const there = await ghGet<unknown>(`${R}/contents/${encodePath(path)}`)
      .then(() => true)
      .catch(() => false);
    return there ? { files: [path] } : {};
  }
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(ask.id)) return {};
  const folder = `${await componentsDir()}/${ask.id}`;
  const listed = await ghGet<{ name: string; path: string; type: string }[]>(`${R}/contents/${encodePath(folder)}`)
    .then((f) => (Array.isArray(f.data) ? f.data : []))
    .catch(() => []);
  const paths = new Set(listed.filter((f) => f.type === 'file').map((f) => f.path));
  const source = paths.has(`${folder}/${ask.id}.tsx`) ? `${folder}/${ask.id}.tsx` : null;
  const docs = [...paths].find((p) => p === `${folder}/${ask.id}.docs.json`) ?? null;
  const tests = [...paths].filter((p) => /\.test\.[jt]sx?$/.test(p)).sort();
  const text = (p: string | null) => (p ? ghGet<string>(`${R}/contents/${encodePath(p)}`, RAW).then((f) => (typeof f.data === 'string' ? f.data : null)).catch(() => null) : Promise.resolve(null));
  const [docsText, sourceText] = await Promise.all([text(ask.behavior ? docs : null), text(source)]);
  let keys: string[] = [];
  try {
    const entry = docsText ? readBehaviors((JSON.parse(docsText) as { behaviors?: unknown }).behaviors).find((b) => b.id === ask.behavior) : undefined;
    keys = entry?.keys ?? [];
  } catch {
    keys = [];
  }
  const primitives = basePrimitivesOf(sourceText);
  const files = [...(source ? [source] : []), ...(docs ? [docs] : []), ...tests];
  return {
    ...(keys.length ? { keys } : {}),
    ...(docs ? { docsPath: docs } : {}),
    ...(files.length ? { files } : {}),
    ...(primitives.length ? { primitives } : {}),
  };
}
