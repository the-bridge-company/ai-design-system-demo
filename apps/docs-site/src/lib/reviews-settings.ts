// Settings > Reviews (docs/specs/two-reviews.md): the rules and words of the two sections, apart from the component
// (components/ds/studio/ReviewsSection.tsx) so they are unit tested.
//
//   The library                       who decides what the library keeps: email members marked library owner, and the
//                                     GitHub design owners of bridge.config.json (read only here). Never off.
//   Design review before developers   one row per product (and the Library): off, or on with who reviews (any one of
//                                     them answers), or "Any designer" (every designer reviews the others' screens).
//
// Reviewer ids as the server keeps them (api/_lib/review-settings.ts): a member reference (16 hex, never an email) or a
// GitHub login. Pure: no DOM, no fetch (memberRefOf hashes with Web Crypto, the same as the server's memberRef).
import { HAT_WORDS, type ProductConfig } from '@bridge-ds/core';
import { settingOf, type DesignReviewMap, type DesignReviewSetting } from './team-reviews';

/** The value of the "Any designer" choice in a reviewers list. */
export const ANY_DESIGNER = 'any-designer';

/** The key of the Library's own row. */
export const LIBRARY_KEY = 'library';

export const REVIEWS_WORDS = {
  title: 'Reviews',
  intro: 'Two reviews, apart from each other: what the library keeps, for the whole team, and each product\'s design before developers build it.',
  libraryTitle: 'The library',
  libraryRole: HAT_WORDS.libraryRole,
  libraryOwners: 'Library owners',
  libraryHelp: 'Asked when a screen has something new for the library. Never their own screen.',
  githubOwnersNote: 'Design owners on GitHub decide too. They come from bridge.config.json (governance.owners.design): change them there.',
  changeOwners: 'Change who decides',
  keepOneOwner: 'Keep at least one person who decides what the library keeps.',
  designTitle: 'Design review before developers',
  designRole: HAT_WORDS.designRole,
  designHelp: 'Someone checks a product\'s screens before the developers build them. Any one of the reviewers answers, never on their own screen.',
  libraryRow: 'Library',
  switchLabel: (product: string) => `Design review for ${product}`,
  whoReviews: (product: string) => `Who reviews ${product}`,
  changeWho: 'Change who reviews',
  closeWho: 'Done',
  anyDesigner: 'Any designer',
  anyDesignerHelp: 'Every designer reviews the others\' screens.',
  pickOne: 'Pick at least one reviewer, or turn the design review off.',
  saved: 'Saved.',
  migrated: HAT_WORDS.migrated,
  loading: 'Reading who reviews',
} as const;

const andList = (parts: readonly string[], word = 'and') => (parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} ${word} ${parts[parts.length - 1]}`);
const norm = (s: string) => s.trim().replace(/^@/, '').toLowerCase();

/** One row of "Design review before developers". */
export interface ReviewRow {
  key: string;
  name: string;
  setting: DesignReviewSetting;
}

/**
 * The rows: every product of the team's config, then the Library (off by default: the library decision is its only
 * review). A product listed nowhere in the map reads the team's "*" setting.
 */
export function reviewRows(products: readonly Pick<ProductConfig, 'key' | 'name'>[], map: DesignReviewMap): ReviewRow[] {
  const rows = products.filter((p) => p.key && p.key !== LIBRARY_KEY).map((p) => ({ key: p.key, name: p.name || p.key, setting: settingOf(map, p.key) }));
  return [...rows, { key: LIBRARY_KEY, name: REVIEWS_WORDS.libraryRow, setting: settingOf(map, LIBRARY_KEY) }];
}

/** The summary sentence of the library section: "Dana decides what the library keeps". */
export function libraryOwnersLine(names: readonly string[]): string {
  const list = [...new Set(names.filter(Boolean))];
  if (!list.length) return 'Nobody decides what the library keeps yet';
  return `${andList(list)} ${list.length === 1 ? 'decides' : 'decide'} what the library keeps`;
}

/**
 * A product row's one line: "No design review", "Dana reviews", "Dana or Leo reviews", "Any designer reviews". An
 * empty named list reads as the GitHub design owners (what "the design lead" meant).
 */
export function designReviewLine(setting: DesignReviewSetting, nameOf: (id: string) => string, githubOwners: readonly string[] = []): string {
  if (!setting.on) return 'No design review';
  if (setting.reviewers === ANY_DESIGNER) return 'Any designer reviews';
  const ids = setting.reviewers.length ? setting.reviewers : githubOwners;
  const names = [...new Set(ids.map(nameOf).filter(Boolean))];
  if (!names.length) return 'Nobody reviews yet';
  return `${andList(names, 'or')} reviews`;
}

/**
 * The setting a row gets when its Switch turns on: the team's "*" setting when that is on, else the library owners
 * (who reviewed as "the design lead"), else any designer.
 */
export function turnedOn(teamDefault: DesignReviewSetting | null | undefined, libraryOwnerIds: readonly string[]): DesignReviewSetting {
  if (teamDefault?.on && (teamDefault.reviewers === ANY_DESIGNER || teamDefault.reviewers.length)) return teamDefault;
  const owners = [...new Set(libraryOwnerIds.map(norm).filter(Boolean))];
  return owners.length ? { on: true, reviewers: owners } : { on: true, reviewers: ANY_DESIGNER };
}

/** The reviewers list's checked values for a setting. */
export function reviewerValues(setting: DesignReviewSetting): string[] {
  if (!setting.on) return [];
  return setting.reviewers === ANY_DESIGNER ? [ANY_DESIGNER] : [...setting.reviewers];
}

/**
 * The setting after the reviewers list changed (`next`, the checked values; `before`, the setting it changed from).
 * Ticking "Any designer" replaces the names; ticking a name while "Any designer" was on replaces it. Nothing left:
 * null (say REVIEWS_WORDS.pickOne, save nothing).
 */
export function settingFromValues(next: readonly string[], before: DesignReviewSetting): DesignReviewSetting | null {
  const wasAny = before.on && before.reviewers === ANY_DESIGNER;
  const any = next.includes(ANY_DESIGNER);
  const names = next.filter((v) => v !== ANY_DESIGNER);
  if (any && (!wasAny || !names.length)) return { on: true, reviewers: ANY_DESIGNER };
  if (!names.length) return null;
  return { on: true, reviewers: [...new Set(names)] };
}

/** Whether removing one library owner leaves nobody to decide (the library decision is never off). */
export const leavesNoOwner = (x: { ownersAfter: number; githubOwners: number }): boolean => x.ownersAfter + x.githubOwners === 0;

/** A member reference, as the server computes it (api/_lib/exploration-member memberRef): never sends the email. */
export async function memberRefOf(email: string): Promise<string> {
  const data = new TextEncoder().encode(`member:${email.trim().toLowerCase()}`);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 16);
}
