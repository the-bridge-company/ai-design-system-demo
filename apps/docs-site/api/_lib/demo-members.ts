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
import { canonicalEmail } from './canonical-email.js';
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
  { email: 'dana@acme.design', name: 'Dana', role: 'admin', lead: true },
  { email: 'ann@acme.design', name: 'Ann', role: 'edit', lead: true },
  { email: 'malik@acme.design', name: 'Malik', role: 'edit' },
  { email: 'leo@acme.design', name: 'Leo', role: 'edit' },
  { email: 'sofia@acme.design', name: 'Sofia', role: 'edit' },
];

/** Who a signed-out visitor of the sample team reads as: its lead. */
export const DEMO_VISITOR_EMAIL = 'dana@acme.design';

/** The product manager of the sample team's Account app (Settings > Products). */
export const DEMO_PM = { product: 'account', email: 'ann@acme.design' } as const;

/** The member a signed-out visitor of `team` reads as, or null: only the sample team has one. */
export const demoVisitorEmail = (team: string): string | null => (isSampleTeam(team) ? DEMO_VISITOR_EMAIL : null);

export interface SeedResult {
  added: string[];
  updated: string[];
  kept: string[];
  pm: 'set' | 'kept';
}

/**
 * Writes the sample team's members and its PM through the store Bridge uses for every team. Idempotent: a member already
 * there as said is kept as is (same version, so their sessions go on); one that differs is rewritten with its version
 * bumped, as an admin changing a role does.
 */
export async function seedDemoTeam(deps: { members: MemberStore; redis: Redis }, now: number, by = 'Bridge'): Promise<SeedResult> {
  const team = SAMPLE_REPO;
  const out: SeedResult = { added: [], updated: [], kept: [], pm: 'kept' };
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
