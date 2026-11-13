// The colour of a status tag in Studio, one rule for every surface (Home, Changes, the exploration page, the library
// section, Being built, Review all, Quality, suggestions). A tag's colour comes from what its state means, never from
// its words: each state picks one of the five meanings below (LIFECYCLE_TONE, the build, review, suggestion and
// quality states all do), and the tag wears that meaning's tone. A new label therefore cannot pick a colour by itself.
//
//   blue  (Harbor) in progress: Exploring, Being built, In progress, Picked up, Developer on it
//   grey           waiting on someone, a calm wait: In review, Ready to build, Checking, Needs you, Two ways
//   amber          late: a wait past LATE_DAYS (core status-ladder.ts, more than a week). Nothing else is amber.
//   green          done: Approved, Shipped, Passing
//   red            blocked: Needs changes, Failing
//   grey           over or quiet: Closed, Archived, Not planned
//
// Blue is the selected surface and the link text (as on the validated boards and Home's cards), not the DS info tone:
// the DS colours stay as they are (info stays plum for the rest of the library), so Studio adds `st-tag-harbor` on top
// of any tag whose tone is info. Pure: no DOM. Tested in status-tag.test.ts. The class lives in styles/ds-studio.css.

import { isLate } from '@bridge-ds/core';

/** What a Studio status tag says about the work, one colour each. */
export type TagMeaning = 'in-progress' | 'waiting' | 'late' | 'done' | 'blocked' | 'over';

/** The DS Badge tone of each meaning. Info renders in Harbor in Studio (statusTagClass). */
export const MEANING_TONE = {
  'in-progress': 'info',
  // A wait is normal work: grey. Only a late one is amber (waitTone).
  waiting: 'neutral',
  late: 'warning',
  done: 'success',
  blocked: 'danger',
  over: 'neutral',
} as const satisfies Record<TagMeaning, 'info' | 'warning' | 'success' | 'danger' | 'neutral'>;

/** The tone a state with this meaning wears. */
export const toneOf = <M extends TagMeaning>(meaning: M): (typeof MEANING_TONE)[M] => MEANING_TONE[meaning];

/**
 * The class a status tag takes, from its tone (the one its state picked through MEANING_TONE), joined to `extra`: an
 * info tone (in progress) reads in Harbor, so no Studio tag is ever plum. Every other tone keeps its DS colour.
 */
export function statusTagClass(tone: string | null | undefined, extra?: string): string | undefined {
  const out = [extra, tone === MEANING_TONE['in-progress'] ? 'st-tag-harbor' : null].filter(Boolean).join(' ');
  return out || undefined;
}

/**
 * The dot of a status tag: in progress only (someone works on it), on every surface, list rows and cards alike. One
 * anatomy: the tone says the meaning, the dot says it moves. Done, waiting and over never carry one.
 */
export const statusTagDot = (tone: string | null | undefined): boolean => tone === MEANING_TONE['in-progress'];

/**
 * The tone of a wait, from how long it has waited (days, when known): grey, amber once late (core isLate, more than
 * LATE_DAYS). The one place a status picks the warning colour.
 */
export const waitTone = (waitedDays: number | null | undefined): 'neutral' | 'warning' => (isLate(waitedDays) ? MEANING_TONE.late : MEANING_TONE.waiting);
