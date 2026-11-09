import { describe, expect, it } from 'vitest';
import { looksLikeAWall, migrationReport, oidcToken } from './private-shots.mjs';

describe('the one-off move of the screenshots out of Redis', () => {
  it('prints what moved and what it freed', () => {
    expect(migrationReport({ dryRun: false, keys: 3, moved: 2, inStore: 1, redisBytesFreed: 204800, orphansDeleted: 1, orphanBytes: 51200 })).toBe(
      ['Migration done.', '- 3 capture(s) indexed in Redis, 1 already in the Blob store', '- 2 image(s) moved to the Blob store, 200 KB of Redis freed', '- 1 stored image(s) no capture names deleted (50 KB)'].join('\n'),
    );
    expect(migrationReport({ dryRun: true, keys: 0, moved: 0, inStore: 0, redisBytesFreed: 0, orphansDeleted: 0, orphanBytes: 0 })).toMatch(/^Dry run: nothing changed\./);
  });
});

describe('private shots runner', () => {
  it('never keeps a sign-in page', () => {
    expect(looksLikeAWall('https://vercel.com/login?next=x')).toBe(true);
    expect(looksLikeAWall('https://shop.pages.dev/cdn-cgi/access/login')).toBe(true);
    expect(looksLikeAWall('https://explore-team.acme-account-design.pages.dev/team')).toBe(false);
  });

  it('asks GitHub for the token with the bridge-shots audience, and says what the workflow lacks', async () => {
    const seen = [];
    const f = async (url, init) => (seen.push([url, init.headers.authorization]), Response.json({ value: 'jwt' }));
    expect(await oidcToken({ ACTIONS_ID_TOKEN_REQUEST_URL: 'https://gh/token?x=1', ACTIONS_ID_TOKEN_REQUEST_TOKEN: 't' }, f)).toBe('jwt');
    expect(seen).toEqual([['https://gh/token?x=1&audience=bridge-shots', 'Bearer t']]);
    await expect(oidcToken({}, f)).rejects.toThrow(/id-token: write/);
  });
});

import { hintedTarget } from './preview-shots.mjs';

describe('the page a capture opens', () => {
  it('opens the link the changed files name, never the root or another origin', () => {
    const links = [{ href: '/', text: 'Home' }, { href: 'https://elsewhere.dev/billing', text: 'Billing' }, { href: '/team', text: 'Team' }, { href: '/billing', text: 'Billing' }];
    expect(hintedTarget(links, 'https://x.pages.dev', ['billing'])).toBe('https://x.pages.dev/billing');
    expect(hintedTarget([{ href: '#/orders', text: 'Orders' }], 'https://x.pages.dev', ['orders'])).toBe('https://x.pages.dev/#/orders');
    expect(hintedTarget(links, 'https://x.pages.dev', ['plans'])).toBeNull();
    expect(hintedTarget(links, 'https://x.pages.dev', [])).toBeNull();
    // The strongest hint wins over the first link a weaker one matches ("account" from account.module.css).
    const account = [{ href: '/settings', text: 'Account settings' }, { href: '/billing', text: 'Billing' }];
    expect(hintedTarget(account, 'https://x.pages.dev', ['billing', 'account'])).toBe('https://x.pages.dev/billing');
  });
});

import { captureTarget } from './private-shots.mjs';
import { atScreen, bodyScreenOf, shotDecision } from './preview-shots.mjs';

describe('the screen an exploration chose', () => {
  it('is where the capture opens, nowhere else; without one, the root and the hints', () => {
    expect(captureTarget('https://explore-x.acme-prints-design.pages.dev/', { screen: '/#/orders/XGZFHY3Z', hints: ['orders'] })).toEqual({
      url: 'https://explore-x.acme-prints-design.pages.dev/#/orders/XGZFHY3Z',
      options: { crawl: false, hints: [] },
      at: '/#/orders/XGZFHY3Z',
    });
    expect(captureTarget('https://x.pages.dev/', { screen: '/?workspace=new#/' }).url).toBe('https://x.pages.dev/?workspace=new#/');
    expect(captureTarget('https://x.pages.dev/', { screen: null, hints: ['billing'] })).toEqual({ url: 'https://x.pages.dev/', options: { hints: ['billing'] }, at: null });
    // Another site is never opened.
    expect(captureTarget('https://x.pages.dev/', { screen: '//evil.example/x', hints: [] }).url).toBe('https://x.pages.dev/');
  });

  it('reads the screen from the exploration block, and captures again when another one is chosen', () => {
    const body = (screen) => `## Exploration: X\n\n<!-- bridge-exploration ${JSON.stringify({ name: 'X', purpose: '', screen })} -->`;
    expect(bodyScreenOf(body('/#/deals'))).toBe('/#/deals');
    expect(bodyScreenOf(body('https://evil.example/'))).toBeNull();
    expect(bodyScreenOf('no block')).toBeNull();
    expect(atScreen('https://x.pages.dev/?bridge=1', '/?w=new#/')).toBe('https://x.pages.dev/?bridge=1&w=new#/');
    const stored = { sha: 'a', image: 'a.webp', at: '/#/deals' };
    expect(shotDecision({ sha: 'a', stored, screen: '/#/deals' }).action).toBe('skip');
    expect(shotDecision({ sha: 'a', stored, screen: '/#/contacts/31/show' }).action).toBe('capture');
    expect(shotDecision({ sha: 'a', stored: { sha: 'a', image: 'a.webp' } }).action).toBe('skip');
    expect(shotDecision({ sha: 'a', stored: { sha: 'a', image: 'a.webp' }, screen: '/#/deals' }).action).toBe('capture');
  });
});
