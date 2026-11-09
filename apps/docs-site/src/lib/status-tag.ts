// The colour of a status tag in Studio, one mapping for every surface (Home, Changes, the exploration page, the
// library section, Being built, Review all): the work in motion, Exploring and Being built, reads in Harbor (the
// selected surface and the link text, as on the validated boards and Home's cards). Every other tag keeps its tone.
// The DS colours stay as they are: info stays plum for the rest of the library; Studio only adds a class on top.
// Pure: no DOM. Tested in status-tag.test.ts. The class lives in styles/ds-studio.css (.st-tag-harbor).
import { LIFECYCLE_LABEL } from './review-state';

/** The tags that read in Harbor: work in motion. */
const HARBOR = new Set<string>([LIFECYCLE_LABEL.exploring, LIFECYCLE_LABEL['being-built']]);

/** The class a tag with these words takes ("st-tag-harbor" for Exploring and Being built), joined to `extra`. */
export function statusTagClass(label: string | null | undefined, extra?: string): string | undefined {
  const harbor = Boolean(label && HARBOR.has(label.trim()));
  const out = [extra, harbor ? 'st-tag-harbor' : null].filter(Boolean).join(' ');
  return out || undefined;
}
