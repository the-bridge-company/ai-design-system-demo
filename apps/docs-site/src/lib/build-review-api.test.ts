// Check the build, region by region, through Bridge's server (api/contribute actions build-review, build-item,
// build-note, and build-word with its things to fix): a read queues the build for Bridge's workflow; the designer and
// the PM (an email member who may only view) answer per difference and comment on the spot; the comments and the
// things to fix reach the developers' task with their pictures; nobody else answers.
import { describe, expect, it } from 'vitest';
import { memberRef } from '../../api/_lib/exploration-member';
import { memberStore } from '../../api/_lib/members';
import { memoryRedis } from '../../api/_lib/redis';
import { memoryShotStore } from '../../api/_lib/private-shots';
import { NOTIFY_TEAMS_KEY, repoMetaKey } from '../../api/_lib/notify';
import { buildTodo, imageSigOk, jobKeyOf, putBuildImage, putBuildSummary, QUEUE_KEY } from '../../api/_lib/build-review';
import { clearDesignPathCache, clearProductPairCache, handleContribute, issueSession, type ContribDeps } from '../../api/contribute/index';
import { clearReadMemory } from '../../api/_lib/team-read';

const HOST = 'bridge.example.com';
const ORIGIN = `https://${HOST}`;
const REPO = 'acme/design';
const COPY = 'acme/shop-design';
const CODE = 'acme/shop';
const T0 = Date.parse('2026-11-10T10:00:00Z');
const SECRET = 's'.repeat(40);
const ENV = { LIBRARY_SESSION_SECRET: SECRET };
const CONFIG = JSON.stringify({ products: [{ key: 'shop', name: 'Shop', repo: CODE, preview: 'https://{branch}.shop.pages.dev', design: { repo: COPY, preview: 'https://{branch}.shop-design.pages.dev' } }], governance: { owners: { design: ['florian'] } } });
const H = { host: HOST, origin: ORIGIN, 'content-type': 'application/json', 'x-bridge-contribute': '1', 'sec-fetch-site': 'same-origin' };
const res = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const HEAD = 'a'.repeat(40);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(16)]).toString('base64');
const NOTES_MD = '# Exploration\n\n## Decisions\n\n- Three tiles, always in the same order.\n\n## Edge cases\n\n### Contact summary\n\n- [x] New contact with no history\n- [ ] Only overdue tasks\n';

function setup() {
  clearDesignPathCache();
  clearProductPairCache();
  clearReadMemory();
  const redis = memoryRedis(() => T0);
  const members = memberStore(redis);
  const shots = memoryShotStore();
  const block = { name: 'Contact page summary', slug: 'contact-page-summary', screen: '/#/contacts/31/show', startedAt: '2026-11-01T00:00:00Z', doneAt: '2026-11-05T00:00:00Z', member: memberRef('mia@acme.example'), memberName: 'Mia', task: `https://github.com/${CODE}/issues/7` };
  const world = { comments: [] as { where: string; body: string }[] };
  const deps: ContribDeps = {
    fetch: async (url, init) => {
      const u = new URL(url);
      const m = init.method;
      if (m === 'GET' && u.pathname === `/repos/${REPO}/contents/bridge.config.json`) return new Response(CONFIG, { status: 200 });
      if (m === 'GET' && u.pathname === `/repos/${COPY}/pulls/5`) return res(200, { number: 5, head: { ref: 'explore/contact-page-summary' }, body: `x\n\n<!-- bridge-exploration ${JSON.stringify(block)} -->` });
      if (m === 'GET' && u.pathname === `/repos/${COPY}/contents/.bridge/explorations/contact-page-summary.md`) return res(200, { content: Buffer.from(NOTES_MD).toString('base64') });
      if (m === 'GET' && u.pathname === `/repos/${CODE}/issues/7/timeline`) return res(200, [{ event: 'cross-referenced', source: { issue: { number: 12, html_url: `https://github.com/${CODE}/pull/12`, state: 'open', draft: false, pull_request: {}, repository: { full_name: CODE } } } }]);
      if (m === 'GET' && u.pathname === `/repos/${CODE}/pulls/12`) return res(200, { number: 12, state: 'open', draft: false, head: { sha: HEAD, ref: 'build/contact-page-summary' }, user: { login: 'malik' }, body: 'Closes #7. The Tags keep their stored name.' });
      if (m === 'POST' && /\/issues\/\d+\/comments$/.test(u.pathname)) return world.comments.push({ where: u.pathname, body: JSON.parse(init.body!).body }), res(201, {});
      if (m === 'POST' && u.pathname.startsWith(`/repos/${CODE}/statuses/`)) return res(201, {});
      return res(404, { message: 'Not Found' });
    },
    now: () => T0,
    redis,
    email: { send: async () => undefined },
    app: { installationToken: async () => 'ghs_x' },
    shots,
  };
  return { redis, members, deps, world, shots };
}

