// Who gets it in the browser: the team's measurement (lib/library-reach.ts ReachData), read once per page.
//   - products Bridge cannot publish captures of (private repositories): kept by Bridge, read through the team
//     (GET /api/contribute?repo=<team>&reach=summary, api/_lib/private-reach.ts), only the products the reader may read;
//   - public products: reach/summary.json of the bridge-shots branch (scripts/preview-shots.mjs reachRun), from
//     raw.githubusercontent.com (no GitHub API call).
// Both are merged. Null when neither exists yet (Studio then says Bridge is measuring). An image Bridge keeps is read
// with the person's GitHub token when they signed in with GitHub (an <img> cannot carry it), else as is.
import { getToken, readRepo } from './github-session';
import { shotsFileUrl } from '../lib/preview-shots';
import type { ElementCounts, ReachData } from '../lib/library-reach';

interface RawSummary {
  run?: string;
  measuredAt?: string;
  products?: { key: string; name: string; screens: { id: string; route: string; title: string; image: string }[] }[];
  changes?: { repo: string; pr: number; state: 'measured' | 'new' | 'unmeasured'; screens: { id: string; before: string; after: string; elements: ElementCounts }[] }[];
}

let read: { key: string; at: number; data: Promise<ReachData | null> } | null = null;
const FRESH_MS = 5 * 60 * 1000;

const token = (): string | null => {
  try {
    return getToken();
  } catch {
    return null;
  }
};

/** A summary with its images as URLs. Exported for tests. */
export function withImages(s: RawSummary | null | undefined, src: (name: string) => string): ReachData | null {
  if (!s || !Array.isArray(s.products) || !Array.isArray(s.changes) || !s.measuredAt) return null;
  return {
    measuredAt: s.measuredAt,
    products: s.products.map((p) => ({ key: p.key, name: p.name, screens: (p.screens ?? []).map((x) => ({ ...x, image: src(x.image) })) })),
    changes: s.changes.map((c) => ({ repo: c.repo, pr: c.pr, state: c.state, screens: (c.screens ?? []).map((x) => ({ ...x, before: src(x.before), after: src(x.after) })) })),
  };
}

/** Both measurements as one: products of each, a change's screens from each. */
export function mergeReach(a: ReachData | null, b: ReachData | null): ReachData | null {
  if (!a || !b) return a ?? b;
  const changes = new Map<string, ReachData['changes'][number]>();
  for (const c of [...a.changes, ...b.changes]) {
    const k = `${c.repo.toLowerCase()}#${c.pr}`;
    const had = changes.get(k);
    changes.set(k, had ? { ...had, state: had.state === 'measured' || c.state === 'measured' ? 'measured' : had.state, screens: [...had.screens, ...c.screens] } : c);
  }
  const products = [...a.products, ...b.products.filter((p) => !a.products.some((x) => x.key === p.key))];
  return { measuredAt: a.measuredAt > b.measuredAt ? a.measuredAt : b.measuredAt, products, changes: [...changes.values()] };
}

async function kept(team: string): Promise<ReachData | null> {
  const t = token();
  const r = await fetch(`/api/contribute?repo=${encodeURIComponent(team)}&reach=summary`, { credentials: 'same-origin', headers: { Accept: 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
  if (!r.ok) return null;
  const d = (await r.json()) as { reach?: RawSummary | null };
  const run = d.reach?.run ?? '';
  return withImages(d.reach, (name) => `/api/contribute?repo=${encodeURIComponent(team)}&reach=image&run=${encodeURIComponent(run)}&name=${encodeURIComponent(name)}`);
}

async function published(owner: string, repo: string): Promise<ReachData | null> {
  const r = await fetch(shotsFileUrl(owner, repo, 'reach/summary.json'), { credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!r.ok) return null;
  const s = (await r.json()) as RawSummary;
  // Paths of the branch ("reach/<run>/<name>.webp"), never elsewhere.
  return withImages(s, (path) => (/^reach\/\d+\/[a-z0-9-]+\.webp$/.test(path) ? shotsFileUrl(owner, repo, path) : ''));
}

/** The team's measurement, or null when there is none yet. Read again after five minutes. */
export function loadReach(): Promise<ReachData | null> {
  const { owner, repo } = readRepo();
  const key = `${owner}/${repo}`.toLowerCase();
  if (read && read.key === key && Date.now() - read.at < FRESH_MS) return read.data;
  const data = Promise.all([kept(key).catch(() => null), published(owner, repo).catch(() => null)]).then(([a, b]) => mergeReach(a, b));
  read = { key, at: Date.now(), data };
  return data;
}

const images = new Map<string, Promise<string>>();

/** An image of the measurement as the page can show it: Bridge's own read with the GitHub token when there is one. */
export function reachImageSrc(src: string): Promise<string> {
  const t = src.startsWith('/api/') ? token() : null;
  if (!t) return Promise.resolve(src);
  let p = images.get(src);
  if (!p) {
    p = fetch(src, { credentials: 'same-origin', headers: { Authorization: `Bearer ${t}` } })
      .then(async (r) => (r.ok ? URL.createObjectURL(await r.blob()) : src))
      .catch(() => src);
    images.set(src, p);
  }
  return p;
}
