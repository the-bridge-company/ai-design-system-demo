// The library's current value of a component part: the one baseline every screen compares against. The exploration
// page's ledger ("Already in the library: Default 20 px"), its way words ("roomier than today") and Library review's
// compare list ("Today 20 px") all read it here, so the same decision never shows two different "today" values.
//
// The values are the library's own code at the default density (comfortable): Card's padding is `--layout-inset`
// (density/comfortable layout.inset = space.5 = 20 px), its compact padding `--space-3` (12 px), none 0
// (packages/react/src/components/Card/Card.module.css). They are written here, not imported, so the client bundle
// stays free of token JSON; library-baseline.test.ts reads the token files and fails if they drift.
// Pure: no DOM.

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

/**
 * The one baseline of a part: the library's own value first, else what the exploration's check recorded as today,
 * else what the page measured on the library component. Never a guess.
 */
export function baselineOf(component: string, property: string, recorded: number | null = null, measured: number | null = null): number | null {
  return libraryToday(component, property) ?? recorded ?? measured;
}