async function as(s: ReturnType<typeof setup>, email: string, name: string, role: 'view' | 'edit' | 'admin') {
  const m = { email, name, role, version: 1, addedBy: 'dana', at: new Date(T0).toISOString() };
  await s.members.put(REPO, m);
  return issueSession(m, REPO, SECRET, T0).split(';')[0]!;
}
const post = (body: unknown, cookie: string) => new Request(`${ORIGIN}/api/contribute`, { method: 'POST', headers: { ...H, cookie }, body: JSON.stringify(body) });
const at = { repo: REPO, product: 'shop', number: 5 };

const SUMMARY = {
  route: '/#/contacts/31/show',
  urls: { approved: 'https://explore-contact-page-summary.shop-design.pages.dev/#/contacts/31/show', build: 'https://build-contact-page-summary.shop.pages.dev/#/contacts/31/show' },
  ignored: 4,
  sizes: [{ key: 'laptop', width: 1280, height: 800, missing: {}, a: { image: 'p-laptop-a', w: 1024, h: 1100, pageW: 1280, pageH: 1400 }, b: { image: 'p-laptop-b', w: 1024, h: 1100, pageW: 1280, pageH: 1400 } }],
  items: [
    { n: 1, sig: 'r00000001', name: 'Tags', line: 'Shows football-fan where the design says Football fan', facts: [{ k: 'text', label: 'Text', was: 'Football fan', now: 'football-fan', n: 1 }], sizes: ['laptop'], boxes: { laptop: { a: [900, 500, 340, 80], b: [900, 510, 340, 84] } }, crop: { size: 'laptop', a: 'r1-a', b: 'r1-b' } },
    { n: 2, sig: 'r00000002', name: 'Tasks', line: 'Dates read 13/12/2026 where the design says 12/13/2026', facts: [{ k: 'date', label: 'Date', was: '12/13/2026', now: '13/12/2026', n: 2 }], sizes: ['laptop'], boxes: { laptop: { a: [900, 600, 340, 200], b: [900, 610, 340, 220] } }, crop: { size: 'laptop', a: 'r2-a', b: 'r2-b' } },
  ],
};

/** The workflow's side: a read queued the build; the robot sends its pictures and the measure. */
async function measure(s: ReturnType<typeof setup>) {
  await s.redis.pipe([['SADD', NOTIFY_TEAMS_KEY, CODE], ['SET', repoMetaKey(CODE), JSON.stringify({ kind: 'code', team: REPO })]]);
  const ctx = { f: s.deps.fetch, now: () => T0, redis: s.redis, store: s.shots, token: async () => 'ghs_x' };
  const [job] = await buildTodo(ctx);
  expect(job).toMatchObject({ code: CODE, pull: 12, head: HEAD, route: '/#/contacts/31/show', approved: { branch: 'explore/contact-page-summary', template: 'https://{branch}.shop-design.pages.dev' }, build: { branch: 'build/contact-page-summary', template: 'https://{branch}.shop.pages.dev' } });
  for (const name of ['p-laptop-a', 'p-laptop-b', 'r1-a', 'r1-b', 'r2-a', 'r2-b']) expect((await putBuildImage(ctx, { code: CODE, pull: 12, run: job!.run, name, image: WEBP })).status).toBe(200);
  expect((await putBuildSummary(ctx, { code: CODE, pull: 12, run: job!.run, head: HEAD, summary: SUMMARY })).status).toBe(200);
  return job!.run;
}

