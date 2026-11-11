// "See it as": the people of the sample team (lib/demo.ts SAMPLE_REPO, Acme Design), and which of them a visitor plays.
// Pure: no DOM, no storage, covered by demo-cast.test.ts. scripts/demo-cast.ts reads the choice in the browser.
//
// A signed-out visitor reads the sample team through one read-only session (api/contribute): every write is refused
// there, whoever they play. The page asks for that session as the person picked (?as=, api/_lib/demo-members.ts
// demoVisitorPick), so "mine" and the build check's rights are theirs; until the server answers, and for the developer,
// who has no email membership and reads through the lead's session, the page plays them itself: the member every Studio
// script asks for (scripts/contribute-session.ts contributorFor), or the GitHub viewer and access
// (scripts/github-session.ts). Every screen then runs its own role rules on that person, the same code as on any team.
// Never on a real team, never for a real member, never a sign-in: the server still refuses every write.

import type { ContributeMember } from './contribute';
import type { RepoAccess } from './access';
import { decidesOnExplorations, askedToReview, type ReviewMode } from '../../api/_lib/review-mode';

/** The five people, by the short name the address and the menu use (?as=sofia). */
export type CastKey = 'dana' | 'sofia' | 'leo' | 'malik' | 'ann';

export interface CastPerson {
  key: CastKey;
  name: string;
  /** What they do, in plain words, under their name in the menu. */
  job: string;
  /**
   * How they are on the team. `email`: an email member (api/_lib/demo-members.ts DEMO_MEMBERS), with the role, lead
   * flag and member reference the server gives them. `github`: a GitHub collaborator with write access, no email
   * member (RETIRED_DEMO_MEMBERS: the developer joins with GitHub only).
   */
  via: { kind: 'email'; email: string; role: 'admin' | 'edit'; lead: boolean; ref: string } | { kind: 'github'; login: string };
}

/**
 * The sample team as api/_lib/demo-members.ts seeds it (demo-cast.test.ts checks every name, role, lead and reference
 * against it): Dana leads and runs the team, Sofia and Leo design, Malik builds, Ann is the product manager of Acme
 * Prints and also reviews designs. Fictional people, at addresses that never route (acme.example).
 */
export const SAMPLE_CAST: readonly CastPerson[] = [
  { key: 'dana', name: 'Dana', job: 'Design lead, runs the team', via: { kind: 'email', email: 'dana@acme.example', role: 'admin', lead: true, ref: 'a399f73add3dbb2d' } },
  { key: 'sofia', name: 'Sofia', job: 'Designer', via: { kind: 'email', email: 'sofia@acme.example', role: 'edit', lead: false, ref: '0406ec723c59bb8d' } },
  { key: 'leo', name: 'Leo', job: 'Designer', via: { kind: 'email', email: 'leo@acme.example', role: 'edit', lead: false, ref: 'af419771c6f4d96f' } },
  { key: 'malik', name: 'Malik', job: 'Developer', via: { kind: 'github', login: 'acme-malik' } },
  { key: 'ann', name: 'Ann', job: 'Product manager, also reviews designs', via: { kind: 'email', email: 'ann@acme.example', role: 'edit', lead: true, ref: 'b9cc21753b627efd' } },
];

/** Who the page plays when nobody picked: the one the server's visitor session reads as. */
export const DEFAULT_CAST: CastKey = 'dana';

/** The address parameter that picks someone (?as=sofia), so a screenshot can be scripted. */
export const CAST_PARAM = 'as';

/** Where this browser keeps the pick (localStorage). Only the sample team reads it. */
export const CAST_STORAGE_KEY = 'bridge.demo.as';

export const CAST_WORDS = {
  /** The switch's label, before the person it shows. */
  seeItAs: 'See it as',
  /** The menu's heading. */
  menuTitle: 'See Acme Design as',
  /** Under the list: what changes, and what does not. */
  menuNote: 'Studio shows what this person sees and can do. Nothing is sent.',
} as const;

/** The person of `key` (any case, spaces around), or null when it names nobody of the sample team. */
export function castPerson(key: unknown): CastPerson | null {
  if (typeof key !== 'string') return null;
  const k = key.trim().toLowerCase();
  return SAMPLE_CAST.find((p) => p.key === k) ?? null;
}

/**
 * Who the page plays: the address first (?as=, so a link or a script shows one person), then this browser's pick,
 * else Dana. Anything that names nobody is ignored.
 */
export function chooseCast(x: { query?: string | null; stored?: string | null }): CastPerson {
  return castPerson(x.query) ?? castPerson(x.stored) ?? castPerson(DEFAULT_CAST)!;
}

/**
 * The member the page reads as on the sample team, from the member the server's visitor session gave (`server`) and
 * the person played. Only a visitor's session is ever replaced (`server.visitor`): a real member of the sample team, or
 * anyone else, stays who they are. An email member reads with their own role, lead flag, review right and reference,
 * by the same rule as the server's (api/_lib/review-mode.ts); the developer, who has no email membership, reads as
 * nobody here (null) and the GitHub side plays him (castGitHub). Still a visitor: the banner stays, writes are refused.
 */
export function playedMember(server: ContributeMember | null, person: CastPerson, mode: ReviewMode = 'one'): ContributeMember | null {
  if (!server?.visitor) return server;
  const v = person.via;
  if (v.kind === 'github') return null;
  if (v.email === server.email.toLowerCase()) return server;
  const who = { role: v.role, lead: v.lead };
  return {
    email: v.email,
    name: person.name,
    role: v.role,
    ref: v.ref,
    ...(askedToReview(who, mode) ? { lead: true } : {}),
    ...(decidesOnExplorations(who, mode) ? { decides: true } : {}),
    visitor: true,
  };
}

/** The GitHub person played on the sample team (the developer), as Studio's viewer knows a GitHub account; else null. */
export function castGitHub(person: CastPerson): { login: string; name: string; avatar_url: string } | null {
  const v = person.via;
  return v.kind === 'github' ? { login: v.login, name: person.name, avatar_url: `https://avatars.githubusercontent.com/${encodeURIComponent(v.login)}` } : null;
}

/** The face seed a person is drawn with everywhere in Studio (lib/people.ts emailMemberFace for an email member). */
export const castFaceLogin = (person: CastPerson): string => (person.via.kind === 'github' ? person.via.login : `~${person.key}`);

/**
 * The played developer's access to the sample team: what the team's collaborators list (GET /api/contribute?members=1,
 * read from GitHub) says of his account. Write access when GitHub gives him push, else read; never admin, never an
 * email contributor (he reviews as a GitHub account does).
 */
export function castAccess(collaborators: readonly { login: string; permissions?: { push?: boolean } }[], login: string): RepoAccess {
  const push = collaborators.find((c) => c.login.toLowerCase() === login.toLowerCase())?.permissions?.push === true;
  return push ? { state: 'writer', write: true, admin: false, reach: true } : { state: 'reader', write: false, admin: false, reach: true };
}
