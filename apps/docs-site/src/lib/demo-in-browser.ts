// The sample team's actions that run in this browser (lib/demo.ts SAMPLE_IN_BROWSER): what they keep, and where. Kept
// under keys swapDemoDrafts drops when the visitor leaves the sample team (they name the sample repository and
// "draft"), so nothing outlives the visit and nothing reaches a real team. Pure over a Storage-like store, covered by
// demo-in-browser.test.ts.
//   Looks right            the exploration's description as it reads after the design review's yes (core withDesignOk
//                          and withDecision, the same edits designApproveOnGitHub writes), painted in place of the one
//                          read from the sample repository until the visitor leaves.
//   Start an exploration   the name, where and sentence, so the visit remembers what was started.
import { isDesignReviewWaiting, parseExplorationBody, withDecision, withDesignOk } from '@bridge-ds/core';
import { SAMPLE_REPO } from './demo';

/** The part of Storage these helpers use. */
export interface KeptStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const answerKey = (number: number) => `bridge.${SAMPLE_REPO}.draft.looks-right.${number}`;
const startsKey = `bridge.${SAMPLE_REPO}.draft.explorations`;

/** The description after the design review's yes, said by `byName` (a cast name, never a login). Null when nothing waits on a design review. */
export function sampleLooksRightBody(body: string | null | undefined, x: { byName: string; at?: Date; note?: string }): string | null {
  if (!isDesignReviewWaiting(parseExplorationBody(body))) return null;
  const at = (x.at ?? new Date()).toISOString();
  return withDecision(withDesignOk(body, { at }), { kind: 'looks-right', hat: 'design', at, byName: x.byName, ...(x.note?.trim() ? { text: x.note.trim() } : {}) });
}

/** Keeps the answered description of sample exploration `number` for the visit. */
export function keepSampleAnswer(store: KeptStore, number: number, body: string): void {
  try {
    store.setItem(answerKey(number), body);
  } catch {
    /* storage full or blocked: the page still says what happened */
  }
}

/** The description as answered in this browser, else the one read: what the page paints on the sample team. */
export function sampleBodyOf(store: KeptStore, number: number, read: string | null | undefined): string | null | undefined {
  try {
    return store.getItem(answerKey(number)) ?? read;
  } catch {
    return read;
  }
}

/** One exploration started on the sample team, kept for the visit. */
export interface SampleStart {
  name: string;
  where: string;
  sentence: string;
  at: string;
}

/** The explorations started in this browser on the sample team, newest first. */
export function sampleStarts(store: KeptStore): SampleStart[] {
  try {
    const list = JSON.parse(store.getItem(startsKey) ?? '[]') as unknown;
    return Array.isArray(list) ? (list.filter((x) => x && typeof x.name === 'string' && typeof x.where === 'string') as SampleStart[]) : [];
  } catch {
    return [];
  }
}

/** Keeps one more start for the visit (at most 20). */
export function keepSampleStart(store: KeptStore, start: Omit<SampleStart, 'at'>, at = new Date()): SampleStart {
  const kept = { ...start, at: at.toISOString() };
  try {
    store.setItem(startsKey, JSON.stringify([kept, ...sampleStarts(store)].slice(0, 20)));
  } catch {
    /* storage full or blocked */
  }
  return kept;
}
