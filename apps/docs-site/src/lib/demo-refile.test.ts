// The sample team's requests and suggestions filed again for its members (api/_lib/demo-refile.ts, api/contribute
// action `refile-demo`): the plan, then the run against a GitHub kept in memory.
import { describe, expect, it } from 'vitest';
import { closingIssueNumbers as coreClosing, requesterOf } from '@bridge-ds/core';
import { memoryRedis } from '../../api/_lib/redis';
import { memberStore } from '../../api/_lib/members';
import { issueKey } from '../../api/_lib/former-member';
import { type ContribDeps, handleContribute } from '../../api/contribute/index';
import { closingIssueNumbers, planDemoRefile, relinkBody, requesterFor, requesterName, withoutHandLine, type RefileIssue } from '../../api/_lib/demo-refile';
import { authorFor } from './author';

const HOST = 'bridge.example.com';
const ORIGIN = `https://${HOST}`;
const ENV = { LIBRARY_SESSION_SECRET: 's'.repeat(40) };
const DEMO = 'acme-design-demo/bridge-demo-ds';
const T0 = Date.parse('2026-11-08T10:00:00Z');
const APP = 'bridge-design-studio[bot]';

const issue = (number: number, title: string, labels: string[], body = `## ${title}\n\nWhy.`, login = 'peterbono'): RefileIssue & { comments: string[]; state_reason?: string } => ({
  number,
  title,
  body,
  state: 'open',
  labels: labels.map((name) => ({ name })),
  user: { login },
  comments: [],
});

describe('the plan', () => {
  it('files again the open requests and suggestions an account opened, for the member the body or the subject names', () => {
    const plan = planDemoRefile({
      issues: [
        issue(37, 'Button: change the label while loading', ['component-change']),
        issue(38, 'Card: a subtle tone for secondary groups', ['component-change']),
        issue(30, 'Tokens: snappier dialogs and accordions', ['bridge-suggestion'], 'Dana: faster.\n\nRequested by Malik.\n'),
        issue(41, 'Table: keep the header visible on scroll', ['component-change']),
        issue(50, 'Mystery: no subject in the table', ['component-change']),
        issue(12, 'A question', ['question']),
        issue(60, 'Card: filed by Bridge already', ['component-change'], 'x\n\nRequested by Leo through Bridge.', APP),
        { ...issue(10, 'Spinner: closed', ['component-change']), state: 'closed' },
      ],
      pulls: [
        { number: 22, state: 'open', body: 'Closes #37' },
        { number: 24, state: 'open', body: 'fixes #38 and mentions #370' },
        { number: 5, state: 'closed', body: 'Closes #37' },
      ],
    });
    expect(plan.items.map((i) => [i.old, i.member.name, i.why, i.relink])).toEqual([
      [30, 'Malik', 'body', []],
      [37, 'Ann', 'subject', [22]],
      [38, 'Leo', 'subject', [24]],
      [41, 'Malik', 'subject', []],
      [50, 'Leo', 'default', []],
    ]);
    expect(plan.skipped).toEqual([{ number: 12, title: 'A question', why: 'not a request or a suggestion' }]);
    // The hand-written line goes: the member's own line, written by Bridge, replaces it.
    expect(plan.items[0]!.body).toBe('Dana: faster.');
    expect(plan.items[1]!.labels).toEqual(['component-change']);
  });

  it('reuses a replacement a run already filed for the same member, and keeps Bridge lines and other lines', () => {
    const plan = planDemoRefile({
      issues: [issue(38, 'Card: a subtle tone', ['component-change']), issue(61, 'Card: a subtle tone', ['component-change'], 'x\n\nRequested by Leo through Bridge.', APP)],
      pulls: [],
    });
    expect(plan.items).toHaveLength(1);
    expect(plan.items[0]).toMatchObject({ old: 38, existing: 61 });
    expect(withoutHandLine('a\n\n<sub>Requested from Claude (MCP) with Bridge.</sub>\n\nRequested by Leo.\n')).toBe('a\n\n<sub>Requested from Claude (MCP) with Bridge.</sub>');
    expect(withoutHandLine('a\n\nRequested by Ann through Bridge.')).toBe('a\n\nRequested by Ann through Bridge.');
    expect(requesterFor({ title: 'Anything: x', body: 'Requested by Sofia.' }).member.name).toBe('Sofia');
  });

  it('reads requester lines and closing words as core does (it bundles without core)', () => {
    for (const body of ['x\n\nRequested by Leo.', 'Requested by Ann through Bridge.', '<sub>Requested from Figma by Sofia with Bridge.</sub>', 'Requested by @ann.', 'no line', 'Requested by Ann (@ann).', 'Requested by Ann Leroy (ann@acme.com) through Bridge.', 'a\nRequested by Malik\nRequested by Leo.']) {
      const core = requesterOf(body);
      expect(requesterName(body), body).toBe(core?.name ?? null);
    }
    for (const body of ['Closes #1, fixes #2 and resolves #3', 'closed #4 fixed #5 resolved #6', 'see #7', '']) expect(closingIssueNumbers(body)).toEqual(coreClosing(body));
  });

  it('points a pull request at the replacement without touching other numbers', () => {
    expect(relinkBody('Closes #19\n\nSee #190 and #19.\nresolves #19', 19, 51)).toBe('Closes #51\n\nSee #190 and #19.\nresolves #51');
  });
});

