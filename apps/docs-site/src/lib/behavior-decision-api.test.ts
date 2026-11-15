// A behavior request decided by a design lead signed in by email (api/contribute action behavior-decision): a lead or
// an admin makes it the default, says not now with a reason, or asks the requester, named in the comments; an edit
// member, another issue and another repository are refused. The server's words stay equal to core's.
import { describe, expect, it } from 'vitest';
import { askRequesterComment, behaviorDefaultComment, behaviorRequestOf, BEHAVIOR_REQUEST_LABEL, BUILD_REQUEST_LABEL, composeRequestIssue, declineComment, declineReasonProblems, REQUEST_LABEL } from '@bridge-ds/core';
import { memberStore } from '../../api/_lib/members';
import { memoryRedis } from '../../api/_lib/redis';
import { clearDesignPathCache, clearProductPairCache, handleContribute, issueSession, type ContribDeps } from '../../api/contribute/index';
import { clearReadMemory } from '../../api/_lib/team-read';
import * as server from '../../api/_lib/behavior-decision';

const HOST = 'bridge.example.com';
const ORIGIN = `https://${HOST}`;
const REPO = 'acme/design';
const T0 = Date.parse('2026-11-15T10:00:00Z');
const SECRET = 's'.repeat(40);
const ENV = { LIBRARY_SESSION_SECRET: SECRET };
const H = { host: HOST, origin: ORIGIN, 'content-type': 'application/json', 'x-bridge-contribute': '1', 'sec-fetch-site': 'same-origin' };

const res = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const behaviorBody = composeRequestIssue(behaviorRequestOf('Select', { of: 'component', id: 'Select', behavior: 'close-on-escape', today: 'Closes on Escape', wanted: 'Keeps the list open' }, { requestedBy: 'mia' })).body;

function setup() {
  clearDesignPathCache();
  clearProductPairCache();
  clearReadMemory();
  const redis = memoryRedis(() => T0);
  const members = memberStore(redis);
  const issues: Record<number, { state: string; labels: string[]; body: string; pull_request?: unknown }> = {
    7: { state: 'open', labels: [REQUEST_LABEL, BEHAVIOR_REQUEST_LABEL], body: behaviorBody },
    8: { state: 'open', labels: [REQUEST_LABEL, 'request: bug'], body: 'A bug' },
  };
  const writes: { method: string; path: string; body: Record<string, unknown> }[] = [];
  const deps: ContribDeps = {
    fetch: async (url, init) => {
      const u = new URL(url);
      if (init.method === 'GET' && u.pathname === `/repos/${REPO}/contents/bridge.config.json`) return new Response('{}', { status: 200 });
      const m = /^\/repos\/acme\/design\/issues\/(\d+)(\/labels|\/comments)?$/.exec(u.pathname);
      if (m) {
        const issue = issues[Number(m[1])];
        if (!issue) return res(404, { message: 'Not Found' });
        if (init.method === 'GET' && !m[2]) return res(200, { number: Number(m[1]), ...issue, labels: issue.labels.map((name) => ({ name })) });
        const body = JSON.parse(init.body ?? '{}');
        writes.push({ method: init.method!, path: u.pathname, body });
        if (m[2] === '/labels') issue.labels.push(...body.labels);
        if (!m[2] && init.method === 'PATCH') issue.state = body.state;
        return res(m[2] ? 201 : 200, {});
      }
      writes.push({ method: init.method!, path: u.pathname, body: {} });
      return res(404, { message: 'Not Found' });
    },
    now: () => T0,
    redis,
    email: { send: async () => undefined },
    app: { installationToken: async () => 'ghs_x' },
  };
  return { members, deps, issues, writes };
}

async function as(s: ReturnType<typeof setup>, email: string, name: string, role: 'view' | 'edit' | 'admin', lead = false, repo = REPO) {
  const m = { email, name, role, version: 1, addedBy: 'ann', at: new Date(T0).toISOString(), ...(lead ? { lead: true } : {}) };
  await s.members.put(repo, m);
  return issueSession(m, repo, SECRET, T0).split(';')[0]!;
}

const post = (body: unknown, cookie: string) => new Request(`${ORIGIN}/api/contribute`, { method: 'POST', headers: { ...H, cookie }, body: JSON.stringify(body) });
const decide = (decision: string, text?: string, number = 7, repo = REPO) => ({ action: 'behavior-decision', repo, number, decision, ...(text ? { text } : {}) });

