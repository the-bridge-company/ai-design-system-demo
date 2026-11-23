// @vitest-environment jsdom
// The sign-in screen while Bridge opens on invitation (api/account BRIDGE_ACCESS_GATE): a new email turned down after
// its code shows "Bridge opens in small groups" with Request access (this email) and the demo; an access link
// (/signin/?access=) says who invited, goes along with the code, and leaves the address bar; a spent link says so with
// Request access; ?email= fills the email in. Axe clean.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import { setAccountFetch } from '../../../scripts/account-session';
import { setEntryFetch } from '../../../scripts/entry-session';
import { ACCESS_LINK_KEY } from '../../../lib/access-request';
import { DEMO_HOME } from '../../../lib/start';
import SignIn, { navigate } from './SignIn';

vi.mock('../../../scripts/github-session', () => ({ hasWorkingToken: () => false, getToken: () => null, startSignIn: vi.fn(async () => {}) }));

const TOKEN = 'A'.repeat(43);
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
type Call = { url: string; method: string; body: Record<string, unknown> | null };
let calls: Call[] = [];
let link: unknown = { valid: true, label: 'Ana at Acme', inviter: 'Florian', expiresAt: '2026-12-07T10:00:00.000Z' };
let verifyReply: () => Response = () => json(200, { account: { email: 'ana@acme.example', name: 'Ana', github: null, teams: [] }, created: true, next: '/start/' });

beforeEach(() => {
  calls = [];
  sessionStorage.clear();
  localStorage.clear();
  link = { valid: true, label: 'Ana at Acme', inviter: 'Florian', expiresAt: '2026-12-07T10:00:00.000Z' };
  verifyReply = () => json(200, { account: { email: 'ana@acme.example', name: 'Ana', github: null, teams: [] }, created: true, next: '/start/' });
  setEntryFetch(async () => json(200, { kind: 'create' }));
  setAccountFetch(async (url, init) => {
    const c = { url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null };
    calls.push(c);
    if (url.startsWith('/api/access?link=')) return json(200, link);
    if (c.method === 'GET') return json(200, { available: true, account: null });
    if (c.body?.action === 'verify') return verifyReply();
    return json(200, { ok: true });
  });
  vi.spyOn(navigate, 'to').mockImplementation(() => {});
});

afterEach(() => {
  setAccountFetch(null);
  setEntryFetch(null);
  vi.restoreAllMocks();
});

async function codeStep(email?: string) {
  const user = userEvent.setup();
  const field = await screen.findByRole('textbox', { name: 'Work email' });
  await waitFor(() => expect(field).toBeEnabled());
  if (email) await user.type(field, email);
  await user.click(screen.getByRole('button', { name: 'Send code' }));
  await screen.findByRole('heading', { name: 'Check your inbox' });
  return user;
}

describe('sign-in, Bridge on invitation', () => {
  it('turns a new email down after the code with one clear panel: Request access with this email, and the demo', async () => {
    history.replaceState(null, '', '/signin/');
    verifyReply = () => json(403, { error: 'access_required', message: 'Bridge opens in small groups. Request access with this email and we reply within 2 working days.', request: '/request/?email=new%40acme.example' });
    const { container } = render(createElement(SignIn));
    const user = await codeStep('new@acme.example');
    await user.click(screen.getByRole('textbox', { name: 'Code' }));
    await user.paste('123456');
    expect(await screen.findByRole('heading', { name: 'Bridge opens in small groups' })).toBeInTheDocument();
    expect(screen.getByText('Request access with this email and we reply within 2 working days. The demo is open meanwhile.')).toBeInTheDocument();
    const request = screen.getByRole('link', { name: 'Request access' });
    expect(request).toHaveAttribute('href', '/request/?email=new%40acme.example');
    expect(request.className).toMatch(/primary/);
    const demo = screen.getByRole('link', { name: 'Open the demo' });
    expect(demo).toHaveAttribute('href', DEMO_HOME);
    expect(demo.className).toMatch(/secondary/);
    expect(screen.queryByRole('textbox', { name: 'Code' })).toBeNull();
    expect(navigate.to).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement?.id).toBe('acc-title'));
    await expectNoAxeViolations(container);
  });

  it('says who invited on an access link, sends its token with the code, then forgets it', async () => {
    history.replaceState(null, '', `/signin/?access=${TOKEN}`);
    const { container } = render(createElement(SignIn));
    expect(await screen.findByRole('heading', { name: 'Florian invited you to Bridge' })).toBeInTheDocument();
    expect(screen.getByText('Sign in with your work email to start.')).toBeInTheDocument();
    // Out of the address bar at once, kept in this tab (for GitHub and back).
    expect(location.search).toBe('');
    expect(sessionStorage.getItem(ACCESS_LINK_KEY)).toBe(TOKEN);
    await expectNoAxeViolations(container);
    const user = await codeStep('ana@acme.example');
    await user.click(screen.getByRole('textbox', { name: 'Code' }));
    await user.paste('123456');
    await waitFor(() => expect(calls.find((c) => c.body?.action === 'verify')?.body).toMatchObject({ action: 'verify', email: 'ana@acme.example', code: '123456', access: TOKEN }));
    await waitFor(() => expect(sessionStorage.getItem(ACCESS_LINK_KEY)).toBeNull());
    // The code request never carries it: access is checked only once the code is right.
    expect(calls.find((c) => c.body?.action === 'code')?.body).toEqual({ action: 'code', email: 'ana@acme.example' });
  });

  it('says a spent or expired link no longer works, with Request access first', async () => {
    for (const reason of ['expired', 'used']) {
      link = { valid: false, reason };
      history.replaceState(null, '', `/signin/?access=${TOKEN}`);
      const { container, unmount } = render(createElement(SignIn));
      expect(await screen.findByRole('heading', { name: 'Bridge opens in small groups' })).toBeInTheDocument();
      expect(screen.getByText('This invite link has expired. Request access and we will review it first.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Request access' })).toHaveAttribute('href', '/request/');
      expect(screen.queryByRole('textbox', { name: 'Work email' })).toBeNull();
      expect(sessionStorage.getItem(ACCESS_LINK_KEY)).toBeNull();
      await expectNoAxeViolations(container);
      unmount();
    }
  });

  it('fills the email in from ?email= (the "Your Bridge access is open" email)', async () => {
    history.replaceState(null, '', '/signin/?email=ana%40acme.example');
    render(createElement(SignIn));
    const field = await screen.findByRole('textbox', { name: 'Work email' });
    await waitFor(() => expect(field).toHaveValue('ana@acme.example'));
    expect(calls.some((c) => c.url.startsWith('/api/access'))).toBe(false);
  });
});
