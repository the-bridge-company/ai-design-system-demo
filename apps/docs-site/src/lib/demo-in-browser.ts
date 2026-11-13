// The sample team's actions that run in this browser (lib/demo.ts SAMPLE_IN_BROWSER): what they keep, and where. Kept
// under keys swapDemoDrafts drops when the visitor leaves the sample team (they name the sample repository and
// "draft"), so nothing outlives the visit and nothing reaches a real team. Pure over a Storage-like store, covered by
// demo-in-browser.test.ts.
//   Looks right            the pull request as the real approval leaves it (core designApproveOnGitHub, two-reviews):
//                          the design review's yes in the description, and nothing else: it never decides a library
//                          piece. While any new piece is undecided (read as the exploration page reads it, legacy asks
//                          included: lib/team-reviews legacyLibraryAsk), it stays In review on the library decision.
//                          Only when nothing waits does the hand-off settleReviewsOnGitHub runs (Done exploring in the
//                          description, `exploration` label off, `ready-for-devs` on): Ready to build. Every read of
//                          the sample team's pull requests (scripts/github-session ghGet) is answered with that copy,
//                          so the page, the lists, Home and the rail badge agree.
//   Start an exploration   the name, where and sentence, so the visit remembers what was started.
import {
  EXPLORATION_LABEL,
  EXPLORATION_READY_LABEL,
  isDesignReviewWaiting,
  isInReview,
  libraryPendingOf,
  parseExplorationBody,
  parsePiecesRecord,
  withDecision,
  withDesignOk,
  withDoneExploring,
  withLibraryAsked,
} from '@bridge-ds/core';
import { SAMPLE_REPO } from './demo';
import { legacyLibraryAsk } from './team-reviews';

/** The part of Storage these helpers use. */
export interface KeptStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** A pull request as the sample team's reads return it: what an answer changes. */
export interface SamplePull {
  number: number;
  body?: string | null | undefined;
  labels?: ({ name?: string } | string)[] | undefined;
  head?: { ref?: string; sha?: string } | undefined;
  /** The repository it lives in, as GitHub says it (product pulls are also tagged with `repo`). */
  base?: { ref?: string; repo?: { full_name?: string } | null } | null | undefined;
  repo?: string | undefined;
  html_url?: string | undefined;
}

/** The repository a pull request lives in ("owner/repo"), from the pull request itself; null when it does not say. */
export function pullRepo(p: SamplePull): string | null {
  const own = p.base?.repo?.full_name ?? (typeof p.repo === 'string' ? p.repo : null) ?? /github\.com\/([^/]+\/[^/]+)\/pull\//.exec(p.html_url ?? '')?.[1] ?? null;
  return own ? own.toLowerCase() : null;
}

/** What Looks right left: the description and labels, and where the exploration stands now. */
export interface SampleAnswer {
  body: string;
  labels: string[];
  /** Ready to build (handed to the developers), else In review on the library decision. */
  ready: boolean;
  /** The new pieces still waiting for a library decision. */
  libraryPending: string[];
}

const labelNames = (labels: SamplePull['labels']): string[] => (labels ?? []).map((l) => (typeof l === 'string' ? l : (l.name ?? ''))).filter(Boolean);

/**
 * The pull request after the design review's Looks right, as designApproveOnGitHub leaves it: the yes (withDesignOk,
 * a looks-right decision by `byName`, a cast name, never a login); with nothing left for the library, the hand-off
 * settleReviewsOnGitHub writes (withDoneExploring under the name of who asked, labels swapped). Null when no design
 * review waits.
 */
