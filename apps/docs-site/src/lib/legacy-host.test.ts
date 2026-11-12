// Bridge moved from bridge.floriangouloubi.com to bridgedesignsystem.com (api/_lib/site-origin.ts). The old host stays
// attached: its pages redirect (vercel.json), its machine endpoints keep answering, and a Claude connector added with
// the old address keeps one issuer while the person signs in on the new one.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_COOKIE, putAccount, signAccountSession } from '../../api/_lib/account';
import { memberStore } from '../../api/_lib/members';
import { memoryRedis } from '../../api/_lib/redis';
import { isLegacyOrigin, LEGACY_SITE_ORIGINS, requestSiteOrigin, SITE_ORIGIN } from '../../api/_lib/site-origin';
import { handleConnector, type ConnectorEnv, type FetchLike } from '../../api/mcp/index';
import { legacyHostRedirects } from './legacy-host';

const OLD = 'https://bridge.floriangouloubi.com';
const NEW = 'https://bridgedesignsystem.com';

describe('the addresses', () => {
  it('names the new origin and keeps the old one', () => {
    expect(SITE_ORIGIN).toBe(NEW);
    expect(LEGACY_SITE_ORIGINS).toEqual([OLD]);
    expect(isLegacyOrigin(`${OLD}/mcp`)).toBe(true);
    expect(isLegacyOrigin(NEW)).toBe(false);
  });

  it('answers with the host the request came in on when it is one of Bridge’s own, else PUBLIC_SITE_URL', () => {
    expect(requestSiteOrigin(new Request(`${OLD}/api/mcp`), NEW)).toBe(OLD);
    expect(requestSiteOrigin(new Request(`${NEW}/api/mcp`), OLD)).toBe(NEW);
    expect(requestSiteOrigin(new Request('https://bridge-docs-git-x.vercel.app/api/mcp'), NEW)).toBe(NEW);
    expect(requestSiteOrigin(new Request('https://bridge-docs-git-x.vercel.app/api/mcp'), undefined)).toBe('https://bridge-docs-git-x.vercel.app');
    expect(requestSiteOrigin(new Request('https://ds.acme.example/api/mcp'), 'not a url')).toBe('https://ds.acme.example');
  });
});

describe('vercel.json: the old host’s pages redirect, its machine endpoints do not', () => {
  const config = JSON.parse(readFileSync(join(__dirname, '../../vercel.json'), 'utf8')) as {
    redirects: { source: string; destination: string; permanent?: boolean; has?: { type: string; value: string }[] }[];
  };
  const onOldHost = config.redirects.filter((r) => r.has?.some((h) => h.type === 'host' && h.value === new URL(OLD).host));
  const paths = onOldHost.find((r) => r.source.startsWith('/:path('))!;
  // Vercel compiles `/:path(<pattern>)` to ^/(<pattern>)$ (path-to-regexp 6).
  const pattern = new RegExp(`^/(${paths.source.slice('/:path('.length, -1)})$`);
  const redirected = (path: string) => path === '/' || pattern.test(path);

  it('comes first, is permanent and keeps the path (Vercel keeps the query)', () => {
    expect(config.redirects.slice(0, onOldHost.length)).toEqual(onOldHost);
    expect(onOldHost).toEqual(legacyHostRedirects());
    expect(onOldHost.map((r) => [r.source === '/' ? '/' : 'path', r.destination, r.permanent])).toEqual([
      ['/', `${NEW}/`, true],
      ['path', `${NEW}/:path`, true],
    ]);
    expect(pattern.exec('/docs/security/')?.[1]).toBe('docs/security/');
  });

  it.each(['/', '/docs/security/', '/studio/', '/studio/acme/design/reviews/', '/studio/connect-figma/', '/studio/connect-claude/', '/studio/auth/access/', '/library/acme/design/components', '/about', '/apiary/', '/oauthy/', '/mcpx'])('redirects the page %s', (p) => {
    expect(redirected(p)).toBe(true);
  });

  it.each([
    ['/api/contribute', 'Studio, MCP, toolbar and CLI calls'],
    ['/api/github-webhook', 'the GitHub App webhook'],
    ['/api/plugin-link', 'the Figma plugin sign-in'],
    ['/api/fix-sessions', 'the Figma plugin fix sessions'],
    ['/api', 'the API root'],
    ['/mcp', 'the Claude connector'],
    ['/oauth/authorize', 'OAuth (it hands off in code)'],
    ['/oauth/token', 'OAuth tokens and refreshes'],
    ['/oauth/github', 'the GitHub leg of the connector'],
    ['/.well-known/oauth-protected-resource', 'RFC 9728 metadata'],
    ['/.well-known/oauth-authorization-server', 'RFC 8414 metadata'],
    ['/studio/auth/callback/', 'a GitHub sign-in already on its way'],
    ['/tokens.css', 'live tokens in products'],
    ['/claude-design-system/manifest.json', 'the Library for Claude Design'],
    ['/claude-design-system/1.8.4/project/README.md', 'the Library for Claude Design'],
    ['/_astro/index.abc123.css', 'built assets'],
    ['/library-export.zip', 'the Library export'],
    ['/studio/library-files.json', 'Library files'],
    ['/docs-ai/button.json', 'docs for agents'],
    ['/llms.txt', 'docs for agents'],
    ['/icon-192.png', 'the connector icon'],
    ['/figma-fixes.schema.json', 'a $schema URL'],
  ])('keeps %s on the old host (%s)', (p) => {
    expect(redirected(p)).toBe(false);
  });
});

