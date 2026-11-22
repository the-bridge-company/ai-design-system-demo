// A section not open yet (lib/nav.ts NavEntry.soon, owner 2026-11-20: Patterns): its nav row is drawn disabled with
// this tag, and its pages show the coming soon screen (components/site/ComingSoon.astro). Pure, light: the Studio rail
// island imports it.

/** The tag of a nav entry that is not open yet. */
export const COMING_SOON = 'Coming soon';

/** A page of a section that is not open yet: the Patterns pages, in the Library and in Studio, any team. */
export const isComingSoonPath = (path: string) => /(^|\/)patterns(\/|$)/.test(path);