export function sampleLooksRight(pull: SamplePull, x: { byName: string; at?: Date; note?: string | undefined }): SampleAnswer | null {
  const e = parseExplorationBody(pull.body);
  if (!isDesignReviewWaiting(e)) return null;
  const at = (x.at ?? new Date()).toISOString();
  // The library ask as the exploration page reads it: an exploration asked before the two reviews (one ask to the
  // lead, no library ask on record) has its new pieces waiting on the library decision too.
  const pending = libraryPendingOf(legacyLibraryAsk(e), parsePiecesRecord(pull.body));
  let said = withDecision(withDesignOk(pull.body, { at }), { kind: 'looks-right', hat: 'design', at, byName: x.byName, ...(x.note?.trim() ? { text: x.note.trim() } : {}), ...(pull.head?.sha ? { sha: pull.head.sha } : {}) });
  // That legacy ask written down, at the time it was made: once the design review answered, every reader (core
  // isInReview, the lists, Home) still sees the library decision waiting.
  if (pending.length && !e!.library?.askedAt) said = withLibraryAsked(said, { at: e!.designAskedAt!, ...(e!.designAskedBy ? { by: e!.designAskedBy } : {}), ...(e!.designAskedByName ? { byName: e!.designAskedByName } : {}) });
  const labels = labelNames(pull.labels);
  if (pending.length || isInReview(said)) return { body: said, labels, ready: false, libraryPending: pending };
  const asked = parseExplorationBody(said);
  const branch = pull.head?.ref ?? '';
  const body = withDoneExploring(said, { branch, doneAt: at, ...(asked?.designAskedBy ? { doneBy: asked.designAskedBy } : {}), ...(pull.head?.sha ? { doneSha: pull.head.sha } : {}) });
  return { body, labels: [...labels.filter((l) => l !== EXPLORATION_LABEL), ...(labels.includes(EXPLORATION_READY_LABEL) ? [] : [EXPLORATION_READY_LABEL])], ready: true, libraryPending: [] };
}

/** Told on `document` after an answer given in this browser: lists read before it read again. */
export const SAMPLE_ANSWERED_EVENT = 'bridge:sample-answered';

const answerPrefix = `bridge.${SAMPLE_REPO}.draft.answer.`;
const answerKey = (repo: string, number: number) => `${answerPrefix}${repo.toLowerCase()}#${number}`;

/** Keeps the answered pull request `number` of `repo` (the sample team's or one of its products') for the visit. */
export function keepSampleAnswer(store: KeptStore, repo: string, number: number, answer: Pick<SampleAnswer, 'body' | 'labels'>): void {
  try {
    store.setItem(answerKey(repo, number), JSON.stringify({ body: answer.body, labels: answer.labels }));
  } catch {
    /* storage full or blocked: the page still says what happened */
  }
}

function keptAnswer(store: KeptStore, repo: string, number: number): Pick<SampleAnswer, 'body' | 'labels'> | null {
  try {
    const v = JSON.parse(store.getItem(answerKey(repo, number)) ?? 'null') as { body?: unknown; labels?: unknown } | null;
    return v && typeof v.body === 'string' && Array.isArray(v.labels) ? { body: v.body, labels: v.labels.filter((l): l is string => typeof l === 'string') } : null;
  } catch {
    return null;
  }
}

/** A pull request read from `repo`, with the answer given in this browser when there is one. Never mutates `pull`. */
export function withSampleAnswer<P extends SamplePull>(store: KeptStore, repo: string, pull: P): P {
  if (!pull || typeof pull.number !== 'number') return pull;
  // The pull request's own repository first: a product's exploration read from anywhere matches its answer.
  const kept = keptAnswer(store, pullRepo(pull) ?? repo, pull.number);
  if (!kept) return pull;
  const shape = (pull.labels ?? []).some((l) => typeof l === 'string');
  return { ...pull, body: kept.body, labels: kept.labels.map((name) => (shape ? name : { name })) };
}

/**
 * A read answered with the answers given in this browser: a GitHub path of pull requests (`/repos/o/r/pulls...`, one
 * or a list) gets each answered pull request's kept copy. Anything else, or no answer kept, is returned as is.
 */
export function sampleRead<T>(store: KeptStore, path: string, data: T): T {
  const m = /^(?:https:\/\/api\.github\.com)?\/repos\/([^/]+\/[^/?]+)\/pulls(?:\/(\d+))?(?:\?|$)/.exec(path);
  if (!m) return data;
  const repo = m[1]!;
  if (Array.isArray(data)) {
    const out = data.map((p) => withSampleAnswer(store, repo, p as SamplePull));
    return (out.some((p, i) => p !== data[i]) ? out : data) as T;
  }
  if (m[2] && data && typeof data === 'object') return withSampleAnswer(store, repo, data as unknown as SamplePull) as unknown as T;
  return data;
}

/** One exploration started on the sample team, kept for the visit. */
export interface SampleStart {
  name: string;
  where: string;
  sentence: string;
  at: string;
}

const startsKey = `bridge.${SAMPLE_REPO}.draft.explorations`;

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
