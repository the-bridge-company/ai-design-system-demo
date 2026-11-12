/**
 * The separator between two parts of a status line ("Sofia · 2 days ago"). Instrument Sans has a narrow space (0.2em)
 * and a 1.5px dot, so a plain " · " read as one cramped mark ("timeline·Sofia": 7px in all at 14px). A third of an em
 * on each side (U+2004, about 4.7px at 14px) gives the dot its own room. A word joiner (U+2060) glues the dot to the
 * space before it, and U+2004 never starts a line: when the line wraps, the dot ends the first line, never starts the
 * next. Every status line joins its parts with it (or joinSep), and code that reads a part back splits on it.
 */
export const SEP = '\u2004\u2060·\u2004';

/** Joins the parts of a status line with SEP, dropping the empty ones. */
export const joinSep = (parts: readonly (string | null | undefined | false)[]): string => parts.filter(Boolean).join(SEP);

/** Splits a status line on its separator, whatever the spacing around the dot (SEP, or a plain " · "). */
export const SEP_SPLIT = /[\s\u2060]*·[\s\u2060]*/;
