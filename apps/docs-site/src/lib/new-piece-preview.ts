// The before and after of a library piece in Library review (the One by one plates and the List's pair): something new
// (a component, a pattern, docs) has no "before", so only its after side shows, captioned "New in this screen". A value
// that does not exist on one side never reads as the raw word "none": the before side of a new value is left out, an
// after side that is gone reads "Removed". Pure: no DOM. Unit tested in new-piece-preview.test.ts.

/** The caption of a new piece's only side. */
export const NEW_IN_SCREEN = 'New in this screen';
/** A side whose value is not in the library yet, or no longer. */
export const NOT_IN_LIBRARY = 'Not in the library';
export const REMOVED = 'Removed';

/** What a side draws from: a drawn value (color, space, radius, type, image) or the change's own thumbnail. */
export interface SideSpec {
  kind: string;
  before?: unknown;
  after?: unknown;
}

const VALUED = new Set(['color', 'space', 'radius', 'type', 'image']);
const present = (v: unknown) => v !== null && v !== undefined && v !== '';

/**
 * Whether the before side shows. A drawn value shows its before when it has one; anything else (a component's
 * thumbnail) only when the piece is not new: a new component has nothing before it.
 */
export function showsBefore(isNew: boolean, spec: SideSpec): boolean {
  if (VALUED.has(spec.kind)) return present(spec.before);
  return !isNew;
}

/** The after side's caption: "New in this screen" when it is the only side, else the page's own words. */
export const afterCaption = (isNew: boolean, spec: SideSpec, otherwise: string): string => (showsBefore(isNew, spec) ? otherwise : NEW_IN_SCREEN);

/** The words of an empty side, never "none": not in the library yet before, removed after. */
export const emptySideWords = (side: 'before' | 'after'): string => (side === 'before' ? NOT_IN_LIBRARY : REMOVED);
