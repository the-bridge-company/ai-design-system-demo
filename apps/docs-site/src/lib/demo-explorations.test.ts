// Seeding the sample team's explorations as its members (api/contribute action `seed-demo-explorations`): the plan's
// checks, the admin gate, the dry run, and a run through the member path (runAsMember) against a small GitHub of its
// own, so GitHub sees Bridge's App acting with each member's "Requested by" line and the block names the member.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { memoryRedis } from '../../api/_lib/redis';
import { branchKey } from '../../api/_lib/former-member';
import { explorationBlockOf, memberRef } from '../../api/_lib/exploration-member';
import { parseSeedPlan, seedLeadFor, seedMemberOf, seedProductsFrom, SEED_LIMITS } from '../../api/_lib/demo-explorations';
import { clearProductPairCache, setSeedRetry, type ContribDeps, handleContribute } from '../../api/contribute/index';

const HOST = 'bridge.example.com';
const ORIGIN = `https://${HOST}`;
const ENV = { LIBRARY_SESSION_SECRET: 's'.repeat(40) };
const DEMO = 'acme-design-demo/bridge-demo-ds';
const COPY = 'acme-design-demo/acme-prints-design';
const CODE = 'acme-design-demo/acme-prints';
const T0 = Date.parse('2026-11-08T10:00:00Z');
const APP = 'bridge-design-studio[bot]';

const CONFIG = {
  name: 'Acme Design',
  repo: { owner: 'acme-design-demo', name: 'bridge-demo-ds', defaultBranch: 'main' },
  governance: { owners: { design: ['peterbono'], tech: ['peterbono'] } },
  products: [
    { key: 'library', name: 'Library', path: 'packages', default: true },
    { key: 'prints', name: 'Acme Prints', repo: CODE, design: { repo: COPY, preview: 'https://{branch}.acme-prints-design.pages.dev' }, framework: 'react' },
    { key: 'crm', name: 'Acme CRM', repo: 'acme-design-demo/acme-crm', design: { repo: 'acme-design-demo/acme-crm-design' }, framework: 'react' },
  ],
};
const PRODUCTS = seedProductsFrom(CONFIG);
const USE_CASES = ['user-test', 'stakeholder-demo', 'ab-idea', 'terminal', 'other'];

const item = (over: Record<string, unknown> = {}) => ({
  product: 'prints',
  member: 'Sofia',
  name: 'Gift wrap at checkout',
  purpose: 'See if a gift option fits the order summary.',
  branch: 'explore/gift-wrap',
  files: [{ path: 'src/checkout/GiftWrap.tsx', content: 'export const GiftWrap = () => null;\n' }],
  ...over,
});

