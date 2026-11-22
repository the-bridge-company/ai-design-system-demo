// @vitest-environment jsdom
// Connect Figma (the plugin's "Sign in with Bridge"): the teams to pick are the team switcher's, so an admin of the
// site's own design system with no Bridge account team can connect Figma to it (regression: "You are not in a team yet").
// Then each outcome of the approve call (api/plugin-link): connected, expired, used, refused, GitHub signed out.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';

const approvals: Record<string, unknown>[] = [];
// What POST /api/plugin-link answers to approve, per test.
let approveAnswer: { status: number; body: Record<string, unknown> } = { status: 200, body: { approved: true } };
vi.mock('../../../scripts/account-session', () => ({
  getAccount: async () => ({ available: true, account: { email: 'florian@example.com', name: 'Florian', nameSet: true, github: { login: 'peterbono', id: 1 }, teams: [] } }),
  workingGitHubToken: async () => 'ghu_signed_in_token_0000000000',
}));
vi.mock('../../../scripts/github-session', () => ({ readAppSession: () => null, refreshSignIn: async () => true }));
const { default: ConnectFigma } = await import('./ConnectFigma');

beforeEach(() => {
  approvals.length = 0;
  approveAnswer = { status: 200, body: { approved: true } };
  localStorage.clear();
  document.documentElement.dataset.ownLibrary = 'the-bridge-company/ai-design-system-demo';
  history.replaceState(null, '', '/studio/connect-figma/?code=ABCDEFGHIJ');
  vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
    if (url === 'https://api.github.com/repos/the-bridge-company/ai-design-system-demo') return new Response(JSON.stringify({ permissions: { admin: true, push: true, pull: true } }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (url === '/api/plugin-link') {
      approvals.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify(approveAnswer.body), { status: approveAnswer.status, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 404 });
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.ownLibrary;
});

describe('Connect Figma: the teams to pick', () => {
  it("an admin of the site's own team with zero Bridge account teams can connect Figma to it", async () => {
    render(createElement(ConnectFigma));
    expect(await screen.findByText('ai-design-system-demo')).toBeTruthy();
    expect(screen.queryByText(/You are not in a team yet/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Connect Figma' }));
    await waitFor(() => expect(approvals[0]).toMatchObject({ action: 'approve', code: 'ABCDEFGHIJ', repo: 'the-bridge-company/ai-design-system-demo' }));
  });
});

async function connectTo(answer: typeof approveAnswer) {
  approveAnswer = answer;
  render(createElement(ConnectFigma));
  await screen.findByText('ai-design-system-demo');
  await userEvent.click(screen.getByRole('button', { name: 'Connect Figma' }));
}

describe('Connect Figma: a standalone card, one action, then the outcome', () => {
  it('says who is signed in, with one primary action', async () => {
    render(createElement(ConnectFigma));
    expect(await screen.findByText(/Signed in as Florian\./)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Connect Figma' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Use another account' })).toBeTruthy();
    expect(screen.getAllByRole('button').filter((b) => b.textContent === 'Connect Figma')).toHaveLength(1);
  });

  it('connected: says the next step happens in Figma, names the team, and never asks to close a tab', async () => {
    await connectTo({ status: 200, body: { approved: true } });
    const title = await screen.findByRole('heading', { level: 1, name: 'Figma is connected' });
    expect(screen.getByText('Go back to Figma: DS Bridge now uses the ai-design-system-demo design system.')).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/close this tab/i);
    // The outcome is read out, and nothing is left to press but one quiet link.
    await waitFor(() => expect(document.activeElement).toBe(title));
    expect(screen.queryByRole('button', { name: 'Connect Figma' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Open Studio' }).getAttribute('href')).toBe('/studio/');
    await expectNoAxeViolations(document.body);
  });

  it('expired: the code cannot be approved again, so the card says to start again from the plugin, with no action', async () => {
    await connectTo({ status: 410, body: { error: 'expired', message: 'This sign-in expired. Start again from the plugin.' } });
    expect(await screen.findByRole('heading', { level: 1, name: 'This sign-in expired' })).toBeTruthy();
    expect(screen.getByText(/Start again from the DS Bridge plugin in Figma/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('already used: says so, with no action', async () => {
    await connectTo({ status: 409, body: { error: 'used', message: 'This sign-in was already used. Start again from the plugin.' } });
    expect(await screen.findByRole('heading', { level: 1, name: 'This sign-in was already used' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Connect Figma' })).toBeNull();
  });

  it('refused team: the server words in place, the choice and the action stay to pick another team', async () => {
    const message = "Your GitHub sign-in cannot open this team's design system. Pick a team you belong to, or ask its admin for access.";
    await connectTo({ status: 403, body: { error: 'wrong_team', message } });
    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Connect Figma' })).toBeTruthy();
  });

  it('GitHub sign-in refused by the server: the step that connects GitHub again', async () => {
    await connectTo({ status: 401, body: { error: 'signin', message: 'Sign in with GitHub in Studio first, then connect Figma.' } });
    expect(await screen.findByRole('button', { name: 'Connect GitHub' })).toBeTruthy();
  });
});