/** A GitHub kept in memory: the sample team's issues and pulls, and what was written. */
function github(admin: boolean) {
  const issues = new Map<number, ReturnType<typeof issue>>([
    [19, issue(19, 'ProfileHeader: new ProfileHeader', ['component-change', 'product: account'])],
    [43, issue(43, 'EmptyState: always offer the next step', ['bridge-suggestion', 'docs'], 'Guidance.\n\nRequested by Leo.\n')],
  ]);
  const pulls = new Map([[20, { number: 20, state: 'open', body: '## What changed\n\nCloses #19' }]]);
  const writes: string[] = [];
  let next = 100;
  const fetch: ContribDeps['fetch'] = async (url, init) => {
    const u = new URL(url);
    const p = u.pathname;
    const body = init.body ? JSON.parse(String(init.body)) : null;
    if (init.method !== 'GET') writes.push(`${init.method} ${p}`);
    if (p === '/user') return Response.json({ login: 'peterbono', name: 'Florian', id: 1 });
    if (p === `/repos/${DEMO}`) return Response.json({ private: false, default_branch: 'main', permissions: { admin, push: admin, pull: true } });
    if (p === `/repos/${DEMO}/issues` && init.method === 'GET') return Response.json([...issues.values()].filter((i) => i.state === 'open'));
    if (p === `/repos/${DEMO}/pulls` && init.method === 'GET') return Response.json([...pulls.values()].filter((x) => x.state === 'open'));
    if (p === `/repos/${DEMO}/issues` && init.method === 'POST') {
      const n = next++;
      const made = { ...issue(n, body.title, body.labels, body.body, APP) };
      issues.set(n, made);
      return Response.json(made, { status: 201 });
    }
    let m = /\/issues\/(\d+)\/comments$/.exec(p);
    if (m && init.method === 'POST') {
      issues.get(Number(m[1]))!.comments.push(body.body);
      return Response.json({ id: 1 }, { status: 201 });
    }
    m = /\/issues\/(\d+)$/.exec(p);
    if (m && init.method === 'PATCH') {
      Object.assign(issues.get(Number(m[1]))!, body);
      return Response.json({}, { status: 200 });
    }
    m = /\/pulls\/(\d+)$/.exec(p);
    if (m && init.method === 'PATCH') {
      Object.assign(pulls.get(Number(m[1]))!, body);
      return Response.json({}, { status: 200 });
    }
    return Response.json({});
  };
  return { admin, issues, pulls, writes, fetch };
}

