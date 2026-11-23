// "People" on the founder's queue (/admin/access/, api/access action `people`): every Bridge account and every team,
// read straight from storage. Admin only (api/access checks the session first). Never a session, a code, a hash or a
// secret: the account record gives its name, email, GitHub login, creation date and teams, nothing else leaves here.
//
// Reads:
//   bridge:account:<email>             the accounts (SCAN, never KEYS). Every other key under bridge:account: has a
//                                      second colon (code:, codefor:, codetries:, count:, gh:, teams:, ghteams:, canon:,
//                                      merge-lock:...) and an email never holds one: those are left out.
//   bridge:account:teams:<email>       the teams of each account, with the role of its member record
//   bridge:account:ghteams:<email>     the repositories GitHub said the account was admin or editor of
//   bridge:members:<repo>              the email members of each team (their count)
//   bridge:team:rec:<id>               a team made in Bridge: its name and creation date
//   bridge:team:name:<repo>            the team's name as last read
// At most PEOPLE_CAP accounts are read; `truncated` says when there were more. Pure but for the reads.

import type { Redis } from './redis.js';
import { canonicalEmail } from './canonical-email.js';
import { accountTeamsKey, memberKey } from './members.js';
import { githubTeamsKey, parseGithubTeams } from './account.js';
import { getTeamNames, type TeamRecord } from './teams.js';
import { canonicalRepo, isTeamKey } from '../../src/lib/team-path.js';
import { teamDisplayName } from '../../src/lib/demo.js';
import type { PeopleAccount, PeopleList, PeopleTeam, PeopleRole } from '../../src/lib/access-request.js';

export const PEOPLE_CAP = 2000;
const BATCH = 100;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** An account record's key: bridge:account:<email>, no sub-key. */
export const isAccountRecordKey = (k: string): boolean => /^bridge:account:[^:]+@[^:]+$/.test(k);

async function scan(redis: Redis, pattern: string): Promise<string[]> {
  const out = new Set<string>();
  let cursor = '0';
  for (let i = 0; i < 1000; i++) {
    const r = (await redis.cmd('SCAN', cursor, 'MATCH', pattern, 'COUNT', 500)) as [string | number, string[]] | null;
    if (!Array.isArray(r)) break;
    for (const k of r[1] ?? []) out.add(k);
    cursor = String(r[0]);
    if (cursor === '0') break;
  }
  return [...out];
}

async function inBatches<T>(items: readonly T[], read: (batch: T[]) => Promise<unknown[]>): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let i = 0; i < items.length; i += BATCH) out.push(...(await read(items.slice(i, i + BATCH))));
  return out;
}

