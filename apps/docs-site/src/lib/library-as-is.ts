// What reaches the lead (owner, 2026-11-12): a piece becomes a decision (a Library review item, the nav count, a
// notification, a "New option" or "2 ways" tag, a step on the exploration page) only when at least one way is a value
// the library does not have yet. When every way is a value the library already has (its default, Compact...), the
// screens use the library as is: no tag, no queue item, one quiet line on the exploration page ("Leo's screen uses
// Compact, already in the library. Nothing to decide."). The rule itself is core's (library-options usesLibraryAsIs,
// library-impact asIsOption, which Looks right also reads); this applies it to conflicts between explorations, read
// from their records.
// Pure: no DOM. Read by lib/library-impact-view.ts, lib/library-review.ts, scripts/library-impact.ts and
// scripts/library-review-data.ts. Tested in library-as-is.test.ts.
import { asIsOption, impactItemOf, type ImpactSource, type LibraryConflict, type LibraryOption, type MissingPiece } from '@bridge-ds/core';

/** Core's own (library-impact asIsOption), the one Looks right reads too: re-exported for the pages. */
export { asIsOption };

/** The piece of a source that changes this component part, from its record. */
function pieceOfPart(s: Pick<ImpactSource, 'record'> | undefined, component: string, property: string): MissingPiece | undefined {
  const k = (x: string) => x.trim().toLowerCase();
  return s?.record?.pieces.find((p) => {
    const i = impactItemOf(p);
    return i.kind === 'variant' && k(i.of ?? '') === k(component) && k(i.property ?? '') === k(property);
  });
}

/**
 * A conflict is a decision unless every way is a piece the library already has as it is (asIsOption). A side whose
 * record cannot be read stays a decision: never hidden on a guess.
 */
export function isDecision(c: LibraryConflict, sources: readonly Pick<ImpactSource, 'key' | 'record'>[]): boolean {
  const of = (key: string) => sources.find((s) => s.key.toLowerCase() === key.toLowerCase());
  const mine = of(c.mine.key)?.record?.pieces.find((p) => p.id === c.piece) ?? pieceOfPart(of(c.mine.key), c.component, c.property);
  const theirs = pieceOfPart(of(c.other.key), c.component, c.property);
  return !(mine && theirs && asIsOption(mine) && asIsOption(theirs));
}

/**
 * The conflicts that are decisions for the lead, from the explorations' records, per component part: one way new to
 * the library keeps every way of that part (the ways already in the library stay on the table beside it); a part whose
 * ways are all in the library drops out.
 */
export function decisionConflicts(conflicts: readonly LibraryConflict[], sources: readonly Pick<ImpactSource, 'key' | 'record'>[]): LibraryConflict[] {
  const part = (c: LibraryConflict) => `${c.component.trim().toLowerCase()}|${c.property.trim().toLowerCase()}`;
  const decided = new Set(conflicts.filter((c) => isDecision(c, sources)).map(part));
  return conflicts.filter((c) => decided.has(part(c)));
}

/**
 * The quiet line of a piece that uses the library as is: "Leo's screen uses Compact, already in the library. Nothing to
 * decide." The default reads "the default Card padding" so it never sounds like a new option.
 */
export function asIsLine(designer: string, component: string, property: string, o: LibraryOption): string {
  const who = `${designer}${/s$/i.test(designer) ? "'" : "'s"}`;
  const what = o.isDefault ? `the default ${component} ${property.toLowerCase()} (${o.px} px)` : `${o.name} (${o.px} px)`;
  return `${who} screen uses ${what}, already in the library. Nothing to decide.`;
}
