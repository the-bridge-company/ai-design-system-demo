// The library's current value of a component part: the one baseline every screen compares against. The exploration
// page's ledger ("Already in the library: Default 20 px"), its way words ("roomier than today") and Library review's
// compare list ("Today 20 px") all read it here, so the same decision never shows two different "today" values.
//
// The options themselves, and the rule for what reaches the lead (usesLibraryAsIs), live in core
// (packages/core/src/library-options.ts), so Looks right in core and the pages here read one source;
// library-baseline.test.ts reads the token files and fails if they drift.
// Pure: no DOM.
import { libraryToday } from '@bridge-ds/core';

export { existingOption, knownLibraryOptions, libraryToday, usesLibraryAsIs, type LibraryOption } from '@bridge-ds/core';

/**
 * The one baseline of a part: the library's own value first, else what the exploration's check recorded as today,
 * else what the page measured on the library component. Never a guess.
 */
export function baselineOf(component: string, property: string, recorded: number | null = null, measured: number | null = null): number | null {
  return libraryToday(component, property) ?? recorded ?? measured;
}