describe('the refile-demo action', () => {
  const run = (gh: ReturnType<typeof github>, redis: ReturnType<typeof memoryRedis>, body: Record<string, unknown>) =>
    handleContribute(
      new Request(`${ORIGIN}/api/contribute`, {
        method: 'POST',
        headers: { host: HOST, origin: ORIGIN, 'content-type': 'application/json', 'x-bridge-contribute': '1', authorization: `Bearer ${gh.admin ? 'y' : 'n'}${'x'.repeat(39)}` },
        body: JSON.stringify({ action: 'refile-demo', repo: DEMO, ...body }),
      }),
      ENV,
      { fetch: gh.fetch, now: () => T0, redis, app: { installationToken: async () => 'ghs_x' } },
    );

  it('refuses anyone who does not administer the sample team on GitHub', async () => {
    const gh = github(false);
    const r = await run(gh, memoryRedis(() => T0), { apply: true });
    expect(r.status).toBe(403);
    expect(gh.writes).toEqual([]);
  });

  it('lists what it would do in a dry run, and writes nothing', async () => {
    const gh = github(true);
    const redis = memoryRedis(() => T0);
    const r = await run(gh, redis, {});
    expect(r.status).toBe(200);
    const out = await r.json();
    expect(out.dryRun).toBe(true);
    expect(out.items.map((i: { old: number; member: string; relink: number[]; new: number | null }) => [i.old, i.member, i.relink, i.new])).toEqual([
      [19, 'Ann', [20], null],
      [43, 'Leo', [], null],
    ]);
    expect(gh.writes).toEqual([]);
    expect(await memberStore(redis).list(DEMO)).toEqual([]);
  });

  it('files each again through the member path, points the pull request at it, comments and closes the old one as a duplicate', async () => {
    const gh = github(true);
    const redis = memoryRedis(() => T0);
    const r = await run(gh, redis, { apply: true });
    expect(r.status).toBe(200);
    const out = await r.json();
    expect(out.items.map((i: { old: number; new: number; error?: string }) => [i.old, i.new, i.error])).toEqual([
      [19, 100, undefined],
      [43, 101, undefined],
    ]);
    const ann = gh.issues.get(100)!;
    // Opened by the App with Ann's line, so Studio names her, as for any email member.
    expect(ann).toMatchObject({ title: 'ProfileHeader: new ProfileHeader', user: { login: APP } });
    expect(ann.labels).toEqual([{ name: 'component-change' }, { name: 'product: account' }]);
    expect(requesterOf(ann.body)).toEqual({ name: 'Ann', login: null });
    expect(authorFor(ann.user?.login, ann.body)).toBe('name:Ann');
    // The hand-written line is replaced, never doubled.
    const leo = gh.issues.get(101)!;
    expect(leo.body).toBe('Guidance.\n\nRequested by Leo through Bridge.');
    // The issue is Ann's in Bridge, as one she filed herself.
    expect(await redis.cmd('GET', issueKey(DEMO, 100))).toBe('ann@acme.example');
    expect(gh.pulls.get(20)!.body).toBe('## What changed\n\nCloses #100');
    expect(gh.issues.get(19)).toMatchObject({ state: 'closed', state_reason: 'duplicate' });
    expect(gh.issues.get(19)!.comments).toEqual(['Filed again through Bridge for Ann as #100, so Studio shows who asked for it. Follow it there. Nothing is lost: this issue stays in the history.']);
    expect(gh.writes.some((w) => w.startsWith('DELETE'))).toBe(false);

    // Run again: nothing left to do.
    const again = await (await run(gh, redis, { apply: true })).json();
    expect(again.items).toEqual([]);
  });

  it('reuses a replacement filed by a run that stopped before closing the old issue', async () => {
    const gh = github(true);
    gh.issues.set(99, issue(99, 'ProfileHeader: new ProfileHeader', ['component-change'], 'x\n\nRequested by Ann through Bridge.', APP));
    const out = await (await run(gh, memoryRedis(() => T0), { apply: true })).json();
    expect(out.items[0]).toMatchObject({ old: 19, new: 99, reused: true });
    expect(gh.writes.filter((w) => w === `POST /repos/${DEMO}/issues`)).toHaveLength(1);
    expect(gh.pulls.get(20)!.body).toContain('Closes #99');
  });
});
