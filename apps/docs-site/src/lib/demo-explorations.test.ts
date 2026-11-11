// Seeding the sample team's explorations as its members (api/contribute action `seed-demo-explorations`): the plan's
// checks, the admin gate, the dry run, and a run through the member path (runAsMember) against a small GitHub of its
// own, so GitHub sees Bridge's App acting with each member's "Requested by" line and the block names the member.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { memoryRedis } from '../../api/_lib/redis';
import { branchKey } from '../../api/_lib/former-member';
import { explorationBlockOf, memberRef } from '../../api/_lib/exploration-member';
import { parseSeedPlan, seedLeadFor, seedMemberOf, seedProductsFrom, SEED_LIMITS } from '../../api/_lib/demo-explorations';
import { clearProductPairCache, onTeamLibrary, setSeedRetry, type ContribDeps, handleContribute } from '../../api/contribute/index';

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
      [COPY, 'Sofia', 'gift-wrap', 'exploring', 'Dana'],
      ['acme-design-demo/acme-crm-design', 'Leo', 'deal-board', 'done', 'Dana'],
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

  it('takes notes in the shape a save takes, and says what is wrong with them', () => {
    const ok = parseSeedPlan({ items: [item({ notes: { decisions: [' Keep the price on one line. '], edgeCases: [{ component: 'Gift wrap', state: 'Long message', covered: false }], nextStep: 'Ann takes a look.' } })] }, PRODUCTS, USE_CASES);
    expect(ok.problems).toEqual([]);
    expect(ok.items[0]!.notes).toEqual({ decisions: ['Keep the price on one line.'], edgeCases: [{ component: 'Gift wrap', state: 'Long message', covered: false }], nextStep: 'Ann takes a look.' });
    expect(parseSeedPlan({ items: [item()] }, PRODUCTS, USE_CASES).items[0]).not.toHaveProperty('notes');
    const bad = parseSeedPlan(
      {
        items: [
          item({ notes: 'decided' }),
          item({ branch: 'explore/b', notes: { why: 'x' } }),
          item({ branch: 'explore/c', notes: { decisions: 'one' } }),
          item({ branch: 'explore/d', notes: { nextStep: 'Ann looks \u2014 then ships.' } }),
          item({ branch: 'explore/e', notes: { edgeCases: [{ component: 'Card', state: 'Empty' }] } }),
          item({ branch: 'explore/f', notes: {} }),
        ],
      },
      PRODUCTS,
      USE_CASES,
    );
    expect(bad.items).toEqual([]);
    const said = bad.problems.join('\n');
    expect(said).toMatch(/Item 1: notes is an object/);
    expect(said).toMatch(/Item 2: notes has no section "why"/);
    expect(said).toMatch(/Item 3: notes decision is a list/);
    expect(said).toMatch(/Item 4: notes nextStep has an em dash/);
    expect(said).toMatch(/Item 5: notes edge case 1 says covered/);
    expect(said).toMatch(/Item 6: notes say nothing/);
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

  it('leaves an exploration already in the copy as it is when its files already say this', async () => {
    const w = world(true);
    const redis = memoryRedis(() => T0);
    await run(w, redis, { apply: true, plan: { items: [item()] } });
    const before = w.writes.length;
    const out = await (await run(w, redis, { apply: true, plan: { items: [item()] } })).json();
    expect(out.items[0]).toMatchObject({ status: 'exists' });
    expect(out.items[0]).not.toHaveProperty('updates');
    expect(w.writes.length).toBe(before);
  });

  it('saves the changed files of an exploration already there as its member, in one commit, once', async () => {
    const w = world(true);
    const redis = memoryRedis(() => T0);
    const plan = { items: [item({ member: 'Leo', name: 'Frame picker', branch: 'explore/frame-picker', state: 'waiting-for-lead', files: [{ path: 'src/a.tsx', content: 'a\n' }, { path: 'src/b.tsx', content: 'b\n' }] })] };
    await run(w, redis, { apply: true, plan });
    const head = w.refs.get('explore/frame-picker')!;
    const body = w.pulls[0].body;
    // Ownership expired since: the member gets it back, as when they started it.
    await redis.cmd('DEL', branchKey(COPY, 'explore/frame-picker'));
    const next = { items: [{ ...plan.items[0], files: [{ path: 'src/a.tsx', content: 'a\n' }, { path: 'src/b.tsx', content: 'b, list view\n' }, { path: 'src/c.tsx', content: 'c\n' }] }] };

    const before = w.writes.length;
    const dry = await (await run(w, redis, { plan: next })).json();
    expect(dry.items.map((i: any) => [i.status, i.updates])).toEqual([['exists', 2]]);
    expect(w.writes.length).toBe(before);

    const out = await (await run(w, redis, { apply: true, plan: next })).json();
    expect(w.unknown).toEqual([]);
    expect(out.items.map((i: any) => [i.status, i.updates, i.error])).toEqual([['exists', 2, undefined]]);
    const fresh = w.writes.slice(before);
    expect(fresh.every((x) => x.auth === 'Bearer ghs_app')).toBe(true);
    expect(JSON.stringify(fresh)).not.toMatch(/peterbono|Florian/);
    // One commit on top of what was there, with the two files that changed, authored by Leo.
    const now = w.commits.get(w.refs.get('explore/frame-picker')!)!;
    expect(now.parents).toEqual([head]);
    expect(now.author).toMatchObject({ name: 'Leo' });
    const was = w.commits.get(head)!.tree;
    expect([...now.tree.keys()].filter((p) => now.tree.get(p) !== was.get(p)).sort()).toEqual(['src/b.tsx', 'src/c.tsx']);
    expect(now.tree.get('src/b.tsx')).toBe('b, list view\n');
    expect(await redis.cmd('GET', branchKey(COPY, 'explore/frame-picker'))).toBe('leo@acme.example');
    // Its state, block and labels as they were.
    expect(w.pulls[0].body).toBe(body);

    // Said again: the files already say this, nothing is written.
    const again = w.writes.length;
    const twice = await (await run(w, redis, { apply: true, plan: next })).json();
    expect(twice.items[0]).not.toHaveProperty('updates');
    expect(w.writes.length).toBe(again);
  });

  const NOTES = {
    decisions: ['Gift wrap sits under the order total, not in a step of its own.'],
    edgeCases: [{ component: 'Gift wrap', state: 'Long gift message', covered: false, note: 'cut at two lines for now' }],
    nextStep: 'Dana takes a look at the order summary.',
  };

  it("saves the notes of explorations already there as their members, and nothing else of them", async () => {
    const w = world(true);
    const redis = memoryRedis(() => T0);
    const plan = { items: [item({ member: 'Leo', name: 'Frame picker', branch: 'explore/frame-picker', state: 'waiting-for-lead' }), item({ member: 'ann@acme.example', name: 'Order tracking', branch: 'explore/order-tracking', state: 'done' })] };
    await run(w, redis, { apply: true, plan });
    const [leo, ann] = w.pulls.map((p: any) => ({ body: p.body, labels: [...p.labels] }));
    const heads = ['explore/frame-picker', 'explore/order-tracking'].map((b) => w.refs.get(b));
    // Ownership expired since: the member gets it back, as when they started it.
    await redis.cmd('DEL', branchKey(COPY, 'explore/order-tracking'));
    const withNotes = { items: plan.items.map((i) => ({ ...i, notes: NOTES })) };

    // A dry run reads the note and says it would change it, writing nothing.
    const before = w.writes.length;
    const dry = await (await run(w, redis, { plan: withNotes })).json();
    expect(dry.items.map((i: any) => [i.status, i.notes])).toEqual([['exists', 'writes'], ['exists', 'writes']]);
    expect(w.writes.length).toBe(before);

    const out = await (await run(w, redis, { apply: true, plan: withNotes })).json();
    expect(w.unknown).toEqual([]);
    expect(out.items.map((i: any) => [i.status, i.notes, i.error])).toEqual([['exists', 'saved', undefined], ['exists', 'saved', undefined]]);
    const fresh = w.writes.slice(before);
    expect(fresh.every((x) => x.auth === 'Bearer ghs_app')).toBe(true);
    expect(JSON.stringify(fresh)).not.toMatch(/peterbono|Florian/);
    // One commit each, on top of what was there, holding only the note file, authored by the member.
    for (const [i, branch] of ['explore/frame-picker', 'explore/order-tracking'].entries()) {
      const head = w.commits.get(w.refs.get(branch)!)!;
      expect(head.parents).toEqual([heads[i]]);
      const was = w.commits.get(heads[i]!)!.tree;
      expect([...head.tree.keys()].filter((p) => head.tree.get(p) !== was.get(p))).toEqual([`.bridge/explorations/${branch.slice(8)}.md`]);
      const md = head.tree.get(`.bridge/explorations/${branch.slice(8)}.md`)!;
      expect(md).toContain('## Decisions\n\n- Gift wrap sits under the order total, not in a step of its own.');
      expect(md).toContain('- [ ] Long gift message: cut at two lines for now');
      expect(md).toContain('## Next step\n\nDana takes a look at the order summary.');
    }
    expect(w.commits.get(w.refs.get('explore/frame-picker')!)!.author).toMatchObject({ name: 'Leo' });
    expect(w.commits.get(w.refs.get('explore/order-tracking')!)!.author).toMatchObject({ name: 'Ann' });
    expect(await redis.cmd('GET', branchKey(COPY, 'explore/order-tracking'))).toBe('ann@acme.example');
    // Its state, block and labels as they were.
    expect(w.pulls.map((p: any) => ({ body: p.body, labels: p.labels }))).toEqual([leo, ann]);

    // Said again: the notes already say this, nothing is written.
    const again = w.writes.length;
    const twice = await (await run(w, redis, { apply: true, plan: withNotes })).json();
    expect(twice.items.map((i: any) => i.notes)).toEqual(['same', 'same']);
    expect(w.writes.filter((x) => x.path.startsWith(`/repos/${COPY}`)).length).toBe(w.writes.slice(0, again).filter((x) => x.path.startsWith(`/repos/${COPY}`)).length);
  });

  it('notes a new exploration right after its files', async () => {
    const w = world(true);
    const out = await (await run(w, memoryRedis(() => T0), { apply: true, plan: { items: [item({ notes: NOTES })] } })).json();
    expect(out.items[0]).toMatchObject({ status: 'started', notes: 'saved' });
    const head = w.commits.get(w.refs.get('explore/gift-wrap')!)!;
    expect(head.message).toBe('Note where it stands');
    expect(w.commits.get(head.parents[0]!)!.tree.get('src/checkout/GiftWrap.tsx')).toBeTruthy();
    expect(head.tree.get('.bridge/explorations/gift-wrap.md')).toContain('Dana takes a look at the order summary.');
  });
});

