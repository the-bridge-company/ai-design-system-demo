// What one MCP tool call costs on the hosted connector for an email member (api/mcp -> the team read proxy in process
// -> GitHub): Redis commands and GitHub calls, with a new context per call reading everything (as before) and with the
// repository's files kept by commit in the warm function (sharedSnapshots). Fakes only: memory Redis, fake GitHub.
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { BridgeContext, sharedSnapshots } from '@bridge-ds/mcp';
import { ACCOUNT_COOKIE, putAccount, signAccountSession } from '../../api/_lib/account';
import { memberStore } from '../../api/_lib/members';
import { memoryRedis, type Redis } from '../../api/_lib/redis';
import { clearReadMemory } from '../../api/_lib/team-read';
import { handleConnector, type ConnectorDeps, type ConnectorEnv, type FetchLike } from '../../api/mcp/index';
import { fakeGitHub, pinStart, readTree, REAL_PATHS, REPO } from '../../../../packages/mcp/test/helpers';

const HOST = 'bridge.example.com';
const SITE = `https://${HOST}`;
const SECRET = 's'.repeat(40);
const CALLBACK = 'https://claude.ai/api/mcp/auth_callback';
const b64url = (b: Buffer) => b.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const VERIFIER = 'v'.repeat(64);
const CHALLENGE = b64url(createHash('sha256').update(VERIFIER).digest());

/** Counts every Redis command, one per command of a pipeline (what Upstash bills). */
function counted(inner: Redis) {
  const n = { commands: 0 };
  const redis: Redis = {
    cmd: (...args) => {
      n.commands++;
      return inner.cmd(...args);
    },
    pipe: (cmds) => {
      n.commands += cmds.length;
      return inner.pipe(cmds);
    },
  };
  return { redis, n };
}

function world(o: { cache: boolean }) {
  let t = Date.parse('2026-11-21T10:00:00Z');
  const gh = fakeGitHub('acme', 'design', pinStart(readTree(REPO, REAL_PATHS)));
  const github = { calls: 0 };
  const f: FetchLike = async (url, init) => {
    if (url.startsWith('https://api.github.com/') || url.startsWith('https://raw.githubusercontent.com/')) github.calls++;
    return gh.fetch(url, init as RequestInit) as unknown as ReturnType<FetchLike>;
  };
  const { redis, n } = counted(memoryRedis(() => t));
  const env: ConnectorEnv = { LIBRARY_SESSION_SECRET: SECRET, GITHUB_APP_CLIENT_ID: 'Iv1.bridge', GITHUB_APP_CLIENT_SECRET: 'app-secret', PUBLIC_SITE_URL: SITE };
  // Before: the hosted connector made a plain context per call. After: the default path, with sharedSnapshots.
  const before: Partial<ConnectorDeps> = o.cache ? {} : { context: async (x) => BridgeContext.create({ repo: x.repo, token: x.token, surface: 'mcp', fetch: (x.fetch ?? f) as unknown as typeof fetch }) };
  const deps: ConnectorDeps = { fetch: f, now: () => t, redis, app: { installationToken: async () => 'ghs_app_token' }, ...before };
  const call = (path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) =>
    handleConnector(new Request(`${SITE}${path}`, { method: init.method ?? 'GET', headers: { host: HOST, ...(init.headers ?? {}) }, ...(init.body !== undefined ? { body: init.body } : {}) }), env, deps);
  return { gh, github, n, redis, call, tick: (ms: number) => (t += ms), now: () => t };
}

/** An email member (no GitHub) connects Claude: register, authorize, Allow by email, then the token. */
async function emailToken(w: ReturnType<typeof world>): Promise<string> {
  const reg = await w.call('/api/mcp?oauth=register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'Claude', redirect_uris: [CALLBACK] }) });
  const id = (await reg.json()).client_id as string;
  const q = new URLSearchParams({ response_type: 'code', client_id: id, redirect_uri: CALLBACK, code_challenge: CHALLENGE, code_challenge_method: 'S256', state: 'st8', resource: `${SITE}/mcp`, scope: 'bridge' });
  const auth = await w.call(`/api/mcp?oauth=authorize&${q}`);
  const request = new URL(auth.headers.get('location')!, SITE).searchParams.get('request')!;
  const cookie = /bridge_oauth=([^;]+)/.exec(auth.headers.get('set-cookie') ?? '')?.[1] ?? '';
  await putAccount(w.redis, { id: 'a2', email: 'dino@yopmail.com', name: 'Dino', createdAt: '2026-10-01T00:00:00Z', version: 1 } as never);
  const account = `${ACCOUNT_COOKIE}=${signAccountSession({ email: 'dino@yopmail.com', v: 1, exp: w.now() + 60_000 }, SECRET)}`;
  await memberStore(w.redis).put('acme/design', { email: 'dino@yopmail.com', name: 'Dino', role: 'edit', version: 1, addedBy: 'florian', at: '2026-10-01T00:00:00Z' });
  const approve = await w.call('/api/mcp?oauth=approve', { method: 'POST', headers: { 'content-type': 'application/json', origin: SITE, cookie: `bridge_oauth=${cookie}; ${account}` }, body: JSON.stringify({ request, repo: 'acme/design', allow: true, via: 'email' }) });
  const code = new URL((await approve.json()).redirect).searchParams.get('code')!;
  const tok = await w.call('/api/mcp?oauth=token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: VERIFIER, client_id: id, redirect_uri: CALLBACK, resource: `${SITE}/mcp` }).toString() });
  return (await tok.json()).access_token as string;
}

const rpc = (id: number, name: string, args: Record<string, unknown>) => JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });

