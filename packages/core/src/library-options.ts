// The options a library component part already has, and the one rule for what reaches the lead (owner, 2026-11-12).
//
// The values are the library's own code at the default density (comfortable): Card's padding is `--layout-inset`
// (density/comfortable layout.inset = space.5 = 20 px), its compact padding `--space-3` (12 px), none 0
// (packages/react/src/components/Card/Card.module.css). They are written here, not imported, so no client bundle pulls
// token JSON; apps/docs-site library-baseline.test.ts reads the token files and fails if they drift.
// Shared by core (Looks right never files an as-is piece: library-impact piecesToAdd) and the docs site (Library
// review, the exploration page: lib/library-baseline, lib/library-as-is). Pure.

/** An option the library component already has, as its code says. */
export interface LibraryOption {
  name: string;
  px: number;
  isDefault?: boolean;
}

const OPTIONS: Record<string, readonly LibraryOption[]> = {
  'card|padding': [
    { name: 'None', px: 0 },
    { name: 'Compact', px: 12 },
    { name: 'Default', px: 20, isDefault: true },
  ],
};

const keyOf = (component: string, property: string) => `${component.trim().toLowerCase()}|${property.trim().toLowerCase()}`;

/** The options the library's code gives a component part, or null when Bridge does not know the part. */
export function knownLibraryOptions(component: string, property: string): readonly LibraryOption[] | null {
  return OPTIONS[keyOf(component, property)] ?? null;
}

/** The library's value today for a component part (its default option), or null when Bridge does not know it. */
export function libraryToday(component: string, property: string): number | null {
  return knownLibraryOptions(component, property)?.find((o) => o.isDefault)?.px ?? null;
}

/** A way's value in pixels ("12", "12px", 12); null for anything else (a colour, a token name, nothing). */
const pxOf = (v: string | number | null | undefined): number | null => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*(?:px)?\s*$/.exec(v ?? '');
  return m ? Number(m[1]) : null;
};

/** The option the library already has at a value of a component part (the default included), or null. */
export function existingOption(component: string, property: string, value: string | number | null | undefined): LibraryOption | null {
  const px = pxOf(value);
  if (px === null) return null;
  return knownLibraryOptions(component, property)?.find((o) => o.px === px) ?? null;
}

/**
 * The one rule for what reaches the lead: a component part becomes a decision (a Library review item, a nav count, a
 * notification, a "New option" or "2 ways" tag, a step on the exploration page, a library request on Looks right) only
 * when at least one way is a value the library does not have yet. When every way is a value the library already has
 * (its default, Compact...), the screens use the library as is: nothing to decide, nothing to build. A part Bridge does
 * not know, or a value it cannot read, is a decision: never hidden on a guess.
 */
export function usesLibraryAsIs(component: string, property: string, values: readonly (string | number | null | undefined)[]): boolean {
  return values.length > 0 && values.every((v) => existingOption(component, property, v) !== null);
}