describe('a Claude connector added with the old address', () => {
  const VERIFIER = 'v'.repeat(64);
  const CHALLENGE = createHash('sha256').update(VERIFIER).digest('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  const CALLBACK = 'https://claude.ai/api/mcp/auth_callback';
  const SECRET = 's'.repeat(40);
  const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

  function world() {
    const t = Date.parse('2026-11-11T10:00:00Z');
    const f: FetchLike = async (url, init) => {
      const u = new URL(url);
      if (u.pathname === '/login/oauth/access_token') return res(200, { access_token: 'ghu_user_token_1_0000000000', expires_in: 28800, refresh_token: 'ghr_refresh_1_000000', refresh_token_expires_in: 15811200 });
      if (u.pathname === '/user') return res(200, { login: 'dana', name: 'Dana Kim' });
      if (u.pathname === '/repos/acme/design') return res(200, { default_branch: 'main', permissions: { admin: false, push: true, pull: true } });
      return res(404, { method: init.method });
    };
    const redis = memoryRedis(() => t);
    // Production after the move: PUBLIC_SITE_URL is the new address.
    const env: ConnectorEnv = { LIBRARY_SESSION_SECRET: SECRET, GITHUB_APP_CLIENT_ID: 'Iv1.bridge', GITHUB_APP_CLIENT_SECRET: 'app-secret', PUBLIC_SITE_URL: NEW };
    const call = (origin: string, path: string, init: { method?: string; headers?: Record<string, string>; body?: string } = {}) =>
      handleConnector(new Request(`${origin}${path}`, { method: init.method ?? 'GET', headers: { host: new URL(origin).host, ...(init.headers ?? {}) }, ...(init.body !== undefined ? { body: init.body } : {}) }), env, { fetch: f, now: () => t, redis });
    return { call, redis, now: () => t };
  }
  const form = (o: Record<string, string>) => ({ method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(o).toString() });
  const cookieOf = (r: Response) => /bridge_oauth=([^;]+)/.exec(r.headers.get('set-cookie') ?? '')?.[1] ?? '';

  it('keeps the old issuer and resource, signs the person in on the new address, and its tokens work on the old one', async () => {
    const w = world();
    // Discovery on the old host still names the old host (the resource must match the URL Claude was given).
    expect(await (await w.call(OLD, '/api/mcp?wk=resource')).json()).toMatchObject({ resource: `${OLD}/mcp`, authorization_servers: [OLD] });
    expect(await (await w.call(OLD, '/api/mcp?wk=as')).json()).toMatchObject({ issuer: OLD, token_endpoint: `${OLD}/oauth/token` });
    expect(await (await w.call(NEW, '/api/mcp?wk=resource')).json()).toMatchObject({ resource: `${NEW}/mcp`, authorization_servers: [NEW] });

    const reg = await (await w.call(OLD, '/api/mcp?oauth=register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'Claude', redirect_uris: [CALLBACK] }) })).json();
    const q = new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: CALLBACK, code_challenge: CHALLENGE, code_challenge_method: 'S256', state: 'st8', resource: `${OLD}/mcp`, scope: 'bridge' });
    // Authorize on the old host: no cookie there, a one-time handoff to the new address instead.
    const auth = await w.call(OLD, `/api/mcp?oauth=authorize&${q}`);
    expect(auth.status).toBe(302);
    expect(auth.headers.get('set-cookie')).toBeNull();
    const hand = new URL(auth.headers.get('location')!);
    expect(hand.origin + hand.pathname).toBe(`${NEW}/oauth/authorize`);
    // On the new address: bound to this browser, then the Studio page.
    const moved = await w.call(NEW, `/api/mcp?oauth=authorize&${hand.searchParams}`);
    expect(moved.status).toBe(302);
    const page = new URL(moved.headers.get('location')!, NEW);
    expect(page.pathname).toBe('/studio/connect-claude/');
    const request = page.searchParams.get('request')!;
    const cookie = cookieOf(moved);
    expect(cookie).not.toBe('');
    // The handoff works once.
    expect((await w.call(NEW, `/api/mcp?oauth=authorize&${hand.searchParams}`)).status).toBe(410);

    await putAccount(w.redis, { id: 'a1', email: 'dana@acme.example', name: 'Dana', github: { login: 'dana', id: 7 }, createdAt: '2026-10-01T00:00:00Z', version: 1 });
    await memberStore(w.redis).put('acme/design', { email: 'dana@acme.example', name: 'Dana', role: 'admin', version: 1, addedBy: 'x', at: '2026-10-01T00:00:00Z' });
    const account = `${ACCOUNT_COOKIE}=${signAccountSession({ email: 'dana@acme.example', v: 1, exp: w.now() + 60_000 }, SECRET)}`;
    const info = await (await w.call(NEW, `/api/mcp?oauth=request&id=${request}`, { headers: { cookie: `bridge_oauth=${cookie}; ${account}` } })).json();
    expect(info).toMatchObject({ sameBrowser: true, signedIn: true });
    const approve = await w.call(NEW, '/api/mcp?oauth=approve', { method: 'POST', headers: { 'content-type': 'application/json', origin: NEW, cookie: `bridge_oauth=${cookie}; ${account}` }, body: JSON.stringify({ request, repo: 'acme/design', allow: true }) });
    expect(approve.status).toBe(200);
    const gh = new URL((await approve.json()).redirect);
    expect(gh.searchParams.get('redirect_uri')).toBe(`${NEW}/oauth/github`);
    const back = await w.call(NEW, `/api/mcp?oauth=github&code=ghcode&state=${gh.searchParams.get('state')}`, { headers: { cookie: `bridge_oauth=${cookie}` } });
    const to = new URL(back.headers.get('location')!);
    expect(to.origin + to.pathname).toBe(CALLBACK);
    // Claude checks iss against the issuer it discovered: the old one.
    expect(to.searchParams.get('iss')).toBe(OLD);

    // Tokens and refreshes on the old host, for the old resource.
    const tok = await w.call(OLD, '/api/mcp?oauth=token', form({ grant_type: 'authorization_code', code: to.searchParams.get('code')!, code_verifier: VERIFIER, client_id: reg.client_id, redirect_uri: CALLBACK, resource: `${OLD}/mcp` }));
    expect(tok.status).toBe(200);
    const t = await tok.json();
    const refreshed = await w.call(OLD, '/api/mcp?oauth=token', form({ grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: reg.client_id, resource: `${OLD}/mcp` }));
    expect(refreshed.status).toBe(200);
  });

  it('a connector added with the new address never hands off', async () => {
    const w = world();
    const reg = await (await w.call(NEW, '/api/mcp?oauth=register', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_name: 'Claude', redirect_uris: [CALLBACK] }) })).json();
    const q = new URLSearchParams({ response_type: 'code', client_id: reg.client_id, redirect_uri: CALLBACK, code_challenge: CHALLENGE, code_challenge_method: 'S256', resource: `${NEW}/mcp` });
    const auth = await w.call(NEW, `/api/mcp?oauth=authorize&${q}`);
    expect(new URL(auth.headers.get('location')!, NEW).pathname).toBe('/studio/connect-claude/');
    expect(cookieOf(auth)).not.toBe('');
  });

  it('an unknown handoff is an expired request', async () => {
    const w = world();
    expect((await w.call(NEW, `/api/mcp?oauth=authorize&handoff=${'x'.repeat(43)}`)).status).toBe(410);
  });
});
