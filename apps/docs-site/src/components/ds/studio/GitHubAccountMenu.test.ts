// @vitest-environment jsdom
// The GitHub account row as the DS Menu (A10): the nodes scripts/github-session.ts paints stay in the Astro block with
// their data hooks; the island moves the row into a DS Button trigger and the head into the open DS Menu (name, email,
// access on one edge), then Settings and Sign out ([data-gh-forget], the session's delegated click). No Link GitHub.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import GitHubAccountMenu from './GitHubAccountMenu';

const BLOCK = `
  <div class="gh-acct" data-gh-connect data-gh-acct data-state="connected">
    <div class="gh-acct-menu">
      <span class="gh-acct-who gh-acct-who-static" data-gh-who-src>
        <span class="gh-acct-text"><span class="gh-acct-login" data-gh-login>Florian</span><span class="gh-acct-repo" data-gh-acct-role>Can edit</span></span>
        <span class="sr-only">, account menu</span>
      </span>
      <div class="gh-acct-src" data-gh-head-src hidden>
        <p class="gh-acct-head-name" data-gh-menu-title>Florian</p>
        <p class="gh-acct-menu-email" data-gh-menu-email>florian@acme.example</p>
        <dl class="gh-facts"><dt>Access</dt><dd><span data-gh-perm>Can edit</span></dd></dl>
      </div>
      <span class="gh-acct-src" data-gh-forget-src hidden><span data-gh-forget-label>Sign out</span></span>
      <div id="island"></div>
    </div>
  </div>`;

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('GitHubAccountMenu', () => {
  it('moves the painted row into a DS Button trigger, and the head into the open DS Menu, then back on close', async () => {
    document.body.innerHTML = BLOCK;
    const user = userEvent.setup();
    render(createElement(GitHubAccountMenu, { signIn: true }), { container: document.getElementById('island')! });
    const trigger = await screen.findByRole('button', { name: /Florian.*account menu/ });
    // The painted nodes keep their hooks, inside the block (the session finds them there).
    expect(trigger.querySelector('[data-gh-login]')!.textContent).toBe('Florian');
    expect(trigger.closest('[data-gh-acct]')).not.toBeNull();
    expect(document.querySelector('[data-gh-who-src]')!.childElementCount).toBe(0);
    await user.click(trigger);
    const menu = await screen.findByRole('menu');
    await waitFor(() => expect(menu.querySelector('[data-gh-menu-title]')).not.toBeNull());
    expect(menu.querySelector('[data-gh-menu-email]')!.textContent).toBe('florian@acme.example');
    expect(menu.querySelector('[data-gh-perm]')!.textContent).toBe('Can edit');
    const items = within(menu).getAllByRole('menuitem').map((i) => i.textContent);
    expect(items).toEqual(['Settings', 'Sign out']);
    expect(within(menu).getByRole('menuitem', { name: 'Sign out' }).hasAttribute('data-gh-forget')).toBe(true);
    expect(within(menu).queryByText(/Link GitHub/)).toBeNull();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('[data-gh-head-src] [data-gh-menu-title]')).not.toBeNull());
    expect(document.querySelector('[data-gh-forget-src] [data-gh-forget-label]')).not.toBeNull();
  });

  it('offers Reconnect GitHub only on a site where a token is pasted', async () => {
    document.body.innerHTML = BLOCK;
    const user = userEvent.setup();
    render(createElement(GitHubAccountMenu, { signIn: false }), { container: document.getElementById('island')! });
    await user.click(await screen.findByRole('button', { name: /account menu/ }));
    const menu = await screen.findByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Reconnect GitHub' }).hasAttribute('data-gh-open')).toBe(true);
  });
});