describe('the screen of a seeded exploration', () => {
  beforeAll(() => setSeedRetry({ attempts: 1, baseDelayMs: 0, sleep: async () => {} }));
  afterAll(() => setSeedRetry(undefined));

  it('takes a place in the preview, never another site', () => {
    const ok = parseSeedPlan({ items: [item({ screen: ' /#/orders/XGZFHY3Z ' })] }, PRODUCTS, USE_CASES);
    expect(ok.problems).toEqual([]);
    expect(ok.items[0]!.screen).toBe('/#/orders/XGZFHY3Z');
    expect(parseSeedPlan({ items: [item()] }, PRODUCTS, USE_CASES).items[0]).not.toHaveProperty('screen');
    const bad = parseSeedPlan(
      { items: [item({ screen: 'https://evil.example/#/orders' }), item({ branch: 'explore/b', screen: '//evil.example/x' }), item({ branch: 'explore/c', screen: 'orders' }), item({ branch: 'explore/d', screen: `/${'a'.repeat(200)}` })] },
      PRODUCTS,
      USE_CASES,
    );
    expect(bad.items).toEqual([]);
    expect(bad.problems.filter((p) => /screen is the place/.test(p))).toHaveLength(4);
  });

  it('sets it on explorations already there as their members, once', async () => {
    const w = world(true);
    const redis = memoryRedis(() => T0);
    const plan = { items: [item({ member: 'Leo', name: 'Frame picker', branch: 'explore/frame-picker', state: 'waiting-for-lead' })] };
    await run(w, redis, { apply: true, plan });
    const head = w.refs.get('explore/frame-picker');
    const withScreen = { items: plan.items.map((i) => ({ ...i, screen: '/?workspace=new#/' })) };

    const before = w.writes.length;
    const dry = await (await run(w, redis, { plan: withScreen })).json();
    expect(dry.items.map((i: any) => [i.status, i.screen])).toEqual([['exists', 'writes']]);
    expect(w.writes.length).toBe(before);

    const out = await (await run(w, redis, { apply: true, plan: withScreen })).json();
    expect(w.unknown).toEqual([]);
    expect(out.items.map((i: any) => [i.status, i.screen, i.error])).toEqual([['exists', 'saved', undefined]]);
    const fresh = w.writes.slice(before);
    // One description write, by the App for Leo: no commit, the branch head as it was.
    expect(fresh.map((x) => `${x.method} ${x.path}`)).toEqual([`PATCH /repos/${COPY}/pulls/10`]);
    expect(fresh[0]!.auth).toBe('Bearer ghs_app');
    expect(w.refs.get('explore/frame-picker')).toBe(head);
    expect(explorationBlockOf(w.pulls[0].body)).toMatchObject({ screen: '/?workspace=new#/', memberName: 'Leo', leadAskedByName: 'Leo' });
    expect(w.pulls[0].body).toContain('Requested by Leo through Bridge.');

    const again = w.writes.length;
    const twice = await (await run(w, redis, { apply: true, plan: withScreen })).json();
    expect(twice.items.map((i: any) => i.screen)).toEqual(['same']);
    expect(w.writes.length).toBe(again);
  });

  it('sets it on a new exploration as it starts', async () => {
    const w = world(true);
    const out = await (await run(w, memoryRedis(() => T0), { apply: true, plan: { items: [item({ screen: '/#/orders/12' })] } })).json();
    expect(out.items[0]).toMatchObject({ status: 'started', screen: 'saved' });
    expect(explorationBlockOf(w.pulls[0].body)?.screen).toBe('/#/orders/12');
  });
});

describe('onTeamLibrary (the seed library check reads the library with the app read token)', () => {
  const team = 'Acme-Design-Demo/bridge-demo-ds';
  it('counts the repository itself, read first by every Bridge context', () => {
    expect(onTeamLibrary(new URL('https://api.github.com/repos/acme-design-demo/bridge-demo-ds'), team)).toBe(true);
  });
  it('counts anything under it, on the API and the raw host', () => {
    expect(onTeamLibrary(new URL('https://api.github.com/repos/acme-design-demo/bridge-demo-ds/contents/tokens'), team)).toBe(true);
    expect(onTeamLibrary(new URL('https://raw.githubusercontent.com/acme-design-demo/bridge-demo-ds/main/x.json'), team)).toBe(true);
  });
  it('leaves the products and look-alike names to the member path', () => {
    expect(onTeamLibrary(new URL('https://api.github.com/repos/acme-design-demo/acme-prints-design/pulls/1'), team)).toBe(false);
    expect(onTeamLibrary(new URL('https://api.github.com/repos/acme-design-demo/bridge-demo-ds-old'), team)).toBe(false);
  });
});
