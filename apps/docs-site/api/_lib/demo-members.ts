// The people of the sample team (src/lib/demo.ts SAMPLE_REPO, "Acme Design"), as real email members of it: stored where
// Bridge keeps the email members of any team (api/_lib/members.ts), and the product manager of its Account app where
// Settings > Products keeps it (api/_lib/product-pm.ts). Nothing else in Bridge knows them: every screen reads them
// from the store, as on any team. Its developer is not one of them: he joins with GitHub only (RETIRED_DEMO_MEMBERS).
//
// A signed-out visitor of the sample team reads as Dana, its lead (api/contribute: a read-only session as that member,
// every write refused by demoWriteRefusal). Written by seedDemoTeam, idempotent: run it again and it changes only what
// differs (api/contribute action `seed-demo`, scripts/seed-demo-members.mjs).
import type { MemberStore, EmailMember, EmailRole } from './members.js';
import { pmOf, setPm } from './product-pm.js';
import type { Redis } from './redis.js';
import { canonicalEmail, emailSpellings, sameEmail } from './canonical-email.js';
import { branchKey, issueKey, mineKey, scan } from './former-member.js';
import { globEscape } from './redis.js';
import { SAMPLE_REPO, isSampleTeam } from '../../src/lib/demo.js';

export interface DemoMember {
  email: string;
  name: string;
  role: EmailRole;
  /** Asked to review explorations (a design lead). */
  lead?: boolean;
}

/**
 * Dana leads the design system (admin and design lead), Ann reviews design (design lead), Leo and Sofia design (can
 * edit). The team's developer, Malik, is not an email member: like a real team's developer he joins with GitHub only
 * (the account acme-malik, a write collaborator of the sample team), so Settings > Members lists him from GitHub and
 * his pull requests and reviews come from that account (RETIRED_DEMO_MEMBERS).
 */
export const DEMO_MEMBERS: readonly DemoMember[] = [
  { email: 'dana@acme.example', name: 'Dana', role: 'admin', lead: true },
  { email: 'ann@acme.example', name: 'Ann', role: 'edit', lead: true },
  { email: 'leo@acme.example', name: 'Leo', role: 'edit' },
  { email: 'sofia@acme.example', name: 'Sofia', role: 'edit' },
];

/** Who a signed-out visitor of the sample team reads as: its lead. */
export const DEMO_VISITOR_EMAIL = 'dana@acme.example';

/** The product manager of the sample team's Account app (Settings > Products). */
export const DEMO_PM = { product: 'prints', email: 'ann@acme.example' } as const;

/** The member a signed-out visitor of `team` reads as, or null: only the sample team has one. */
export const demoVisitorEmail = (team: string): string | null => (isSampleTeam(team) ? DEMO_VISITOR_EMAIL : null);

export interface SeedResult {
  added: string[];
  updated: string[];
  kept: string[];
  pm: 'set' | 'kept';
  /** Members moved from their old acme.design address (migrateLegacyDemo). */
  migrated: string[];
  /** Keys that held an old or retired address and are gone: notifications kept or due, sign-in counts, team lists. */
  forgot: number;
  /** Members the sample team no longer lists, removed (RETIRED_DEMO_MEMBERS). */
  retired: string[];
}

/**
 * People the sample team once had as email members and no longer lists, by name and address. Only these are ever
 * removed by seedDemoTeam: a member the list does not name stays, whoever added them.
 *
 * Malik is the team's developer: he now joins with GitHub only (acme-malik), as a real team's developer does, so his
 * email member row would list him twice in Settings > Members.
 */
export const RETIRED_DEMO_MEMBERS: readonly { email: string; name: string; github: string }[] = [{ email: 'malik@acme.example', name: 'Malik', github: 'acme-malik' }];

/**
 * The domain the sample team's people first had: acme.design is a real, registered domain, so Bridge could have mailed
 * strangers there. They now live under acme.example (RFC 2606, never routed); seedDemoTeam moves what the old one held.
 */
export const LEGACY_DEMO_DOMAIN = 'acme.design';
export const DEMO_DOMAIN = 'acme.example';
export const legacyDemoEmail = (email: string): string => email.replace(new RegExp(`@${DEMO_DOMAIN.replace('.', '\\.')}$`), `@${LEGACY_DEMO_DOMAIN}`);

const OWNED_S = 365 * 24 * 60 * 60;

/**
 * Moves each sample team member stored under the old address to the new one: the same name, role, lead and who added
 * them (their version moves, so a session of the old address ends); what they own through Bridge (branches, issues)
 * becomes the new address's; every key that only served the old one goes (its member record and team list, notifications
 * kept, due or sent within the hour, an opt-out, sign-in counts). Idempotent: nothing left under the old address, nothing
 * done. The product manager is set again by seedDemoTeam, which compares the address.
 */
export async function migrateLegacyDemo(deps: { members: MemberStore; redis: Redis }): Promise<{ migrated: string[]; forgot: number }> {
  const team = SAMPLE_REPO;
  const out = { migrated: [] as string[], forgot: 0 };
  for (const d of DEMO_MEMBERS) {
    const old = legacyDemoEmail(d.email);
    if (old === d.email) continue;
    const was = await deps.members.get(team, old);
    if (was) {
      const now = await deps.members.get(team, d.email);
      if (!now) await deps.members.put(team, { ...was, email: d.email, version: was.version + 1 });
      await deps.members.remove(team, old);
      out.migrated.push(d.email);
    }
    out.forgot += await forgetAddress(deps.redis, old, d.email);
  }
  return out;
}

