// Claude's preview recorded by Bridge (api/contribute action behavior-preview): someone on the team reports the
// preview their own Claude made (bridge_report_behavior_preview, through the hosted connector); Bridge's app keeps one
// record comment on the request, naming them. Refused for someone off the team, an issue that is not an open behavior
// request, and a ready preview without its open draft pull request on agent/preview-<n>. The server's words equal core's.
import { describe, expect, it } from 'vitest';
import { behaviorPreviewComment, behaviorRequestOf, composeRequestIssue, parsePreviewState, previewReportProblems, BEHAVIOR_REQUEST_LABEL, REQUEST_LABEL } from '@bridge-ds/core';
import { memberStore } from '../../api/_lib/members';
import { memoryRedis } from '../../api/_lib/redis';
import { clearDesignPathCache, clearProductPairCache, handleContribute, issueSession, type ContribDeps } from '../../api/contribute/index';
import { clearReadMemory } from '../../api/_lib/team-read';
import * as server from '../../api/_lib/behavior-preview';

const HOST = 'bridge.example.com';
const ORIGIN = `https://${HOST}`;
const REPO = 'acme/design';
const T0 = Date.parse('2026-11-15T10:00:00Z');
const SECRET = 's'.repeat(40);
const ENV = { LIBRARY_SESSION_SECRET: SECRET };
const H = { host: HOST, origin: ORIGIN, 'content-type': 'application/json', 'x-bridge-contribute': '1', 'sec-fetch-site': 'same-origin' };
const APP = { login: 'bridge-design-studio[bot]', type: 'Bot' };
const res = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const body = composeRequestIssue(behaviorRequestOf('Select', { of: 'component', id: 'Select', behavior: 'tab-leaves', today: 'Tab leaves without picking', wanted: 'Tab picks the highlighted option' })).body;

function setup() {
  clearDesignPathCache();
  clearProductPairCache();
  clearReadMemory();
  const redis = memoryRedis(() => T0);
  const members = memberStore(redis);
  const issues: Record<number, { state: string; labels: string[]; body: string }> = {
    7: { state: 'open', labels: [REQUEST_LABEL, BEHAVIOR_REQUEST_LABEL], body },
    8: { state: 'open', labels: [REQUEST_LABEL, 'request: bug'], body: 'A bug' },
    9: { state: 'closed', labels: [REQUEST_LABEL, BEHAVIOR_REQUEST_LABEL], body },
  };
  const comments: { id: number; body: string; user: typeof APP }[] = [];
  const writes: string[] = [];
  const deps: ContribDeps = {
    fetch: async (url, init) => {
      const u = new URL(url);
      const p = u.pathname;
      if (init.method === 'GET' && p === `/repos/${REPO}/contents/bridge.config.json`) return new Response('{}', { status: 200 });
      if (init.method === 'GET' && p === `/repos/${REPO}/pulls/80`) return res(200, { number: 80, state: 'open', head: { ref: 'agent/preview-7', repo: { full_name: REPO } } });
      if (init.method === 'GET' && p === `/repos/${REPO}/pulls/81`) return res(200, { number: 81, state: 'open', head: { ref: 'feature/other', repo: { full_name: REPO } } });
      const m = /^\/repos\/acme\/design\/issues\/(\d+)(\/comments)?$/.exec(p);
      if (m && init.method === 'GET') {
        const issue = issues[Number(m[1])];
        if (!issue) return res(404, {});
        return m[2] ? res(200, comments) : res(200, { number: Number(m[1]), ...issue, labels: issue.labels.map((name) => ({ name })) });
      }
      if (m && m[2] && init.method === 'POST') {
        writes.push(`POST ${p}`);
        comments.push({ id: 500 + comments.length, body: JSON.parse(init.body!).body, user: APP });
        return res(201, {});
      }
      const c = /^\/repos\/acme\/design\/issues\/comments\/(\d+)$/.exec(p);
      if (c && init.method === 'PATCH') {
        writes.push(`PATCH ${p}`);
        comments.find((x) => x.id === Number(c[1]))!.body = JSON.parse(init.body!).body;
        return res(200, {});
      }
      writes.push(`${init.method} ${p}`);
      return res(404, {});
    },
    now: () => T0,
    redis,
    email: { send: async () => undefined },
    app: { installationToken: async () => 'ghs_x' },
  };
  return { members, deps, comments, writes };
}

