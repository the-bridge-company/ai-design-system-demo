// Who is signed in, with a Bridge account (GET /api/account), on every Studio page: the account row at the foot of
// the side nav (the GitHub-only block steps aside, styles/account.css) and the avatar of the top bar on screens
// without a nav (the sign-in, start and invite screens). One DS Menu: the name, email and role on this team, the GitHub account once linked (linking lives in Account
// settings and in the actions that need it, never pushed here),
// Account settings (the Account dialog: name, email, teams, sign out everywhere, delete; Settings itself starts with
// the team, board D9), Sign out. An old link to #account opens the dialog. The face is the GitHub photo once linked, else the DS drawn face (never initials). The
// row's second line is the person's role on this team, else their email. Nothing shows signed out or on a site
// without accounts: the GitHub block keeps working as before.
import { useEffect, useState } from 'react';
import { Compass, LogOut, Settings } from 'lucide-react';
import { Avatar, Button, Icon, Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, VisuallyHidden } from '@bridge-ds/react';
import { ChevronsUpDown } from 'lucide-react';
import { ACCOUNT_WORDS as W, accountName, roleWord, signedOutHref, type Account } from '../../../lib/account';
import { ownerAvatarUrl } from '../../../lib/access-view';
import { emailMemberFace } from '../../../lib/people';
import { AccountDialog } from './AccountSettings';
import { DEMO_HOME } from '../../../lib/start';
import { DEMO_WORDS, isSampleTeam } from '../../../lib/demo';
import { castJob } from '../../../lib/demo-cast';
import '../../../styles/account.css';
import { FACES_EVENT, faceUri } from '../../../scripts/team-faces';

/**
 * The drawn face of someone signed in by email (lazy: the drawings are a separate chunk): the face they saved in
 * Settings > You, else the one seeded by their name like every other place that shows them (lib/people
 * emailMemberFace, scripts/team-faces faceUri), or the GitHub photo once linked.
 */
export function useFace(account: Account | null): string | undefined {
  const [face, setFace] = useState<string | undefined>(undefined);
  const login = account?.github?.login;
  const seed = account ? emailMemberFace(account.name, account.email) : null;
  useEffect(() => {
    let live = true;
    const draw = () => {
      if (login) setFace(ownerAvatarUrl(login, 64));
      else if (seed) void import('@bridge-ds/react/avatar-illustrated').then((m) => live && setFace(faceUri(m, seed)));
      else setFace(undefined);
    };
    draw();
    // A face saved in Settings > You shows here at once.
    document.addEventListener(FACES_EVENT, draw);
    return () => {
      live = false;
      document.removeEventListener(FACES_EVENT, draw);
    };
  }, [login, seed]);
  return face;
}

/** The signed-in account, read once per page and kept in step (scripts/account-session.ts). */
export function useAccount(): Account | null {
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    let live = true;
    let stop: (() => void) | null = null;
    void import('../../../scripts/account-session').then(({ getAccount, onAccountChange }) => {
      if (!live) return;
      stop = onAccountChange((a) => live && setAccount(a));
      void getAccount().then((i) => live && setAccount(i.account));
    });
    return () => {
      live = false;
      stop?.();
    };
  }, []);
  return account;
}

/** "owner/repo" a Studio path is on, or null off a team page. */
export function pathTeam(pathname: string): string | null {
  const m = /^\/studio\/(?:~\/)?([^/]+)\/([^/]+)\//.exec(pathname);
  return m ? `${decodeURIComponent(m[1]!)}/${decodeURIComponent(m[2]!)}` : null;
}

/** "owner/repo" of this team page, or null on a page that reads no repository. */
function pageTeam(): string | null {
  const root = document.documentElement;
  if (root.hasAttribute('data-no-repo') || !root.hasAttribute('data-hosted')) return null;
  return pathTeam(location.pathname);
}

/**
 * Whether the menu offers "Try it" (the sample team): from anywhere but the sample team itself, where they already are.
 * GitHub is never pushed here: Account settings links it, and the actions that need GitHub ask for it when they do.
 */
