// The colour of a status tag in Studio, one mapping for every surface (Home, Changes, the exploration page, the
// library section, Being built, Review all): the work in motion, Exploring and Being built (on the Being built page
// its own words for that stage, Picked up and In progress), reads in Harbor (the
// selected surface and the link text, as on the validated boards and Home's cards). Every other tag keeps its tone.
// The DS colours stay as they are: info stays plum for the rest of the library; Studio only adds a class on top.
// Pure: no DOM. Tested in status-tag.test.ts. The class lives in styles/ds-studio.css (.st-tag-harbor).
import { BUILD_STATUS_LABEL } from '@bridge-ds/core';
import { LIFECYCLE_LABEL } from './review-state';

/** The tags that read in Harbor: work in motion. A build picked up or in progress is the Being built stage. */
const HARBOR = new Set<string>([LIFECYCLE_LABEL.exploring, LIFECYCLE_LABEL['being-built'], BUILD_STATUS_LABEL['picked-up'], BUILD_STATUS_LABEL['in-progress']]);

/** The class a tag with these words takes ("st-tag-harbor" for Exploring and Being built), joined to `extra`. */
export function statusTagClass(label: string | null | undefined, extra?: string): string | undefined {
  const harbor = Boolean(label && HARBOR.has(label.trim()));
  const out = [extra, harbor ? 'st-tag-harbor' : null].filter(Boolean).join(' ');
  return out || undefined;
}
