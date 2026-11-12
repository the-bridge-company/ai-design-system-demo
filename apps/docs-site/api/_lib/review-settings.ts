// Two reviews (docs/specs/two-reviews.md, core two-reviews.ts), on the server: who is asked what, for a team whose
// members joined by email. Settings > Reviews writes it, every write that needs it reads it.
//
//   The library decision   members marked library owner (EmailMember.libraryOwner, read from the older `lead` too),
//                          next to the GitHub design owners of bridge.config.json. Never off.
//   The design review      per product, under bridge:design-review:<owner/repo lower case>:
//                          { [productKey]: { on: boolean, reviewers: string[] | "any-designer" } }
//                          reviewers are member references (exploration-member memberRef) or GitHub logins;
//                          "any-designer" is the older "Shared, with review": every designer reviews the others'.
//                          The key "*" holds the setting of every product not listed (what the migration writes).
//
// Migration (once per team, idempotent): a team without the key gets it from its older review mode
// (api/_lib/review-mode.ts, read once here and nowhere else), with the rules of core migrateReviews, copied here
// because the API does not import core (a test holds both equal). Settings shows a one time note after it.
//
// Nobody reviews their own exploration. An admin may answer either review but is never asked.

import type { Redis } from './redis.js';
import type { EmailMember } from './members.js';
import { memberRef } from './exploration-member.js';
import { reviewModeOf, type ReviewMode } from './review-mode.js';

export type DesignReviewSetting = { on: false } | { on: true; reviewers: string[] | 'any-designer' };
export type DesignReviewMap = Record<string, DesignReviewSetting>;

export const designReviewKey = (repo: string) => `bridge:design-review:${repo.toLowerCase()}`;
/** Set when the migration ran: Settings shows "Reviews now have two parts" until an admin saves the reviews once. */
export const reviewsNoteKey = (repo: string) => `bridge:reviews-note:${repo.toLowerCase()}`;
export const REVIEWS_NOTE = "Reviews now have two parts. Check who reviews each product's design.";

/** The product key that stands for every product not listed. */
export const ANY_PRODUCT = '*';

type Who = Pick<EmailMember, 'role' | 'lead' | 'libraryOwner' | 'email'> & { login?: string | null | undefined };

const norm = (s: string) => s.trim().replace(/^@/, '').toLowerCase();

/** Whether a value is a design review setting as kept. */
export function isDesignReviewSetting(v: unknown): v is DesignReviewSetting {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  if (o.on === false) return true;
  return o.on === true && (o.reviewers === 'any-designer' || (Array.isArray(o.reviewers) && o.reviewers.every((r) => typeof r === 'string' && r.length > 0 && r.length <= 64)));
}

/** A kept map, cleaned: unknown entries dropped. Null when it is not a map at all. */
export function parseDesignReviewMap(raw: unknown): DesignReviewMap | null {
  let v = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      return null;
    }
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const out: DesignReviewMap = {};
  for (const [k, s] of Object.entries(v as Record<string, unknown>)) if ((k === ANY_PRODUCT || k === OWNERS_ANY || /^[a-z0-9-]{1,64}$/.test(k)) && isDesignReviewSetting(s)) out[k] = s;
  return out;
}

/** The setting of one product: its own, else the team's "*", else off for the Library and on with nobody named. */
export function settingOf(map: DesignReviewMap, product: string | null | undefined): DesignReviewSetting {
  if (product && map[product]) return map[product]!;
  if (product === 'library') return { on: false };
  return map[ANY_PRODUCT] ?? { on: false };
}

/** A member who decides what the library keeps (Settings > Reviews > The library). The older `lead` reads as it. */
export const isLibraryOwner = (m: Pick<EmailMember, 'lead' | 'libraryOwner'> | null | undefined): boolean => Boolean(m && (m.libraryOwner ?? m.lead));

/** Whether this member is one of a product's design reviewers (never as an admin as such). */
export function asksDesignReview(m: Who | null | undefined, product: string | null | undefined, map: DesignReviewMap): boolean {
  if (!m) return false;
  const s = settingOf(map, product);
  if (!s.on) return false;
  if (s.reviewers === 'any-designer') return m.role === 'edit' || m.role === 'admin';
  const ids = new Set(s.reviewers.map(norm));
  return ids.has(memberRef(m.email)) || Boolean(m.login && ids.has(norm(m.login)));
}

/** Asked for the library decision: a library owner, or any designer when the team has every designer own it. */
export const asksLibrary = (m: Who | null | undefined, map: DesignReviewMap): boolean => Boolean(m && (isLibraryOwner(m) || (everyDesignerOwnsLibrary(map) && (m.role === 'edit' || m.role === 'admin'))));