export function offersTryIt(pathname: string): boolean {
  return !isSampleTeam(pathTeam(pathname));
}

export interface AccountMenuProps {
  /** The top bar: the face alone. Otherwise the side nav's full-width row. */
  compact?: boolean;
}

export default function AccountMenu({ compact = false }: AccountMenuProps) {
  const account = useAccount();
  const face = useFace(account);
  const [team, setTeam] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => setTeam(pageTeam()), []);
  // Settings' old #account anchor (and the former Account settings links) opens the dialog.
  useEffect(() => {
    if (account && location.hash === '#account') setOpen(true);
  }, [account]);
  if (!account) return null;

  const name = accountName(account);
  const here = team ? account.teams.find((t) => t.repo.toLowerCase() === team.toLowerCase()) : undefined;
  const line = here ? roleWord(here.role) : account.email;
  // Who they are on this team, one quiet line under the email: their job on the sample team (lib/demo-cast castJob,
  // "Design lead"), and their access level as the account row says it ("Admin").
  const job = team ? castJob(team, { email: account.email, login: account.github?.login })?.split(',')[0]?.trim() : null;
  const role = [job, here ? roleWord(here.role) : null].filter(Boolean).join(', ');
  const tryIt = offersTryIt(location.pathname);
  const signOut = async () => {
    setBusy(true);
    const { signOut: end } = await import('../../../scripts/account-session');
    try {
      await end();
      // The sign-in screen says "You're signed out", and brings them back here once signed in again.
      location.assign(signedOutHref('out', location.pathname + location.search));
    } catch {
      location.reload();
    }
  };

  // Named by what it shows (WCAG 2.5.3: voice control finds it by its visible text): the person's name and their role or
  // email, then a hidden "account menu". The face is decorative; the top bar's face alone says who is signed in.
  return (
    <>
    <Menu>
      {compact ? (
        <MenuTrigger render={<Button variant="ghost" size="sm" className="acc-menu-trigger" />}>
          <Avatar name={name} src={face} size="sm" decorative />
          <VisuallyHidden>{W.signedInAs(name)}, account menu</VisuallyHidden>
        </MenuTrigger>
      ) : (
        <MenuTrigger render={<Button variant="ghost" fullWidth className="acc-menu-trigger" />}>
          <Avatar name={name} src={face} size="md" decorative />
          <span className="acc-menu-text">
            <span className="acc-menu-name">{name}</span>
            <VisuallyHidden>,</VisuallyHidden>{' '}
            <span className="acc-menu-line">{line}</span>
            <VisuallyHidden>, account menu</VisuallyHidden>
          </span>
          <Icon icon={ChevronsUpDown} size="sm" />
        </MenuTrigger>
      )}
      <MenuContent align={compact ? 'end' : 'start'} side={compact ? 'bottom' : 'top'}>
        <div className="acc-menu-head">
          <span className="acc-menu-name">{name}</span>
          <span className="acc-menu-line">{account.email}</span>
          {role && <span className="acc-menu-line">{role}</span>}
          {account.github && <span className="acc-menu-line">{W.githubLinked(account.github.login)}</span>}
        </div>
        <MenuSeparator />
        <MenuItem icon={Settings} onClick={() => setOpen(true)}>
          {W.settings}
        </MenuItem>
        {/* The sample team, apart from the member's real teams (the team menu lists only those); never from inside it. */}
        {tryIt && (
          <MenuItem icon={Compass} onClick={() => location.assign(DEMO_HOME)}>
            {DEMO_WORDS.tryIt}
          </MenuItem>
        )}
        <MenuItem icon={LogOut} disabled={busy} onClick={() => void signOut()}>
          {W.signOut}
        </MenuItem>
      </MenuContent>
    </Menu>
    <AccountDialog account={account} open={open} onOpenChange={setOpen} />
    </>
  );
}
