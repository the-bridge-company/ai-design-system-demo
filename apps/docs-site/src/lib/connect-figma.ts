// "Sign in with Bridge" from the Figma plugin, the Studio side (/studio/connect-figma/?code=…, api/plugin-link): which
// step the person is at, and the words. Pure, covered by connect-figma.test.ts. The page is ConnectFigma.tsx.

import type { Account, AccountTeam } from './account';

export const LINK_API = '/api/plugin-link';
export const CODE_PARAM = 'code';
const CODE = /^[A-Z2-7]{10}$/;

/** The code in the address, or null when there is none or it is not one of ours. */
export function codeFrom(search: string): string | null {
  const c = new URLSearchParams(search).get(CODE_PARAM)?.trim().toUpperCase() ?? '';
  return CODE.test(c) ? c : null;
}

export type ConnectStep =
  | { kind: 'no-code' }
  | { kind: 'unreachable' }
  | { kind: 'signin'; githubHere: boolean }
  | { kind: 'github' }
  | { kind: 'no-teams' }
  | { kind: 'pick'; teams: PickTeam[] };

/** A team to pick: its repository and the name it goes by. */
export type PickTeam = Pick<AccountTeam, 'repo'> & { name: string | null };

/**
 * Where the person is: no code, not signed in, no GitHub sign-in in this browser, no team, or pick a team. `teams` is
 * the list the team switcher shows (scripts/pickable-teams.ts: the account's teams, the site's own design system when
 * GitHub lets this person push to it, the teams this browser opened); without it, the account's teams.
 */
export function connectStep(
  code: string | null,
  account: Account | null,
  hasGitHub: boolean,
  pickable?: readonly PickTeam[],
  seen: { reachable?: boolean; githubHere?: boolean } = {},
): ConnectStep {
  if (!code) return { kind: 'no-code' };
  // Bridge did not answer: never ask someone who may well be signed in to sign in again.
  if (seen.reachable === false) return { kind: 'unreachable' };
  // Signed in to GitHub in this browser (the Studio side nav shows that GitHub account) but not to Bridge: say which.
  if (!account) return { kind: 'signin', githubHere: seen.githubHere === true };
  if (!hasGitHub) return { kind: 'github' };
  const teams = [...(pickable ?? account.teams)].sort((a, b) => (a.name ?? a.repo).localeCompare(b.name ?? b.repo));
  return teams.length ? { kind: 'pick', teams } : { kind: 'no-teams' };
}

export const teamLabel = (t: Pick<AccountTeam, 'name' | 'repo'>) => t.name?.trim() || t.repo.split('/')[1] || t.repo;

/** The approve answers that end this sign-in (api/plugin-link): the plugin has to start a new one. */
export type EndedReason = 'expired' | 'used';

/** An approve refusal (api/plugin-link `error`) that ends this code for good, or null when trying again can work. */
export function endedBy(status: number, error: unknown): EndedReason | null {
  if (error === 'used' || status === 409) return 'used';
  if (error === 'expired' || error === 'bad_request' || status === 410) return 'expired';
  return null;
}

/** Who is signed in, for the quiet line under the action: the account's name, else its email. */
export const signedInName = (a: Pick<Account, 'name' | 'email'>) => a.name?.trim() || a.email;

export const CONNECT_WORDS = {
  title: 'Connect Figma',
  lede: 'Pick the team whose design system this Figma file uses. Bridge connects the plugin, nothing else changes.',
  ledeOne: 'DS Bridge in Figma will use this team\'s design system. Bridge connects the plugin, nothing else changes.',
  noCodeTitle: 'Start from Figma',
  noCode: 'Open this page from the DS Bridge plugin in Figma: Sign in with Bridge.',
  signin: 'Sign in to Bridge first. Bridge brings you back to this step afterwards.',
  signinGitHubHere: 'GitHub is connected in this browser, but you are not signed in to your Bridge account. Sign in to Bridge, then Bridge brings you back here.',
  unreachable: 'Bridge could not check your sign-in. Reload this page in a minute.',
  reload: 'Reload',
  signinAction: 'Sign in',
  github: 'The plugin works on your design system through GitHub. Connect your GitHub account once, then pick the team.',
  githubAction: 'Connect GitHub',
  noTeams: 'You are not in a team yet. Ask your design system owner to invite you, then open this page again from Figma.',
  teamLabel: 'Team',
  connect: 'Connect Figma',
  connecting: 'Connecting',
  signedInAs: (who: string) => `Signed in as ${who}.`,
  otherAccount: 'Use another account',
  doneTitle: 'Figma is connected',
  done: (team: string) => `Go back to Figma: DS Bridge now uses the ${team} design system.`,
  openStudio: 'Open Studio',
  expiredTitle: 'This sign-in expired',
  usedTitle: 'This sign-in was already used',
  startAgain: 'Start again from the DS Bridge plugin in Figma: Sign in with Bridge.',
  failed: 'Bridge could not connect Figma. Try again in a minute.',
} as const;
