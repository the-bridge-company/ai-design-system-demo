// The person signed in on this browser, on the sample team (lib/demo.ts SAMPLE_REPO, Acme Design): one person keeps
// their identity everywhere, only their role changes per team. On the sample team they are one more member, an Admin
// next to its five people (lib/demo-cast.ts SAMPLE_CAST), never one of them: their name and face, their role, and
// whatever they do there is theirs. The sample's work that waits on its lead (Dana) waits on them too, since they hold
// the same seat: admin and lead, the same reviews. Reads still go through the visitor's read-only session and every
// write is refused or stays in this browser (lib/demo-in-browser.ts), as for a signed-out visitor.
// A signed-out visitor still plays one of the five people ("See it as", Dana by default).
//
// Pure: no DOM, no storage, covered by sample-member.test.ts. scripts/sample-self.ts reads who is signed in.

import type { ContributeMember } from './contribute';
import { isSampleTeam } from './demo';
import { SAMPLE_CAST, castRights } from './demo-cast';
import { memberId, SAMPLE_REVIEWS, type DesignReviewMap } from './team-reviews';
import { canonicalRepo } from './team-path';

/** Who is signed in on this browser: from their Bridge account, else their GitHub sign-in. */
export interface SampleSelf {
  name: string;
  /** Their account's email; null for a GitHub sign-in alone. */
  email: string | null;
  /** Their GitHub login, when they have one (a GitHub sign-in, or an account with GitHub linked). */
  login: string | null;
  /** Their GitHub photo, when GitHub gave one. */
  avatar: string | null;
}

/** The role every signed-in person has on the sample team. */
export const SAMPLE_SELF_ROLE = 'admin' as const;

/** Where this browser keeps who its Bridge account is (name, email, GitHub login), for the sample team's first paint. */
export const SAMPLE_SELF_KEY = 'bridge.account.self';

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** The person as kept under SAMPLE_SELF_KEY, or null when it says nobody. */
export function parseSampleSelf(v: unknown): SampleSelf | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const email = text(o.email).includes('@') ? text(o.email) : null;
  const login = text(o.login) || null;
  const name = text(o.name) || email?.split('@')[0] || login || '';
  if (!name || (!email && !login)) return null;
  return { name, email, login, avatar: text(o.avatar) || null };
}

/** A Bridge account as the sample team knows it. */
export const selfOfAccount = (a: { name: string | null; email: string; github: { login: string } | null }): SampleSelf =>
  parseSampleSelf({ name: a.name, email: a.email, login: a.github?.login ?? null }) ?? { name: a.email, email: a.email, login: null, avatar: null };

/** A GitHub sign-in as the sample team knows it: the profile name, else the login. */
export const selfOfGitHub = (v: { login: string; name?: string | null; avatar_url?: string | null }): SampleSelf | null => parseSampleSelf({ name: v.name || v.login, login: v.login, avatar: v.avatar_url });

const noReply = (login: string) => `${login}@users.noreply.github.com`;

/**
 * How a member's menu names their address: their email, or "@login" for a person signed in with GitHub alone (never
 * the no-reply address that stands for it).
 */
export const memberContact = (m: Pick<ContributeMember, 'email' | 'self'>): string => (m.self?.login && m.email === noReply(m.self.login) ? `@${m.self.login}` : m.email);

/** The sample team's lead (Dana): the seat a signed-in person shares. */
const lead = () => SAMPLE_CAST.find((p) => p.via.kind === 'email' && p.via.lead)!;

/**
 * The member a signed-in person reads as on the sample team, from the visitor's session the server gave (`server`):
 * themselves, Admin, with the lead's review rights, so what waits on the lead waits on them. No member reference: none
 * of the sample's own work reads as theirs. Only a visitor's session is ever replaced, and only for someone signed in
 * (`self`); anyone else keeps `server`. Still a visitor: the banner stays, writes are refused or stay in this browser.
 */
export function sampleSelfMember(server: ContributeMember | null, self: SampleSelf | null, map: DesignReviewMap = SAMPLE_REVIEWS): ContributeMember | null {
  if (!server?.visitor || !self) return server;
  const v = lead().via;
  const rights = v.kind === 'email' ? castRights(v, map) : {};
  // A GitHub sign-in alone has no email: GitHub's own no-reply address stands for it (memberContact shows the login).
  const email = self.email ?? noReply(self.login ?? '');
  return { email, name: self.name, role: SAMPLE_SELF_ROLE, ...rights, visitor: true, self: { login: self.login, avatar: self.avatar } };
}

/**
 * The review ids a member holds besides their own (lib/team-reviews viewerIds): on the sample team, the signed-in
 * person holds the lead's seat, so a review asked of the lead is asked of them too. Nothing for anyone else.
 */
export const sharedSeatIds = (m: Pick<ContributeMember, 'self'> | null | undefined): string[] => {
  const v = lead().via;
  return m?.self && v.kind === 'email' ? [memberId(v.ref)] : [];
};

/** The role of the signed-in person on `repo` when it is the sample team ("admin"), else null. */
export const sampleRoleOf = (repo: string | null | undefined, signedIn: boolean): typeof SAMPLE_SELF_ROLE | null => (signedIn && isSampleTeam(repo) ? SAMPLE_SELF_ROLE : null);

/**
 * The team switcher's "Your teams" with the sample team in it: for someone signed in who opened it in this browser (it
 * is in `recent`, or they are on it), it is one of their teams, Admin, never a recent team. It sits last, after their
 * real teams in the order the switcher gives them (the team you are on first), so the menu reads the same from any of
 * their teams apart from the check. Returns the list of team keys with the sample team placed, or `rows` as given.
 */
export function withSampleTeam<T extends { key: string }>(rows: readonly T[], x: { signedIn: boolean; here: string | null; recent: readonly string[]; row: (team: string, current: boolean) => T }): T[] {
  const sample = (r: string) => isSampleTeam(canonicalRepo(r));
  const kept = rows.filter((r) => !sample(r.key));
  if (!x.signedIn) return [...rows];
  const on = sample(x.here ?? '');
  const opened = on || x.recent.some(sample);
  if (!opened) return kept;
  const team = on ? x.here! : x.recent.find(sample)!;
  return [...kept, x.row(team, on)];
}