describe('a behavior request decided by an email lead', () => {
  it('a lead makes it the default: bridge-build, then a comment naming them', async () => {
    const s = setup();
    const dana = await as(s, 'dana@acme.example', 'Dana', 'edit', true);
    const r = await handleContribute(post(decide('default'), dana), ENV, s.deps);
    expect(r.status).toBe(200);
    expect(s.issues[7]!.labels).toContain(BUILD_REQUEST_LABEL);
    expect(s.writes.map((w) => `${w.method} ${w.path}`)).toEqual(['POST /repos/acme/design/issues/7/labels', 'POST /repos/acme/design/issues/7/comments']);
    expect(s.writes[1]!.body.body).toBe(behaviorDefaultComment({ name: 'Dana' }));
    expect(String(s.writes[1]!.body.body)).not.toContain('dana@acme.example');
    // Already the default: nothing more.
    expect((await handleContribute(post(decide('default'), dana), ENV, s.deps)).status).toBe(409);
  });

  it('an admin says not now with a reason: the reason, then closed as not planned', async () => {
    const s = setup();
    const ann = await as(s, 'ann@acme.example', 'Ann', 'admin');
    expect((await handleContribute(post(decide('not-now', 'no'), ann), ENV, s.deps)).status).toBe(400);
    expect(s.writes).toEqual([]);
    const r = await handleContribute(post(decide('not-now', 'Escape closes every list in the product.'), ann), ENV, s.deps);
    expect(r.status).toBe(200);
    expect(s.writes[0]!.body.body).toBe(declineComment('Escape closes every list in the product.', { name: 'Ann' }));
    expect(s.writes[1]).toEqual({ method: 'PATCH', path: '/repos/acme/design/issues/7', body: { state: 'closed', state_reason: 'not_planned' } });
    // Closed now: no more decisions.
    expect((await handleContribute(post(decide('ask', 'Which screen?'), ann), ENV, s.deps)).status).toBe(409);
  });

  it('a lead asks the requester: one comment naming them and the requester', async () => {
    const s = setup();
    const dana = await as(s, 'dana@acme.example', 'Dana', 'edit', true);
    expect((await handleContribute(post(decide('ask', '  '), dana), ENV, s.deps)).status).toBe(400);
    expect((await handleContribute(post(decide('ask', 'Which screen does it block?'), dana), ENV, s.deps)).status).toBe(200);
    expect(s.writes).toHaveLength(1);
    expect(s.writes[0]!.body.body).toBe(askRequesterComment('Which screen does it block?', { name: 'Dana' }, 'mia'));
    expect(s.issues[7]!.state).toBe('open');
  });

  it('refuses an edit member, a viewer and someone signed out', async () => {
    const s = setup();
    const mia = await as(s, 'mia@acme.example', 'Mia', 'edit');
    const dino = await as(s, 'dino@acme.example', 'Dino', 'view');
    expect((await handleContribute(post(decide('default'), mia), ENV, s.deps)).status).toBe(403);
    expect((await handleContribute(post(decide('ask', 'Why?'), dino), ENV, s.deps)).status).toBe(403);
    expect((await handleContribute(post(decide('default'), ''), ENV, s.deps)).status).toBe(401);
    expect(s.writes).toEqual([]);
  });

  it('refuses an issue that is not a behavior request, and an unknown decision', async () => {
    const s = setup();
    const dana = await as(s, 'dana@acme.example', 'Dana', 'edit', true);
    expect((await handleContribute(post(decide('default', undefined, 8), dana), ENV, s.deps)).status).toBe(404);
    expect((await handleContribute(post(decide('default', undefined, 99), dana), ENV, s.deps)).status).toBe(404);
    expect((await handleContribute(post(decide('merge'), dana), ENV, s.deps)).status).toBe(400);
    expect(s.writes).toEqual([]);
  });

  it('refuses across repositories: a lead of another team decides nothing here', async () => {
    const s = setup();
    // Dana leads acme/other, not acme/design: her session there says nothing about this team.
    const other = await as(s, 'dana@acme.example', 'Dana', 'admin', true, 'acme/other');
    expect((await handleContribute(post(decide('default'), other), ENV, s.deps)).status).toBe(401);
    // And a session of this team cannot reach another repository's issue.
    const dana = await as(s, 'dana@acme.example', 'Dana', 'edit', true);
    expect((await handleContribute(post(decide('default', undefined, 7, 'acme/other'), dana), ENV, s.deps)).status).toBe(401);
    expect(s.writes).toEqual([]);
  });
});

describe('the server says what core says', () => {
  it('keeps the labels, the comments and the reason rule equal', () => {
    expect([server.REQUEST_LABEL, server.BEHAVIOR_REQUEST_LABEL, server.BUILD_REQUEST_LABEL]).toEqual([REQUEST_LABEL, BEHAVIOR_REQUEST_LABEL, BUILD_REQUEST_LABEL]);
    expect(server.defaultCommentOf('Dana')).toBe(behaviorDefaultComment({ name: 'Dana' }));
    expect(server.declineCommentOf('Not for now.\nMaybe later.', 'Dana')).toBe(declineComment('Not for now.\nMaybe later.', { name: 'Dana' }));
    expect(server.askCommentOf('Which screen?', 'Dana', 'mia')).toBe(askRequesterComment('Which screen?', { name: 'Dana' }, 'mia'));
    expect(server.askCommentOf('Which screen?', 'Dana', 'Mia Ross')).toBe(askRequesterComment('Which screen?', { name: 'Dana' }, 'Mia Ross'));
    for (const t of ['', 'short', 'A real reason, long enough.']) expect(server.decisionTextProblem('not-now', t)).toBe(declineReasonProblems(t)[0] ?? null);
    expect(server.requesterLoginOf(behaviorBody)).toBe('mia');
  });
});