describe('check the build, region by region', () => {
  it('a read queues the build once; the measure leaves the queue and the page reads it with the handover notes', async () => {
    const s = setup();
    const mia = await as(s, 'mia@acme.example', 'Mia', 'edit');
    const first = await (await handleContribute(post({ action: 'build-review', ...at }, mia), ENV, s.deps)).json();
    expect(first).toMatchObject({ ready: true, role: 'designer', round: 1, review: null, queued: true, code: CODE, exploration: { name: 'Contact page summary', screen: '/#/contacts/31/show' } });
    expect(first.handover).toEqual({ decisions: ['Three tiles, always in the same order.'], edgeCases: [{ component: 'Contact summary', state: 'New contact with no history', covered: true }, { component: 'Contact summary', state: 'Only overdue tasks', covered: false }] });
    await measure(s);
    expect(await s.redis.cmd('SMEMBERS', QUEUE_KEY)).toEqual([]);
    expect(await s.redis.cmd('GET', jobKeyOf(CODE, 12))).toBeNull();
    const read = await (await handleContribute(post({ action: 'build-review', ...at }, mia), ENV, s.deps)).json();
    expect(read.review.items.map((i: { name: string }) => i.name)).toEqual(['Tags', 'Tasks']);
    expect(read.queued).toBe(false);
    // The developer names Tags in their note: they meant it.
    expect(read.meant).toEqual(['r00000001']);
  });

  it('the designer and the PM answer per difference; someone with no part in the check does not', async () => {
    const s = setup();
    const admin = await as(s, 'ann@acme.example', 'Ann', 'admin');
    await as(s, 'dino@acme.example', 'Dino', 'view');
    await handleContribute(post({ action: 'set-pm', repo: REPO, product: 'shop', pm: { ref: memberRef('dino@acme.example') } }, admin), ENV, s.deps);
    const mia = await as(s, 'mia@acme.example', 'Mia', 'edit');
    const dino = await as(s, 'dino@acme.example', 'Dino', 'view');
    const zoe = await as(s, 'zoe@acme.example', 'Zoe', 'edit');
    await handleContribute(post({ action: 'build-review', ...at }, mia), ENV, s.deps);
    await measure(s);
    const said = await (await handleContribute(post({ action: 'build-item', ...at, sig: 'r00000001', verdict: 'fix' }, mia), ENV, s.deps)).json();
    expect(said.items[0]).toMatchObject({ sig: 'r00000001', mine: 'fix' });
    const pm = await (await handleContribute(post({ action: 'build-item', ...at, sig: 'r00000001', verdict: 'fine' }, dino), ENV, s.deps)).json();
    expect(pm.items[0]).toMatchObject({ mine: 'fine', others: [{ role: 'designer', byName: 'Mia', verdict: 'fix' }] });
    expect((await handleContribute(post({ action: 'build-item', ...at, sig: 'r00000001', verdict: 'fine' }, zoe), ENV, s.deps)).status).toBe(403);
    expect((await handleContribute(post({ action: 'build-item', ...at, sig: 'r99999999', verdict: 'fine' }, mia), ENV, s.deps)).status).toBe(409);
  });

  it('a comment pinned on a difference reaches the task with a signed picture; the PM answers it by email', async () => {
    const s = setup();
    const admin = await as(s, 'ann@acme.example', 'Ann', 'admin');
    await as(s, 'dino@acme.example', 'Dino', 'view');
    await handleContribute(post({ action: 'set-pm', repo: REPO, product: 'shop', pm: { ref: memberRef('dino@acme.example') } }, admin), ENV, s.deps);
    const mia = await as(s, 'mia@acme.example', 'Mia', 'edit');
    const dino = await as(s, 'dino@acme.example', 'Dino', 'view');
    await handleContribute(post({ action: 'build-review', ...at }, mia), ENV, s.deps);
    const run = await measure(s);
    const added = await (await handleContribute(post({ action: 'build-note', ...at, op: 'add', sig: 'r00000001', side: 'b', x: 0.4, y: 0.5, text: 'Show the name as typed, @malik.' }, mia), ENV, s.deps)).json();
    expect(added.notes).toHaveLength(1);
    const posted = s.world.comments.at(-1)!;
    expect(posted.where).toBe(`/repos/${CODE}/issues/7/comments`);
    expect(posted.body).toContain('Mia (designer) commented on 1. Tags, laptop:');
    expect(posted.body).toContain('@​malik');
    const img = /!\[Tags\]\((https:[^)]+)\)/.exec(posted.body)![1]!;
    const q = new URL(img).searchParams;
    expect(imageSigOk(SECRET, CODE, 12, run, 'r1-b', q.get('sig'))).toBe(true);
    // The signed picture opens with no session (GitHub's image proxy).
    expect((await handleContribute(new Request(img, { headers: { host: HOST } }), ENV, s.deps)).status).toBe(200);
    expect((await handleContribute(new Request(img.replace(/sig=[^&]+/, 'sig=x'), { headers: { host: HOST } }), ENV, s.deps)).status).not.toBe(200);
    const id = added.notes[0].id;
    const answered = await (await handleContribute(post({ action: 'build-note', ...at, op: 'reply', id, text: 'Agreed' }, dino), ENV, s.deps)).json();
    expect(answered.notes[0].replies[0]).toMatchObject({ byName: 'Dino', role: 'pm', text: 'Agreed' });
    expect(s.world.comments.at(-1)!.body).toContain('Dino (product manager) answered on 1. Tags');
    const resolved = await (await handleContribute(post({ action: 'build-note', ...at, op: 'resolve', id }, mia), ENV, s.deps)).json();
    expect(resolved.notes[0].resolved).toMatchObject({ byName: 'Mia' });
  });

  it('Needs changes from the review mode: one comment on the task with the things to fix and their pictures', async () => {
    const s = setup();
    const mia = await as(s, 'mia@acme.example', 'Mia', 'edit');
    await handleContribute(post({ action: 'build-review', ...at }, mia), ENV, s.deps);
    await measure(s);
    await handleContribute(post({ action: 'build-item', ...at, sig: 'r00000001', verdict: 'fix' }, mia), ENV, s.deps);
    await handleContribute(post({ action: 'build-item', ...at, sig: 'r00000002', verdict: 'fine' }, mia), ENV, s.deps);
    const r = await handleContribute(post({ action: 'build-word', ...at, copy: COPY, kind: 'changes', why: 'build', text: '1 thing to fix: 1. Tags.', fixes: true }, mia), ENV, s.deps);
    expect(r.status).toBe(200);
    const onTask = s.world.comments.filter((c) => c.where === `/repos/${CODE}/issues/7/comments`).at(-1)!;
    expect(onTask.body).toContain('Mia (designer) checked the build, round 1: 1 thing to fix.');
    expect(onTask.body).toContain('**1. Tags**');
    expect(onTask.body).toContain('Text: Football fan → football-fan');
    expect(onTask.body).toContain('The other difference stays approved in the next round.');
    expect(onTask.body).not.toContain('Tasks');
  });
});