/** Asked for some review (emails, Needs you): a library owner, or a design reviewer of some product. */
export function asksAnyReview(m: Who | null | undefined, map: DesignReviewMap): boolean {
  if (!m) return false;
  if (asksLibrary(m, map)) return true;
  return [...Object.keys(map), ANY_PRODUCT].filter((k) => k !== OWNERS_ANY).some((k) => asksDesignReview(m, k, map));
}

/** May answer on someone else's exploration: whoever is asked some review, and an admin (never asked). */
export const decidesOnExplorations = (m: Who | null | undefined, map: DesignReviewMap): boolean => Boolean(m && (asksAnyReview(m, map) || m.role === 'admin'));

/**
 * Whether an exploration goes through a review before the developers: someone other than the author can give the
 * design review of some product, or the library decision. `members` are the team's email members other than the
 * author, `designOwners` the GitHub design owners other than the author.
 */
export function needsReview(x: { map: DesignReviewMap; designOwners: number; members: readonly Who[] }): boolean {
  return x.designOwners > 0 || x.members.some((m) => asksAnyReview(m, x.map));
}

/**
 * The migration's rules (core two-reviews.ts migrateReviews), for one team without per product settings yet: the
 * setting every product gets ("*"), the Library off. "One person": on, the leads review; with no lead, `reviewers: []`
 * reads as the team's GitHub design owners (what "the design lead" meant). "Shared, with review": on, any designer.
 * "Shared, no review": off. A team of one has nobody else to ask: core reviewsFor never asks the author, so Done
 * exploring reads it as no review and nothing waits on nobody.
 */
export function migratedMap(x: { mode: ReviewMode; leads: readonly string[] }): DesignReviewMap {
  const reviewers = [...new Set(x.leads.map(norm))];
  const every: DesignReviewSetting = x.mode === 'shared-none' ? { on: false } : x.mode === 'shared' ? { on: true, reviewers: 'any-designer' } : { on: true, reviewers };
  return { [ANY_PRODUCT]: every, library: { on: false } };
}

/**
 * The design reviews of a team, migrated on first read from its older review mode and its members marked lead. Library
 * owners need no migration (`lead` reads as libraryOwner); on a shared team with no lead, every designer decides what
 * the library keeps (OWNERS_ANY).
 */
export async function designReviewsOf(redis: Redis, repo: string, members: () => Promise<readonly EmailMember[]>): Promise<DesignReviewMap> {
  const kept = parseDesignReviewMap(await redis.cmd('GET', designReviewKey(repo)).catch(() => null));
  if (kept) return kept;
  const [mode, list] = await Promise.all([reviewModeOf(redis, repo), members().catch(() => [] as EmailMember[])]);
  const leads = list.filter((m) => m.lead).map((m) => memberRef(m.email));
  const map = migratedMap({ mode, leads });
  if (mode !== 'one' && !leads.length) map[OWNERS_ANY] = { on: true, reviewers: 'any-designer' };
  await redis.pipe([
    ['SET', designReviewKey(repo), JSON.stringify(map)],
    ['SET', reviewsNoteKey(repo), '1'],
  ]).catch(() => undefined);
  return map;
}

/**
 * Library owners with nobody named on a shared team ("Shared, with review" or "no review" before the migration, and no
 * lead): every designer decides what the library keeps. Kept in the same map under this key.
 */
export const OWNERS_ANY = '~library-owners';

/** Whether every designer decides what the library keeps on this team (OWNERS_ANY). */
export const everyDesignerOwnsLibrary = (map: DesignReviewMap): boolean => {
  const s = map[OWNERS_ANY];
  return Boolean(s && s.on && s.reviewers === 'any-designer');
};

/** One product's design review, as an admin sets it. */
export async function setDesignReview(redis: Redis, repo: string, product: string, setting: DesignReviewSetting): Promise<DesignReviewMap> {
  const map = parseDesignReviewMap(await redis.cmd('GET', designReviewKey(repo)).catch(() => null)) ?? {};
  const next = { ...map, [product]: setting };
  await redis.pipe([
    ['SET', designReviewKey(repo), JSON.stringify(next)],
    ['DEL', reviewsNoteKey(repo)],
  ]);
  return next;
}

/** Whether Settings still shows the one time note. */
export async function reviewsNoteOf(redis: Redis, repo: string): Promise<boolean> {
  return (await redis.cmd('GET', reviewsNoteKey(repo)).catch(() => null)) === '1';
}