/**
 * Forgets what Bridge keeps for an address of the sample team's people outside its member record: what it owns through
 * Bridge (branches, issues) moves to `to`, or is dropped when `to` is null (the item is then nobody's in Bridge, as one
 * filed from GitHub); every key that only served it goes (notifications kept, due or sent within the hour, an opt-out,
 * its team list, sign-in counts). Says how many keys went. Nothing on GitHub changes.
 */
async function forgetAddress(redis: Redis, old: string, to: string | null): Promise<number> {
  let forgot = 0;
  const e = globEscape(canonicalEmail(old));
  for (const key of await scan(redis, `bridge:contrib:mine:*:${e}`)) {
    const repo = key.slice('bridge:contrib:mine:'.length, key.length - canonicalEmail(old).length - 1);
    const raw = await redis.cmd('SMEMBERS', key);
    const items = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
    const owned = items.map((it) => (it.startsWith('b:') ? branchKey(repo, it.slice(2)) : it.startsWith('i:') ? issueKey(repo, it.slice(2)) : null));
    const holders = owned.length ? await redis.pipe(owned.map((k) => ['GET', k ?? 'bridge:contrib:none'])) : [];
    const held = owned.filter((k, i): k is string => k !== null && sameEmail(holders[i], old));
    const moves = to ? held.map((k) => ['SET', k, to, 'EX', OWNED_S]) : held.map((k) => ['DEL', k]);
    await redis.pipe([...moves, ...(to && items.length ? [['SADD', mineKey(repo, to), ...items], ['EXPIRE', mineKey(repo, to), OWNED_S]] : []), ['DEL', key]]);
    forgot++;
  }
  const gone = [
    ...emailSpellings(old).flatMap((s) => [`bridge:notify:digest:${s}`, `bridge:notify:off:${s}`, `bridge:account:teams:${s}`]),
    ...(await scan(redis, `bridge:notify:soon:${e}:*`)),
    ...(await scan(redis, `bridge:contrib:count:*:${e}:*`)),
  ];
  const res = await redis.pipe([...gone.map((k) => ['DEL', k]), ...emailSpellings(old).map((s) => ['ZREM', 'bridge:notify:due', s])]);
  return forgot + res.filter((n) => Number(n) > 0).length;
}

/**
 * Removes the people the sample team no longer lists (RETIRED_DEMO_MEMBERS), under their address and the old acme.design
 * one, and forgets what Bridge kept for them (forgetAddress, ownership dropped). Idempotent: nothing stored, nothing done.
 */
export async function retireDemoMembers(deps: { members: MemberStore; redis: Redis }): Promise<{ retired: string[]; forgot: number }> {
  const team = SAMPLE_REPO;
  const out = { retired: [] as string[], forgot: 0 };
  for (const r of RETIRED_DEMO_MEMBERS) {
    for (const address of new Set([r.email, legacyDemoEmail(r.email)])) {
      if (await deps.members.get(team, address)) {
        await deps.members.remove(team, address);
        if (!out.retired.includes(r.email)) out.retired.push(r.email);
      }
      out.forgot += await forgetAddress(deps.redis, address, null);
    }
  }
  return out;
}

/**
 * Writes the sample team's members and its PM through the store Bridge uses for every team, and removes the ones it no
 * longer lists (retireDemoMembers). Idempotent: a member already there as said is kept as is (same version, so their
 * sessions go on); one that differs is rewritten with its version bumped, as an admin changing a role does.
 */
export async function seedDemoTeam(deps: { members: MemberStore; redis: Redis }, now: number, by = 'Bridge'): Promise<SeedResult> {
  const team = SAMPLE_REPO;
  const moved = await migrateLegacyDemo(deps);
  const gone = await retireDemoMembers(deps);
  const out: SeedResult = { added: [], updated: [], kept: [], pm: 'kept', migrated: moved.migrated, forgot: moved.forgot + gone.forgot, retired: gone.retired };
  const at = new Date(now).toISOString();
  for (const d of DEMO_MEMBERS) {
    const was = await deps.members.get(team, d.email);
    const same = was && was.name === d.name && was.role === d.role && Boolean(was.lead) === Boolean(d.lead);
    if (same) {
      out.kept.push(d.email);
      continue;
    }
    const m: EmailMember = { email: d.email, name: d.name, role: d.role, version: was ? was.version + 1 : 1, ...(d.lead ? { lead: true } : {}), addedBy: was?.addedBy ?? by, at: was?.at ?? at };
    await deps.members.put(team, m);
    (was ? out.updated : out.added).push(d.email);
  }
  const pm = DEMO_MEMBERS.find((m) => m.email === DEMO_PM.email)!;
  const was = await pmOf(deps.redis, team, DEMO_PM.product);
  if (!was?.email || canonicalEmail(was.email) !== canonicalEmail(pm.email) || was.name !== pm.name) {
    await setPm(deps.redis, team, DEMO_PM.product, { email: pm.email, name: pm.name });
    out.pm = 'set';
  }
  return out;
}