const json = (raw: unknown): Record<string, unknown> | null => {
  if (typeof raw !== 'string') return null;
  try {
    const v = JSON.parse(raw) as unknown;
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const isoOrNull = (v: unknown): string | null => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const RANK: Record<PeopleRole, number> = { view: 0, edit: 1, admin: 2 };

/** Every account (newest first) and every team (newest first, then by name), with the summary counts. */
export async function listPeople(redis: Redis, now: number): Promise<PeopleList> {
  const keys = (await scan(redis, 'bridge:account:*')).filter(isAccountRecordKey).sort();
  const truncated = keys.length > PEOPLE_CAP;
  const read = keys.slice(0, PEOPLE_CAP);
  const raw = await inBatches(read, async (b) => ((await redis.cmd('MGET', ...b)) as unknown[] | null) ?? []);

  // One row per account: a record left under an older spelling of the same mailbox is the same person.
  const seen = new Set<string>();
  const people: (Omit<PeopleAccount, 'teams'> & { key: string })[] = [];
  raw.forEach((r) => {
    const a = json(r);
    if (!a || typeof a.email !== 'string' || typeof a.id !== 'string') return;
    const key = canonicalEmail(a.email);
    if (seen.has(a.id) || seen.has(key)) return;
    seen.add(a.id);
    seen.add(key);
    const gh = a.github && typeof a.github === 'object' ? (a.github as Record<string, unknown>) : null;
    people.push({
      key,
      name: typeof a.name === 'string' ? a.name.trim() : '',
      email: typeof a.displayEmail === 'string' && a.displayEmail ? a.displayEmail : a.email,
      github: gh && typeof gh.login === 'string' ? gh.login : null,
      createdAt: isoOrNull(a.createdAt),
    });
  });

  // Their teams: the email memberships (with the member record's role) and the repositories GitHub vouched for.
  const sets = await inBatches(people, (b) => redis.pipe(b.map((p) => ['SMEMBERS', accountTeamsKey(p.key)])));
  const ghRaw = await inBatches(people, async (b) => ((await redis.cmd('MGET', ...b.map((p) => githubTeamsKey(p.key)))) as unknown[] | null) ?? []);
  const pairs: { i: number; repo: string; stored: string }[] = [];
  sets.forEach((s, i) => strings(s).forEach((stored) => pairs.push({ i, repo: canonicalRepo(stored), stored })));
  const records = await inBatches(pairs, async (b) => ((await redis.cmd('MGET', ...b.map((p) => memberKey(p.stored, people[p.i]!.key)))) as unknown[] | null) ?? []);
  const roles = people.map(() => new Map<string, { role: PeopleRole; via: 'email' | 'github' }>());
  const put = (i: number, repo: string, role: PeopleRole, via: 'email' | 'github') => {
    const before = roles[i]!.get(repo);
    if (!before || RANK[role] > RANK[before.role]) roles[i]!.set(repo, { role, via });
  };
  pairs.forEach((p, j) => {
    const m = json(records[j]);
    const role = m?.role === 'admin' || m?.role === 'view' ? m.role : 'edit';
    put(p.i, p.repo, role, 'email');
  });
  ghRaw.forEach((g, i) => {
    for (const [repo, v] of Object.entries(parseGithubTeams(g))) put(i, canonicalRepo(repo), v?.role === 'admin' ? 'admin' : 'edit', 'github');
  });

  // The teams: every one an account belongs to, every one with email members, every one made in Bridge.
  const memberSets = await scan(redis, 'bridge:members:*');
  const recKeys = await scan(redis, 'bridge:team:rec:*');
  const recs = (await inBatches(recKeys, async (b) => ((await redis.cmd('MGET', ...b)) as unknown[] | null) ?? []))
    .map((r) => json(r) as Partial<TeamRecord> | null)
    .filter((r): r is Partial<TeamRecord> & { id: string } => Boolean(r && typeof r.id === 'string'));
  const recOf = new Map<string, Partial<TeamRecord>>();
  for (const r of recs) {
    recOf.set(`_team/${r.id.toLowerCase()}`, r);
    if (typeof r.repo === 'string' && r.repo) recOf.set(canonicalRepo(r.repo).toLowerCase(), r);
  }
  const memberCounts = await inBatches(memberSets, (b) => redis.pipe(b.map((k) => ['SMEMBERS', k])));
  const members = new Map<string, Set<string>>();
  const add = (repo: string, who: string) => {
    const k = repo.toLowerCase();
    if (!members.has(k)) members.set(k, new Set());
    if (who) members.get(k)!.add(canonicalEmail(who));
  };
  memberSets.forEach((k, i) => {
    const repo = canonicalRepo(k.slice('bridge:members:'.length));
    add(repo, '');
    strings(memberCounts[i]).forEach((e) => add(repo, e));
  });
  people.forEach((p, i) => roles[i]!.forEach((_, repo) => add(repo, p.key)));
  for (const r of recs) if (!r.repo) add(`_team/${r.id.toLowerCase()}`, '');

  const repos = [...members.keys()];
  const names = await getTeamNames(redis, repos);
  const nameOf = (repo: string) => recOf.get(repo)?.name?.trim() || names.get(repo)?.name || teamDisplayName(repo);
  const teams: PeopleTeam[] = repos
    .map((repo) => ({
      repo: isTeamKey(repo) ? null : repo,
      name: nameOf(repo),
      members: members.get(repo)!.size,
      createdAt: isoOrNull(recOf.get(repo)?.createdAt),
    }))
    .sort(newestFirst);

  const accounts: PeopleAccount[] = people
    .map(({ key: _k, ...p }, i) => ({
      ...p,
      teams: [...roles[i]!.entries()].map(([repo, r]) => ({ name: nameOf(repo.toLowerCase()), role: r.role, via: r.via })).sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .sort(newestFirst);

  const joinedWeek = accounts.filter((a) => a.createdAt && now - Date.parse(a.createdAt) <= WEEK_MS && Date.parse(a.createdAt) <= now).length;
  return { accounts, teams, total: keys.length, truncated, joinedWeek };
}

/** Newest first; those without a date last, by name. */
function newestFirst(a: { createdAt: string | null; name: string }, b: { createdAt: string | null; name: string }): number {
  const ta = a.createdAt ? Date.parse(a.createdAt) : -Infinity;
  const tb = b.createdAt ? Date.parse(b.createdAt) : -Infinity;
  return tb - ta || a.name.localeCompare(b.name);
}