describe('the seeding plan', () => {
  it('reads products by key or name, members by name or email, and the lead who answers', () => {
    expect(PRODUCTS.map((p) => p.key)).toEqual(['prints', 'crm']);
    const { items, problems } = parseSeedPlan({ items: [item(), item({ product: 'Acme CRM', member: 'leo@acme.example', branch: 'explore/deal-board', state: 'done', files: [] })] }, PRODUCTS, USE_CASES);
    expect(problems).toEqual([]);
    expect(items.map((i) => [i.product.copy, i.member.name, i.slug, i.state, i.lead?.name])).toEqual([
      [COPY, 'Sofia', 'gift-wrap', 'exploring', 'Ann'],
      ['acme-design-demo/acme-crm-design', 'Leo', 'deal-board', 'done', 'Ann'],
    ]);
    expect(seedLeadFor({ email: 'ann@acme.example' })?.name).toBe('Dana');
  });

  it('never names someone the sample team no longer lists, nor a stranger', () => {
    expect(seedMemberOf('Malik')).toBeNull();
    expect(seedMemberOf('malik@acme.example')).toBeNull();
    expect(seedMemberOf('Florian')).toBeNull();
    expect(seedMemberOf('ANN')?.email).toBe('ann@acme.example');
  });

  it('says every problem at once and keeps nothing', () => {
    const { items, problems } = parseSeedPlan(
      {
        items: [
          item({ product: 'account' }),
          item({ member: 'peterbono' }),
          item({ branch: 'feature/x' }),
          item({ state: 'shipped' }),
          item({ useCase: 'party' }),
          item({ files: [{ path: '.github/workflows/ci.yml', content: '' }, { path: '../x', content: '' }, { path: 'a.ts' }] }),
          item({ branch: 'explore/gift-wrap' }),
        ],
      },
      PRODUCTS,
      USE_CASES,
    );
    expect(items).toEqual([]);
    expect(problems.join('\n')).toMatch(/Item 1: no product "account"/);
    expect(problems.join('\n')).toMatch(/Item 2: "peterbono" is not a member/);
    expect(problems.join('\n')).toMatch(/Item 3: branch is explore\/<slug>/);
    expect(problems.join('\n')).toMatch(/Item 4: state is one of/);
    expect(problems.join('\n')).toMatch(/Item 5: useCase is one of/);
    expect(problems.join('\n')).toMatch(/Item 6: .github\/workflows\/ci.yml: CI settings/);
    expect(problems.join('\n')).toMatch(/Item 6: "..\/x" is not a path/);
    expect(problems.join('\n')).toMatch(/Item 6: a.ts has no text content/);
    expect(problems.join('\n')).toMatch(/Item 7: explore\/gift-wrap is in the plan twice/);
  });

  it('refuses files heavier than the cap', () => {
    const big = 'x'.repeat(SEED_LIMITS.bytes / 2 + 10);
    const { problems } = parseSeedPlan({ items: [item({ files: [{ path: 'a.ts', content: big }] }), item({ branch: 'explore/b', files: [{ path: 'b.ts', content: big }] })] }, PRODUCTS, USE_CASES);
    expect(problems.join(' ')).toMatch(/kB at most/);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// A small GitHub: the copy and the product's repository, with refs, commits, trees, pull requests and issues.

interface Commit {
  tree: Map<string, string>;
  parents: string[];
  message: string;
  author: unknown;
}

function world(admin: boolean) {
  const writes: { method: string; path: string; body: any; auth: string }[] = [];
  const unknown: string[] = [];
  let n = 0;
  const sha = () => (++n).toString(16).padStart(40, '0');
  const commits = new Map<string, Commit>();
  const trees = new Map<string, Map<string, string>>();
  const root = sha();
  trees.set(`t${root}`, new Map([['src/App.tsx', 'app']]));
  commits.set(root, { tree: trees.get(`t${root}`)!, parents: [], message: 'init', author: {} });
  const refs = new Map<string, string>([['main', root]]);
  const pulls: any[] = [];
  const issues: any[] = [];
  const shaOf = (r: string) => (commits.has(r) ? r : refs.get(r));
  const diff = (a: string, b: string) => {
    const ta = commits.get(a)!.tree;
    const tb = commits.get(b)!.tree;
    const files: { filename: string; status: string }[] = [];
    for (const [p, c] of tb) if (!ta.has(p)) files.push({ filename: p, status: 'added' });
    else if (ta.get(p) !== c) files.push({ filename: p, status: 'modified' });
    for (const p of ta.keys()) if (!tb.has(p)) files.push({ filename: p, status: 'removed' });
    return files;
  };
  const pullJson = (p: any) => ({ ...p, head: { ref: p.headRef, sha: refs.get(p.headRef), repo: { full_name: COPY } }, base: { ref: 'main', repo: { full_name: COPY } }, labels: p.labels.map((name: string) => ({ name })) });

  const fetch: ContribDeps['fetch'] = async (url, init) => {
    const u = new URL(url);
    const p = decodeURIComponent(u.pathname);
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : null;
    const auth = String((init.headers as Record<string, string>)?.Authorization ?? '');
    if (method !== 'GET') writes.push({ method, path: p, body, auth });
    if (p === '/user') return Response.json({ login: 'peterbono', name: 'Florian', id: 1 });
    if (p === `/repos/${DEMO}`) return Response.json({ private: false, default_branch: 'main', permissions: { admin, push: admin, pull: true } });
    if (p === `/repos/${DEMO}/contents/bridge.config.json`) return new Response(JSON.stringify(CONFIG), { status: 200 });
    if (p.startsWith(`/repos/${DEMO}/`)) return Response.json({ message: 'Not Found' }, { status: 404 });
    if (p === `/repos/${COPY}`) return Response.json({ private: false, default_branch: 'main', fork: true, full_name: COPY });
    if (p === `/repos/${CODE}`) return Response.json({ private: false, default_branch: 'main', full_name: CODE });

    const c = p.startsWith(`/repos/${COPY}/`) ? p.slice(`/repos/${COPY}/`.length) : null;
    if (c !== null) {
      let m: RegExpExecArray | null;
      if ((m = /^git\/(?:ref|refs)\/heads\/(.+)$/.exec(c)) && method === 'GET') return refs.has(m[1]!) ? Response.json({ ref: `refs/heads/${m[1]}`, object: { sha: refs.get(m[1]!), type: 'commit' } }) : Response.json({ message: 'Not Found' }, { status: 404 });
      if ((m = /^git\/matching-refs\/heads\/(.+)$/.exec(c))) return Response.json(refs.has(m[1]!) ? [{ ref: `refs/heads/${m[1]}`, object: { sha: refs.get(m[1]!) } }] : []);
      if ((m = /^branches\/(.+)$/.exec(c)) && method === 'GET') {
        const s = refs.get(m[1]!);
        return s ? Response.json({ name: m[1], commit: { sha: s, commit: { tree: { sha: `t${s}` } } } }) : Response.json({ message: 'Branch not found' }, { status: 404 });
      }
      if ((m = /^(?:git\/)?commits\/([^/]+)$/.exec(c)) && method === 'GET') {
        const s = shaOf(m[1]!);
        return s ? Response.json({ sha: s, tree: { sha: `t${s}` }, parents: commits.get(s)!.parents.map((x) => ({ sha: x })), commit: { tree: { sha: `t${s}` }, message: commits.get(s)!.message } }) : Response.json({ message: 'No commit' }, { status: 404 });
      }
      if (/^commits\/[^/]+\/(status|statuses|check-runs|check-suites|pulls)$/.test(c)) return Response.json(c.endsWith('status') ? { state: 'pending', statuses: [] } : c.endsWith('pulls') || c.endsWith('statuses') ? [] : { total_count: 0, check_runs: [], check_suites: [] });
      if (c === 'git/blobs' && method === 'POST') return Response.json({ sha: `b${sha()}` }, { status: 201 });
      if (c === 'git/trees' && method === 'POST') {
        const base = String(body.base_tree ?? '');
        const t = new Map(trees.get(base) ?? []);
        for (const e of body.tree) {
          if (e.sha === null || (e.content === undefined && e.sha === undefined)) t.delete(e.path);
          else t.set(e.path, e.content ?? e.sha);
        }
        const id = `t${sha()}`;
        trees.set(id, t);
        return Response.json({ sha: id }, { status: 201 });
      }
      if (c === 'git/commits' && method === 'POST') {
        const s = sha();
        const t = trees.get(body.tree)!;
        commits.set(s, { tree: t, parents: body.parents, message: body.message, author: body.author });
        trees.set(`t${s}`, t);
        return Response.json({ sha: s, tree: { sha: body.tree } }, { status: 201 });
      }
      if (c === 'git/refs' && method === 'POST') {
        refs.set(String(body.ref).replace('refs/heads/', ''), body.sha);
        return Response.json({ ref: body.ref, object: { sha: body.sha } }, { status: 201 });
      }
      if ((m = /^git\/refs\/heads\/(.+)$/.exec(c)) && method === 'PATCH') {
        refs.set(m[1]!, body.sha);
        return Response.json({ ref: `refs/heads/${m[1]}`, object: { sha: body.sha } });
      }
      if ((m = /^compare\/(.+)\.\.\.(.+)$/.exec(c))) {
        const a = shaOf(m[1]!);
        const b = shaOf(m[2]!);
        if (!a || !b) return Response.json({ message: 'Not Found' }, { status: 404 });
        const files = diff(a, b);
        return Response.json({ status: files.length ? 'ahead' : 'identical', ahead_by: files.length ? 1 : 0, behind_by: 0, files });
      }
      if ((m = /^contents\/(.+)$/.exec(c)) && method === 'GET') {
        const ref = u.searchParams.get('ref') ?? 'main';
        const s = shaOf(ref);
        const content = s ? commits.get(s)!.tree.get(m[1]!) : undefined;
        return content === undefined ? Response.json({ message: 'Not Found' }, { status: 404 }) : Response.json({ type: 'file', path: m[1], sha: `f${m[1]}`, encoding: 'base64', content: Buffer.from(content).toString('base64') });
      }
      if ((m = /^git\/trees\/(.+)$/.exec(c))) {
        const s = shaOf(m[1]!);
        const t = s ? commits.get(s)!.tree : trees.get(m[1]!);
        return Response.json({ sha: m[1], truncated: false, tree: [...(t ?? new Map()).keys()].map((path) => ({ path, type: 'blob', mode: '100644', sha: `f${path}` })) });
      }
      if (c === 'pulls' && method === 'POST') {
        const pr = { number: 10 + pulls.length, html_url: `https://github.com/${COPY}/pull/${10 + pulls.length}`, title: body.title, body: body.body, draft: body.draft, state: 'open', headRef: body.head, user: { login: APP }, labels: [] as string[], created_at: '2026-11-08T10:00:00Z', updated_at: '2026-11-08T10:00:00Z' };
        pulls.push(pr);
        return Response.json(pullJson(pr), { status: 201 });
      }
      if (c === 'pulls' && method === 'GET') {
        const head = u.searchParams.get('head');
        return Response.json(pulls.filter((x) => !head || head.endsWith(`:${x.headRef}`)).map(pullJson));
      }
      if ((m = /^(?:pulls|issues)\/(\d+)$/.exec(c))) {
        const pr = pulls.find((x) => x.number === Number(m![1]));
        if (!pr) return Response.json({ message: 'Not Found' }, { status: 404 });
        if (method === 'PATCH') Object.assign(pr, body);
        return Response.json({ ...pullJson(pr), ...(c.startsWith('issues') ? { pull_request: {} } : {}) });
      }
      if ((m = /^pulls\/(\d+)\/files$/.exec(c))) {
        const pr = pulls.find((x) => x.number === Number(m![1]))!;
        return Response.json(diff(refs.get('main')!, refs.get(pr.headRef)!));
      }
      if ((m = /^pulls\/(\d+)\/(commits|reviews)$/.exec(c))) return Response.json([]);
      if ((m = /^issues\/(\d+)\/labels$/.exec(c)) && method === 'POST') {
        const pr = pulls.find((x) => x.number === Number(m![1]))!;
        pr.labels = [...new Set([...pr.labels, ...body.labels])];
        return Response.json(pr.labels.map((name: string) => ({ name })));
      }
      if ((m = /^issues\/(\d+)\/labels\/(.+)$/.exec(c)) && method === 'DELETE') {
        const pr = pulls.find((x) => x.number === Number(m![1]))!;
        pr.labels = pr.labels.filter((l: string) => l !== m![2]);
        return Response.json([]);
      }
      if ((m = /^issues\/(\d+)\/comments$/.exec(c))) return method === 'POST' ? Response.json({ id: 1, body: body.body }, { status: 201 }) : Response.json([]);
      if (c.startsWith('labels/')) return Response.json({ name: c.slice(7) });
      if (c === 'labels' && method === 'POST') return Response.json(body, { status: 201 });
    }
    const k = p.startsWith(`/repos/${CODE}/`) ? p.slice(`/repos/${CODE}/`.length) : null;
    if (k !== null) {
      if (k.startsWith('labels/')) return Response.json({ message: 'Not Found' }, { status: 404 });
      if (k === 'labels' && method === 'POST') return Response.json(body, { status: 201 });
      if (k === 'issues' && method === 'POST') {
        const i = { number: 70 + issues.length, html_url: `https://github.com/${CODE}/issues/${70 + issues.length}`, title: body.title, body: body.body, labels: body.labels.map((name: string) => ({ name })), state: 'open', user: { login: APP } };
        issues.push(i);
        return Response.json(i, { status: 201 });
      }
    }
    unknown.push(`${method} ${p}${u.search}`);
    return Response.json({ message: 'Not Found' }, { status: 404 });
  };
  return { admin, writes, unknown, fetch, pulls, issues, refs, commits };
}

const run = (w: ReturnType<typeof world>, redis: ReturnType<typeof memoryRedis>, body: Record<string, unknown>) => {
  clearProductPairCache();
  return handleContribute(
    new Request(`${ORIGIN}/api/contribute`, {
      method: 'POST',
      headers: { host: HOST, origin: ORIGIN, 'content-type': 'application/json', 'x-bridge-contribute': '1', authorization: `Bearer ${w.admin ? 'b' : 'c'}${'z'.repeat(39)}` },
      body: JSON.stringify({ action: 'seed-demo-explorations', repo: DEMO, ...body }),
    }),
    ENV,
    { fetch: w.fetch, now: () => T0, redis, app: { installationToken: async () => 'ghs_app' } },
  );
};

describe('the seed-demo-explorations action', () => {
  beforeAll(() => setSeedRetry({ attempts: 1, baseDelayMs: 0, sleep: async () => {} }));
  afterAll(() => setSeedRetry(undefined));

  it('refuses anyone who does not administer the sample team, and a plan with problems', async () => {
    const no = world(false);
    expect((await run(no, memoryRedis(() => T0), { apply: true, plan: { items: [item()] } })).status).toBe(403);
    expect(no.writes).toEqual([]);
    const w = world(true);
    const bad = await run(w, memoryRedis(() => T0), { plan: { items: [item({ member: 'Malik' })] } });
    expect(bad.status).toBe(400);
    expect((await bad.json()).problems[0]).toMatch(/"Malik" is not a member/);
  });

  it('takes a plan larger than other actions, never past its cap', async () => {
    const w = world(true);
    const files = [{ path: 'src/a.ts', content: 'x'.repeat(20_000) }];
    expect((await run(w, memoryRedis(() => T0), { plan: { items: [item({ files })] } })).status).toBe(200);
    const huge = [{ path: 'src/a.ts', content: 'x'.repeat(SEED_LIMITS.request) }];
    expect((await run(w, memoryRedis(() => T0), { plan: { items: [item({ files: huge })] } })).status).toBe(413);
  });

  it('says what it would start in a dry run, writing nothing', async () => {
    const w = world(true);
    const out = await (await run(w, memoryRedis(() => T0), { plan: { items: [item()] } })).json();
    expect(out).toEqual({ dryRun: true, items: [{ product: 'Acme Prints', copy: COPY, branch: 'explore/gift-wrap', member: 'Sofia', state: 'exploring', files: 1, status: 'starts' }] });
    expect(w.writes).toEqual([]);
  });

  it('starts, saves, asks a lead and hands off as the members, every write with the App', async () => {
    const w = world(true);
    const redis = memoryRedis(() => T0);
    const plan = { items: [item(), item({ member: 'Leo', name: 'Frame picker', branch: 'explore/frame-picker', state: 'waiting-for-lead' }), item({ member: 'ann@acme.example', name: 'Order tracking', branch: 'explore/order-tracking', state: 'done' })] };
    const out = await (await run(w, redis, { apply: true, plan })).json();
    expect(w.unknown).toEqual([]);
    expect(out.items.map((i: any) => [i.branch, i.status, i.pr, i.error])).toEqual([
      ['explore/gift-wrap', 'started', 10, undefined],
      ['explore/frame-picker', 'started', 11, undefined],
      ['explore/order-tracking', 'started', 12, undefined],
    ]);
    // Never the admin's token: GitHub shows the App, the line and the block show the member.
    const gh = w.writes.filter((x) => x.path.startsWith(`/repos/${COPY}`) || x.path.startsWith(`/repos/${CODE}`));
    expect(gh.length).toBeGreaterThan(10);
    expect(gh.every((x) => x.auth === 'Bearer ghs_app')).toBe(true);
    const [sofia, leo, ann] = w.pulls;
    expect(sofia.body).toContain('Requested by Sofia through Bridge.');
    expect(explorationBlockOf(sofia.body)).toMatchObject({ member: memberRef('sofia@acme.example'), memberName: 'Sofia' });
    expect(sofia.labels).toContain('exploration');
    expect(JSON.stringify(w.writes)).not.toMatch(/peterbono|Florian/);
    // The files, in one commit authored by the member, on top of the start.
    const head = w.commits.get(w.refs.get('explore/gift-wrap')!)!;
    expect(head.tree.get('src/checkout/GiftWrap.tsx')).toBe('export const GiftWrap = () => null;\n');
    expect(head.author).toMatchObject({ name: 'Sofia' });
    expect(await redis.cmd('GET', branchKey(COPY, 'explore/gift-wrap'))).toBe('sofia@acme.example');
    // Waiting for a lead: the ask is in the block, still an exploration.
    expect(explorationBlockOf(leo.body)).toMatchObject({ memberName: 'Leo', leadAskedByName: 'Leo' });
    expect(leo.labels).toContain('exploration');
    // Done: Dana said it looks right on Ann's, the developers got their task, the block still names Ann.
    expect(explorationBlockOf(ann.body)).toMatchObject({ member: memberRef('ann@acme.example'), memberName: 'Ann' });
    expect(explorationBlockOf(ann.body)?.doneAt).toBeTruthy();
    expect(ann.labels).toContain('ready-for-devs');
    expect(w.issues.map((i: any) => i.title)).toEqual(['Design: Order tracking']);
    expect(w.issues[0].body).toContain('through Bridge.');
  });

  it('leaves an exploration already in the copy as it is', async () => {
    const w = world(true);
    w.refs.set('explore/gift-wrap', w.refs.get('main')!);
    const out = await (await run(w, memoryRedis(() => T0), { apply: true, plan: { items: [item()] } })).json();
    expect(out.items[0]).toMatchObject({ status: 'exists' });
    expect(w.writes.filter((x) => x.path.startsWith(`/repos/${COPY}`))).toEqual([]);
  });
});
