// The GitHub account row at the foot of the Studio side nav (components/GitHubAccount.astro) as the DS Menu (A10), the
// same component as the Bridge account row (components/ds/account/AccountMenu.tsx): a full-width ghost Button trigger and
// a MenuContent with the person (name, email, access on one left edge), then Settings and Sign out.
// scripts/github-session.ts keeps painting the row and the menu's head through their data hooks ([data-gh-login],
// [data-gh-avatar], [data-gh-menu-title], [data-gh-menu-email], [data-gh-perm], [data-gh-forget-label]...): those nodes
// are rendered by the Astro block, never by React, and this island moves them into the trigger and the open menu (and
// back into the block when the menu closes), so the script finds them where it always did and React never owns their
// text. Sign out keeps [data-gh-forget] (the session's delegated click), Reconnect GitHub [data-gh-open].
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronsUpDown, LogOut, Pencil, Settings } from 'lucide-react';
import { Button, Icon, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from '@bridge-ds/react';
import { studioHref } from '../../../lib/team-path';

export interface GitHubAccountMenuProps {
  /** The site signs in with the Bridge sign-in screen: no "Reconnect GitHub" (a pasted token) item. */
  signIn: boolean;
}

/** Moves the children of `from` into `to` (the static nodes the session paints), and returns a way to move them back. */
function moveChildren(from: Element, to: Element): () => void {
  const nodes = [...from.childNodes];
  nodes.forEach((n) => to.appendChild(n));
  return () => nodes.forEach((n) => from.appendChild(n));
}

/** Holds the static nodes of `source` (an element of the block, by selector) while mounted. */
function useHeld(block: HTMLElement | null, selector: string) {
  return useCallback(
    (slot: HTMLElement | null) => {
      if (!slot || !block) return;
      const from = block.querySelector(selector);
      if (!from) return;
      const back = moveChildren(from, slot);
      // Base UI unmounts the popup on close: the nodes go home first, where the session paints them.
      const done = new MutationObserver(() => {
        if (slot.isConnected) return;
        done.disconnect();
        back();
      });
      done.observe(document.body, { childList: true, subtree: true });
    },
    [block, selector],
  );
}

export default function GitHubAccountMenu({ signIn }: GitHubAccountMenuProps) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [block, setBlock] = useState<HTMLElement | null>(null);
  const [contributor, setContributor] = useState(false);
  useEffect(() => setBlock(anchor.current?.closest<HTMLElement>('[data-gh-acct]') ?? null), []);
  // An email contributor's menu reads name, email, access (styles/studio-app.css): the popup follows the block's flag.
  useEffect(() => {
    if (!block) return;
    const read = () => setContributor(block.hasAttribute('data-contributor'));
    read();
    const o = new MutationObserver(read);
    o.observe(block, { attributes: true, attributeFilter: ['data-contributor'] });
    return () => o.disconnect();
  }, [block]);
  const who = useHeld(block, '[data-gh-who-src]');
  const head = useHeld(block, '[data-gh-head-src]');
  const forget = useHeld(block, '[data-gh-forget-src]');

  return (
    <span ref={anchor} className="gh-acct-menu-island">
      {block && (
        <Menu>
          {/* Named by what it shows (WCAG 2.5.3): the name, the team or role, then a hidden ", account menu" (moved in). */}
          <MenuTrigger render={<Button variant="ghost" fullWidth className="gh-acct-who" />}>
            <span ref={who} className="gh-acct-who-slot" />
            <Icon icon={ChevronsUpDown} size="sm" />
          </MenuTrigger>
          <MenuContent align="start" side="top" className="gh-acct-pop" data-contributor={contributor ? '' : undefined}>
            <div ref={head} className="gh-acct-head" />
            <MenuSeparator />
            {!signIn && (
              <MenuItem icon={Pencil} data-gh-open="" data-gh-token-only="">
                Reconnect GitHub
              </MenuItem>
            )}
            <MenuItem icon={Settings} onClick={() => location.assign(studioHref('settings/'))}>
              Settings
            </MenuItem>
            <MenuItem icon={LogOut} data-gh-forget="">
              <span ref={forget} />
            </MenuItem>
          </MenuContent>
        </Menu>
      )}
    </span>
  );
}
