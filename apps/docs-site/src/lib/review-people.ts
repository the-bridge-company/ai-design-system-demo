// Settings > Review rules: the people a team's review rules name, in one pure place (covered by review-people.test.ts).
//
// The rule: a team's Settings only ever name that team's own people.
//   - Owner entries come from the team's own bridge.config.json (governance.owners, rights, override).
//   - On the sample team (lib/demo.ts isSampleTeam), its people are its cast (lib/demo-cast.ts): an owner entry that
//     is not a cast account (the real account that hosts the sample repository) is never named, the same rule as
//     its Members list (onlySamplePeople). Nobody else's people are ever filled in: no fallback to another team,
//     to Bridge's own owners, or to whoever is signed in.
//   - A right held by the design owners is also held by the team's design leads (email members made Design lead,
//     api/_lib/review-mode.ts: "the design leads approve, and the design owners of bridge.config.json"). On the
//     sample team those are read from the cast, so a signed-out visitor reads the same names as a member.
import { parseOwnerEntry, type OwnerGroup } from '@bridge-ds/core';
import { isSampleTeam } from './demo';
import { SAMPLE_CAST, castFaceLogin, isCastLogin } from './demo-cast';
import { emailMemberFace, loginKey } from './people';

/** A person or a GitHub team, as Settings names them. */
export interface RulePerson {
  key: string;
  name: string;
  /** The face seed (a GitHub login, or `~name` for an email member). Absent for a GitHub team. */
  face?: string;
  /** A GitHub account: its photo may be shown. */
  github?: boolean;
}

/** An email member as the members list knows them. */
export interface LeadLike {
  name: string;
  email?: string;
  login: string;
  lead?: boolean;
  via?: 'email';
}

/** Whether an owner entry may be named on this team's Settings. Teams and people of any real team: yes. */
export function isTeamPerson(repo: string | null | undefined, entry: string): boolean {
  const e = parseOwnerEntry(entry);
  if (!e) return false;
  if (!isSampleTeam(repo)) return true;
  return e.kind === 'person' && isCastLogin(e.login);
}

/** The owner entries this team's Settings may name (isTeamPerson), in order, without duplicates. */
export function teamEntries(repo: string | null | undefined, entries: readonly string[]): string[] {
  const seen = new Set<string>();
  return entries.filter((x) => {
    const k = loginKey(x);
    if (seen.has(k) || !isTeamPerson(repo, x)) return false;
    seen.add(k);
    return true;
  });
}

/** The design leads of the team: the sample team's from its cast, any other team's from its email members. */
export function designLeads(repo: string | null | undefined, members: readonly LeadLike[] | null | undefined): RulePerson[] {
  if (isSampleTeam(repo)) {
    return SAMPLE_CAST.filter((p) => p.via.kind === 'email' && p.via.lead).map((p) => ({ key: `lead:${p.key}`, name: p.name, face: castFaceLogin(p) }));
  }
  return (members ?? [])
    .filter((m) => m.via === 'email' && m.lead)
    .map((m) => ({ key: `lead:${(m.email ?? m.login).toLowerCase()}`, name: m.name, face: emailMemberFace(m.name, m.email ?? m.login) }));
}

/**
 * Who a right names on Settings: the team's owner entries holding it (teamEntries) by name, then, for a right the
 * design owners hold, the design leads. One name once.
 */
export function rightPeople(x: {
  repo: string | null | undefined;
  /** Owner entries holding the right (core holdersOf), as the config lists them. */
  entries: readonly string[];
  /** The owner groups holding the right; null when nobody is singled out. */
  groups: readonly OwnerGroup[] | null;
  leads: readonly RulePerson[];
  nameOf: (entry: string) => RulePerson | null;
}): RulePerson[] {
  const out: RulePerson[] = [];
  const names = new Set<string>();
  const add = (p: RulePerson | null) => {
    if (!p || names.has(p.name.toLowerCase())) return;
    names.add(p.name.toLowerCase());
    out.push(p);
  };
  for (const e of teamEntries(x.repo, x.entries)) add(x.nameOf(e));
  if (x.groups?.includes('design')) for (const l of x.leads) add(l);
  return out;
}

/**
 * The only owner of the team (core soloOwnerOf) when they are one of its people, else null: on the sample team, the
 * account that hosts it is never "the only owner".
 */
export function teamSoloOwner(repo: string | null | undefined, login: string | null | undefined): string | null {
  return login && isTeamPerson(repo, login) ? login : null;
}
