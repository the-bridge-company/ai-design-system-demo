// @vitest-environment jsdom
// The account menu says each thing once, and only where it helps (Florian, 2026-11-12): on the sample team no "Try it"
// (they are in it), and never a GitHub prompt anywhere ("Link GitHub", "GitHub not linked"): linking lives in Account
// settings and in the actions that need GitHub. A linked account still shows which one.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { roleWord, type Account } from '../../../lib/account';
import { DEMO_WORDS } from '../../../lib/demo';

const state = vi.hoisted(() => ({ account: null as Account | null }));
vi.mock('../../../scripts/account-session', () => ({
  getAccount: async () => ({ account: state.account }),
  onAccountChange: () => () => {},
  signOut: async () => {},
  linkGitHub: async () => {},
}));
vi.mock('./AccountSettings', () => ({ AccountDialog: () => null }));

const { default: AccountMenu, offersTryIt } = await import('./AccountMenu');

const leo = (github: Account['github'] = null): Account => ({
  email: 'leo@acme.com',
  name: 'Leo Martin',
  github,
  teams: [
    { repo: 'acme-design-demo/bridge-demo-ds', role: 'editor' },
    { repo: 'acme/ds', role: 'admin' },
  ] as Account['teams'],
});

async function openMenu(path: string, account: Account) {
  state.account = account;
  window.history.pushState({}, '', path);
  document.documentElement.setAttribute('data-hosted', '');
  render(createElement(AccountMenu));
  const trigger = await screen.findByRole('button', { name: /account menu/i });
  await userEvent.setup().click(trigger);
  await screen.findByRole('menu');
}

afterEach(() => {
  document.documentElement.removeAttribute('data-hosted');
  window.history.pushState({}, '', '/');
});

describe('offersTryIt', () => {
  it('never from inside the sample team', () => {
    expect(offersTryIt('/studio/acme-design-demo/bridge-demo-ds/')).toBe(false);
    expect(offersTryIt('/studio/acme-design-demo/bridge-demo-ds/library/')).toBe(false);
  });
  it('from their own team and from pages off any team', () => {
    expect(offersTryIt('/studio/acme/ds/')).toBe(true);
    expect(offersTryIt('/studio/start/')).toBe(true);
  });
});

describe('AccountMenu', () => {
  it('on the sample team: no Try it, no Link GitHub, no "not linked" line', async () => {
    await openMenu('/studio/acme-design-demo/bridge-demo-ds/', leo());
    expect(screen.getByText('leo@acme.com')).toBeTruthy();
    // The header keeps who they are here: name, email, then their role on this team.
    expect(within(screen.getByRole('menu')).getByText(new RegExp(roleWord('editor')))).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: DEMO_WORDS.tryIt })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: /link github/i })).toBeNull();
    expect(screen.queryByText(/not linked/i)).toBeNull();
    expect(screen.getByRole('menuitem', { name: /account settings/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: /sign out/i })).toBeTruthy();
  });

  it('on their own team without GitHub: no GitHub prompt at all, and Try it', async () => {
    await openMenu('/studio/acme/ds/', leo());
    expect(within(screen.getByRole('menu')).getByText('Admin')).toBeTruthy();
    expect(screen.queryAllByText(/github/i)).toEqual([]);
    expect(screen.getByRole('menuitem', { name: /account settings/i })).toBeTruthy();
    expect(screen.getByRole('menuitem', { name: DEMO_WORDS.tryIt })).toBeTruthy();
  });

  it('on their own team with GitHub: the linked account, no prompt', async () => {
    await openMenu('/studio/acme/ds/', leo({ login: 'leom', id: 7 }));
    expect(within(screen.getByRole('menu')).getByText('Admin')).toBeTruthy();
    expect(screen.getByText('GitHub @leom')).toBeTruthy();
    expect(screen.queryByRole('menuitem', { name: /link github/i })).toBeNull();
    expect(screen.getByRole('menuitem', { name: DEMO_WORDS.tryIt })).toBeTruthy();
  });
});
