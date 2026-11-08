// Bringing the sample team's explorations up to date from their product as their member (api/contribute action
// `update-demo-branches`): the plan, the admin gate, the dry run and the run through the member path with the App.
import { describe, expect, it } from 'vitest';
import { explorationActivity, MERGE_WORDS } from '@bridge-ds/core';
import { branchKey } from '../../api/_lib/former-member';
import { memoryRedis } from '../../api/_lib/redis';
import { demoExplorationsOf } from '../../api/_lib/demo-refile';
import { clearProductPairCache, type ContribDeps, handleContribute } from '../../api/contribute/index';

const HOST = 'bridge.example.com';
const ORIGIN = `https://${HOST}`;
const ENV = { LIBRARY_SESSION_SECRET: 's'.repeat(40) };
const DEMO = 'acme-design-demo/bridge-demo-ds';
const COPY = 'acme-design-demo/acme-account-design';
const CODE = 'acme-design-demo/acme-account';
const T0 = Date.parse('2026-11-08T10:00:00Z');

const block = (name: string) => `## Exploration\n\n<!-- bridge-exploration ${JSON.stringify({ name: 'X', memberName: name, member: 'ffffffffffffffff' })} -->`;
const pull = (number: number, ref: string, body: string, labels: string[] = [], repo = COPY) => ({ number, state: 'open', body, head: { ref, repo: { full_name: repo } }, base: { repo: { full_name: COPY } }, labels: labels.map((name) => ({ name })) });

describe('the explorations to bring up to date', () => {
  it('keeps the open explore/* branches of the copy whose block names a member, never archived or foreign ones', () => {
    const name = (b: string) => /"memberName":"([^"]+)"/.exec(b)?.[1];
    const plan = demoExplorationsOf([pull(5, 'explore/plans', block('Sofia')), pull(4, 'explore/badges', block('Leo')), pull(3, 'explore/old', block('Leo'), ['archived']), pull(2, 'explore/who', block('Someone')), pull(7, 'explore/fork', block('Ann'), [], 'someone/fork'), pull(6, 'main', 'x')], name);
    expect(plan.items).toEqual([
      { pull: 4, branch: 'explore/badges', member: { email: 'leo@acme.example', name: 'Leo' } },
      { pull: 5, branch: 'explore/plans', member: { email: 'sofia@acme.example', name: 'Sofia' } },
    ]);
    expect(plan.skipped.map((s) => s.pull)).toEqual([3, 2, 7]);
  });

  it('a merge commit the App made reads as the exploration author bringing in the latest product', () => {
    const commit = { sha: 'a', author: { login: 'bridge-design-studio[bot]' }, commit: { message: 'Bring the latest main into explore/plans', author: { name: 'bridge-design-studio[bot]', date: '2026-11-08T10:00:00Z' } } };
    expect(explorationActivity({ commits: [commit], author: 'name:Sofia' })[0]).toMatchObject({ who: 'name:Sofia', text: MERGE_WORDS });
  });
});

function world(admin: boolean) {
  const writes: { method: string; path: string; body: any; auth: string }[] = [];
  const behind: Record<string, number> = { 'explore/plans': 3, 'explore/badges': 0 };
  const fetch: ContribDeps['fetch'] = async (url, init) => {
    const p = new URL(url).pathname;
    const body = init.body ? JSON.parse(String(init.body)) : null;
    const auth = String((init.headers as Record<string, string>)?.Authorization ?? '');
    if (init.method !== 'GET') writes.push({ method: init.method!, path: p, body, auth });
    if (p === '/user') return Response.json({ login: 'peterbono', name: 'Florian', id: 1 });
    if (p === `/repos/${DEMO}`) return Response.json({ private: false, default_branch: 'main', permissions: { admin, push: admin, pull: true } });
    if (p === `/repos/${DEMO}/contents/bridge.config.json`) return new Response(JSON.stringify({ products: [{ key: 'account', repo: CODE, design: { repo: COPY } }] }), { status: 200 });
    if (p === `/repos/${COPY}`) return Response.json({ private: true, default_branch: 'main', fork: true });
    if (p === `/repos/${COPY}/pulls` && init.method === 'GET') return Response.json([pull(5, 'explore/plans', block('Sofia')), pull(4, 'explore/badges', block('Leo')), pull(3, 'explore/old', block('Leo'), ['archived']), pull(2, 'explore/who', block('Someone'))]);
    const cmp = /\/compare\/(.+)\.\.\.main$/.exec(p);
    if (cmp) return Response.json({ ahead_by: behind[decodeURIComponent(cmp[1]!)] ?? 0, status: 'behind', files: [] });
    if (p === `/repos/${COPY}/merge-upstream`) return Response.json({ merge_type: 'fast-forward' }, { status: 200 });
    if (p === `/repos/${COPY}/merges`) return behind[body.base] ? Response.json({ sha: 'a'.repeat(40) }, { status: 201 }) : new Response(null, { status: 204 });
    return Response.json({});
  };
  return { admin, writes, fetch };
}