async function as(s: ReturnType<typeof setup>, email: string, name: string, role: 'view' | 'edit' | 'admin', repo = REPO) {
  const m = { email, name, role, version: 1, addedBy: 'ann', at: new Date(T0).toISOString() };
  await s.members.put(repo, m);
  return issueSession(m, repo, SECRET, T0).split(';')[0]!;
}
const post = (b: unknown, cookie: string) => new Request(`${ORIGIN}/api/contribute`, { method: 'POST', headers: { ...H, cookie }, body: JSON.stringify(b) });
const report = (x: Record<string, unknown>, n = 7) => ({ action: 'behavior-preview', repo: REPO, number: n, ...x });

describe('a preview recorded by Bridge', () => {
  it('preparing, then ready: one record comment, kept up to date, naming who made it', async () => {
    const s = setup();
    const malik = await as(s, 'malik@acme.example', 'Malik Diallo', 'edit');
    expect((await handleContribute(post(report({ state: 'preparing' }), malik), ENV, s.deps)).status).toBe(200);
    expect(parsePreviewState(s.comments)).toMatchObject({ state: 'preparing', by: 'Malik Diallo', round: 1, wanted: 'Tab picks the highlighted option' });
    const r = await handleContribute(post(report({ state: 'ready', branch: 'agent/preview-7', pr: 80, sha: 'abc1234' }), malik), ENV, s.deps);
    expect(r.status).toBe(200);
    expect(s.writes).toEqual(['POST /repos/acme/design/issues/7/comments', 'PATCH /repos/acme/design/issues/comments/500']);
    expect(parsePreviewState(s.comments)).toMatchObject({ state: 'ready', branch: 'agent/preview-7', pr: 80, sha: 'abc1234', round: 1 });
    expect(s.comments[0]!.body).not.toContain('malik@acme.example');
    // Made again: round 2 ("Updated from your words" in Studio).
    await handleContribute(post(report({ state: 'ready', branch: 'agent/preview-7', pr: 80, sha: 'def5678' }), malik), ENV, s.deps);
    expect(parsePreviewState(s.comments)).toMatchObject({ round: 2, sha: 'def5678' });
  });

  it('refuses off the team, another kind of issue, a closed request, and a ready preview without its draft', async () => {
    const s = setup();
    const malik = await as(s, 'malik@acme.example', 'Malik', 'edit');
    const other = await as(s, 'eve@other.example', 'Eve', 'admin', 'acme/other');
    expect((await handleContribute(post(report({ state: 'preparing' }), other), ENV, s.deps)).status).toBe(401);
    expect((await handleContribute(post(report({ state: 'preparing' }, 8), malik), ENV, s.deps)).status).toBe(404);
    expect((await handleContribute(post(report({ state: 'preparing' }, 9), malik), ENV, s.deps)).status).toBe(409);
    expect((await handleContribute(post(report({ state: 'ready', branch: 'agent/preview-7', pr: 81 }), malik), ENV, s.deps)).status).toBe(409);
    expect((await handleContribute(post(report({ state: 'ready', branch: 'main', pr: 80 }), malik), ENV, s.deps)).status).toBe(400);
    expect((await handleContribute(post(report({ state: 'failed' }), malik), ENV, s.deps)).status).toBe(400);
    expect(s.writes).toEqual([]);
  });
});

describe('the server says what core says', () => {
  it('keeps the record and the report rules equal', () => {
    const b = { state: 'ready' as const, branch: 'agent/preview-7', pr: 80, sha: 'abc1234', round: 2, wanted: 'x > y', by: 'Malik', at: '2026-11-15T10:00:00.000Z' };
    expect(server.previewCommentOf(b)).toBe(behaviorPreviewComment(b));
    expect(server.previewCommentOf({ state: 'failed', reason: 'No tests.' })).toBe(behaviorPreviewComment({ state: 'failed', reason: 'No tests.' }));
    for (const r of [{ state: 'ready', branch: 'main', pr: 0 }, { state: 'failed' }, { state: 'preparing' }, { state: 'ready', branch: 'agent/preview-7', pr: 3, sha: 'zz' }])
      expect(server.previewProblems(7, r)).toEqual(previewReportProblems(7, r as never));
  });
});
