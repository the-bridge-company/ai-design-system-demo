// The people of the sample team (src/lib/demo.ts SAMPLE_REPO, "Acme Design"), as real email members of it: stored where
// Bridge keeps the email members of any team (api/_lib/members.ts), and the product manager of its Account app where
// Settings > Products keeps it (api/_lib/product-pm.ts). Nothing else in Bridge knows them: every screen reads them
// from the store, as on any team.
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
 * Dana leads the design system (admin and design lead), Ann reviews design (design lead), Malik reviews code (his
 * reviews happen on GitHub, like any developer's: as an email member he can edit), Leo and Sofia design (can edit).
 */
export const DEMO_MEMBERS: readonly DemoMember[] = [
  { email: 'dana@acme.example', name: 'Dana', role: 'admin', lead: true },
  { email: 'ann@acme.example', name: 'Ann', role: 'edit', lead: true },
  { email: 'malik@acme.example', name: 'Malik', role: 'edit' },
  { email: 'leo@acme.example', name: 'Leo', role: 'edit' },
  { email: 'sofia@acme.example', name: 'Sofia', role: 'edit' },
];

/** Who a signed-out visitor of the sample team reads as: its lead. */
export const DEMO_VISITOR_EMAIL = 'dana@acme.example';

/** The product manager of the sample team's Account app (Settings > Products). */
export const DEMO_PM = { product: 'account', email: 'ann@acme.example' } as const;

/** The member a signed-out visitor of `team` reads as, or null: only the sample team has one. */
export const demoVisitorEmail = (team: string): string | null => (isSampleTeam(team) ? DEMO_VISITOR_EMAIL : null);

export interface SeedResult {
  added: string[];
  updated: string[];
  kept: string[];
  pm: 'set' | 'kept';
  /** Members moved from their old acme.design address (migrateLegacyDemo). */
  migrated: string[];
  /** Keys that held an old address and are gone: notifications kept or due, sign-in counts, team lists. */
  forgot: number;
}

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
    // What they own through Bridge, on the team and its products: the new address owns it.
    const e = globEscape(canonicalEmail(old));
    for (const key of await scan(deps.redis, `bridge:contrib:mine:*:${e}`)) {
      const repo = key.slice('bridge:contrib:mine:'.length, key.length - canonicalEmail(old).length - 1);
      const raw = await deps.redis.cmd('SMEMBERS', key);
      const items = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
      const owned = items.map((it) => (it.startsWith('b:') ? branchKey(repo, it.slice(2)) : it.startsWith('i:') ? issueKey(repo, it.slice(2)) : null));
      const holders = owned.length ? await deps.redis.pipe(owned.map((k) => ['GET', k ?? 'bridge:contrib:none'])) : [];
      const moves = owned.filter((k, i): k is string => k !== null && sameEmail(holders[i], old)).map((k) => ['SET', k, d.email, 'EX', OWNED_S]);
      await deps.redis.pipe([...moves, ...(items.length ? [['SADD', mineKey(repo, d.email), ...items], ['EXPIRE', mineKey(repo, d.email), OWNED_S]] : []), ['DEL', key]]);
      out.forgot++;
    }
    // Keys that only served the old address.
    const gone = [
      ...emailSpellings(old).flatMap((s) => [`bridge:notify:digest:${s}`, `bridge:notify:off:${s}`, `bridge:account:teams:${s}`]),
      ...(await scan(deps.redis, `bridge:notify:soon:${e}:*`)),
      ...(await scan(deps.redis, `bridge:contrib:count:*:${e}:*`)),
    ];
    const res = await deps.redis.pipe([...gone.map((k) => ['DEL', k]), ...emailSpellings(old).map((s) => ['ZREM', 'bridge:notify:due', s])]);
    out.forgot += res.filter((n) => Number(n) > 0).length;
  }
  return out;
}

/**
 * Writes the sample team's members and its PM through the store Bridge uses for every team. Idempotent: a member already
 * there as said is kept as is (same version, so their sessions go on); one that differs is rewritten with its version
 * bumped, as an admin changing a role does.
 */
export async function seedDemoTeam(deps: { members: MemberStore; redis: Redis }, now: number, by = 'Bridge'): Promise<SeedResult> {
  const team = SAMPLE_REPO;
  const moved = await migrateLegacyDemo(deps);
  const out: SeedResult = { added: [], updated: [], kept: [], pm: 'kept', ...moved };
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