const run = (w: ReturnType<typeof world>, redis: ReturnType<typeof memoryRedis>, body: Record<string, unknown>) => {
  clearProductPairCache();
  return handleContribute(
    new Request(`${ORIGIN}/api/contribute`, {
      method: 'POST',
      headers: { host: HOST, origin: ORIGIN, 'content-type': 'application/json', 'x-bridge-contribute': '1', authorization: `Bearer ${w.admin ? 'b' : 'c'}${'z'.repeat(39)}` },
      body: JSON.stringify({ action: 'update-demo-branches', repo: DEMO, ...body }),
    }),
    ENV,
    { fetch: w.fetch, now: () => T0, redis, app: { installationToken: async () => 'ghs_app' } },
  );
};

describe('the update-demo-branches action', () => {
  it('refuses anyone who does not administer the sample team, and lists without writing in a dry run', async () => {
    const no = world(false);
    expect((await run(no, memoryRedis(() => T0), { apply: true })).status).toBe(403);
    expect(no.writes).toEqual([]);
    const w = world(true);
    const out = await (await run(w, memoryRedis(() => T0), {})).json();
    expect(out.dryRun).toBe(true);
    expect(out.items.map((i: { pull: number; member: string; behind: number }) => [i.pull, i.member, i.behind])).toEqual([
      [4, 'Leo', 0],
      [5, 'Sofia', 3],
    ]);
    expect(out.skipped.map((s: { pull: number; why: string }) => [s.pull, s.why])).toEqual([
      [3, 'archived'],
      [2, 'it names no member of the sample team'],
    ]);
    expect(w.writes).toEqual([]);
  });

  it('syncs the copy, then merges main into each exploration with the App, as its member', async () => {
    const w = world(true);
    const redis = memoryRedis(() => T0);
    const out = await (await run(w, redis, { apply: true })).json();
    expect(out.items.map((i: { pull: number; done?: string; error?: string }) => [i.pull, i.done, i.error])).toEqual([
      [4, 'up-to-date', undefined],
      [5, 'merged', undefined],
    ]);
    const gh = w.writes.filter((x) => x.path.startsWith(`/repos/${COPY}`));
    expect(gh.map((x) => `${x.method} ${x.path}`)).toEqual([`POST /repos/${COPY}/merge-upstream`, `POST /repos/${COPY}/merges`, `POST /repos/${COPY}/merges`]);
    // Every write with the App's token, never the admin's: the merge commit is the App's, the activity the member's.
    expect(gh.every((x) => x.auth === 'Bearer ghs_app')).toBe(true);
    expect(gh[0]!.body).toEqual({ branch: 'main' });
    expect(gh[2]!.body).toEqual({ base: 'explore/plans', head: 'main', commit_message: 'Bring the latest main into explore/plans' });
    expect(await redis.cmd('GET', branchKey(COPY, 'explore/plans'))).toBe('sofia@acme.example');
  });

  it('leaves alone an exploration Bridge keeps for someone else', async () => {
    const w = world(true);
    const redis = memoryRedis(() => T0);
    await redis.cmd('SET', branchKey(COPY, 'explore/plans'), 'ann@acme.example');
    const out = await (await run(w, redis, { apply: true })).json();
    expect(out.items.find((i: { pull: number }) => i.pull === 5)).toMatchObject({ error: 'Bridge keeps this exploration for someone else.' });
    expect(w.writes.filter((x) => x.path.endsWith('/merges')).map((x) => x.body.base)).toEqual(['explore/badges']);
  });
});