/** One tool call: its answer, and the Redis commands and GitHub calls it cost. */
async function measure(w: ReturnType<typeof world>, token: string, id: number) {
  const r0 = w.n.commands;
  const g0 = w.github.calls;
  const res = await w.call('/api/mcp', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: rpc(id, 'bridge_get_token', { path: 'color.text.muted' }) });
  const body = (await res.json()) as { result?: { isError?: boolean; content?: { text: string }[] } };
  return { status: res.status, ok: !body.result?.isError, text: body.result?.content?.[0]?.text ?? '', redis: w.n.commands - r0, github: w.github.calls - g0 };
}

/**
 * Three calls a few seconds apart, as Claude makes them in one turn, then one a minute later (past the proxy's fresh
 * window, FRESH_MS: its kept answers are checked with GitHub again). The proxy's own memory starts empty.
 */
async function session(cache: boolean) {
  sharedSnapshots.clear();
  clearReadMemory();
  const w = world({ cache });
  const token = await emailToken(w);
  const out = [];
  for (let i = 1; i <= 3; i++) {
    out.push(await measure(w, token, i));
    w.tick(5_000);
  }
  w.tick(60_000);
  out.push(await measure(w, token, 4));
  return { w, token, out };
}

afterEach(() => {
  sharedSnapshots.clear();
  clearReadMemory();
});

describe('hosted MCP call cost for an email member (context cache by commit)', () => {
  it('cuts Redis commands and GitHub calls per call once the repository is kept, with the same answer', async () => {
    const before = await session(false);
    const after = await session(true);
    for (const r of [...before.out, ...after.out]) {
      expect(r.status).toBe(200);
      expect(r.ok, r.text).toBe(true);
    }
    expect(after.out.map((r) => r.text)).toEqual(before.out.map((r) => r.text));
    const [b, a] = [before.out[1]!, after.out[1]!];
    const [bLate, aLate] = [before.out[3]!, after.out[3]!];
    console.log(
      `per MCP call (bridge_get_token), email member through the team read proxy:\n` +
        `  before: redis ${before.out.map((r) => r.redis).join(' / ')}  github ${before.out.map((r) => r.github).join(' / ')}\n` +
        `  after:  redis ${after.out.map((r) => r.redis).join(' / ')}  github ${after.out.map((r) => r.github).join(' / ')}`,
    );
    // Warm: one live read through the proxy (the branch's commit) instead of the tree and every token file.
    expect(a.redis * 5).toBeLessThanOrEqual(b.redis);
    expect(a.github).toBeLessThanOrEqual(1);
    // Past the proxy's fresh window: one revalidated read instead of every one of them.
    expect(aLate.redis * 5).toBeLessThanOrEqual(bLate.redis);
    expect(aLate.github * 5).toBeLessThanOrEqual(bLate.github);
  });

  it('a push to the default branch: the next call reads the new commit, never the kept answer', async () => {
    const { w, token } = await session(true);
    const path = 'packages/tokens/src/semantic/light.tokens.json';
    const head = w.gh.refs.get('main')!;
    const next = new Map(w.gh.commits.get(head)!.files);
    next.set(path, next.get(path)!.replace('{palette.neutral.600}', '{palette.neutral.800}'));
    const sha = w.gh.id();
    w.gh.commits.set(sha, { files: next, parents: [head] });
    w.gh.refs.set('main', sha);
    // The proxy keeps the branch's commit for its fresh window (no webhook here): past it, the new commit shows.
    w.tick(10 * 60_000);
    const r = await measure(w, token, 9);
    expect(r.text).toContain('neutral.800');
    expect(r.github).toBeGreaterThan(1);
  });

  it('a member removed from the team gets nothing kept: the call is refused before any read', async () => {
    const { w, token } = await session(true);
    await memberStore(w.redis).remove('acme/design', 'dino@yopmail.com');
    const r = await w.call('/api/mcp', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: rpc(10, 'bridge_get_token', { path: 'color.text.muted' }) });
    expect(r.status).toBe(401);
  });
});
