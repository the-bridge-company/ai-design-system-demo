// Play both (phase 2, PR 3): the same keys pressed on a story in several Storybooks at once (today's, Claude's preview
// branch, a developer's build), each side's result in one line. A story opened with `embed=bridge-keys` (the team's
// .storybook/preview.tsx, the same file that answers `embed=bridge`) focuses the story's first control when asked,
// presses the keys with Storybook's own userEvent (storybook/test: real keyboard events, Tab moving focus as a browser
// does), then posts what it sees: which popup is open, where the focus is, what the control shows. The frames are on
// another origin (the team's Storybook), so the page talks to them by postMessage only. Pure: no DOM.

import { previewUrl, readBehaviors, storybookIframeUrl, type BehaviorAsk, type BehaviorPreviewState } from '@bridge-ds/core';
import { httpsStorybook } from './team-components';

export const KEYS_EMBED_VALUE = 'bridge-keys';
/** The parent asks: press these keys. */
export const PRESS_MESSAGE = 'bridge:press-keys';
/** The story answers: what it sees after the keys. */
export const RESULT_MESSAGE = 'bridge:keys-result';
/** The story is ready to be asked. */
export const READY_MESSAGE = 'bridge:keys-ready';

/** A story's iframe URL that answers the key messages. */
export const keysStoryUrl = (base: string, storyId: string): string => `${storybookIframeUrl(base, storyId)}&embed=${KEYS_EMBED_VALUE}`;

export interface KeysResult {
  /** The popup open after the keys, by its role in words ("list", "menu", "dialog"), or null when nothing is open. */
  open: string | null;
  /** The accessible name of what has the focus, or null when the focus left the story. */
  focus: string | null;
  /** What the story's first control shows (its text), when it shows something. */
  shows: string | null;
}

const short = (x: unknown): string | null => (typeof x === 'string' && x.trim() ? x.trim().replace(/\s+/g, ' ').slice(0, 60) : null);

/** The answer a story posted for request `id`, or null when the message is something else. */
export function parseKeysResult(data: unknown, id: string): KeysResult | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { type?: unknown; id?: unknown; result?: Record<string, unknown> };
  if (d.type !== RESULT_MESSAGE || d.id !== id || !d.result || typeof d.result !== 'object') return null;
  const open = short(d.result.open);
  return { open: open && /^(list|menu|dialog|listbox)$/.test(open) ? (open === 'listbox' ? 'list' : open) : null, focus: short(d.result.focus), shows: short(d.result.shows) };
}

/** One plain line: 'It shows "Express". Nothing is open, the focus left it.' */
export function resultLine(r: KeysResult | null): string {
  if (!r) return 'No answer from this Storybook.';
  const shows = r.shows ? `It shows "${r.shows}". ` : '';
  const open = r.open ? `The ${r.open} is open` : 'Nothing is open';
  const focus = r.focus ? `the focus is on "${r.focus}"` : 'the focus left it';
  return `${shows}${open}, ${focus}.`;
}

/** Two sides agree: the same popup, focus and value. */
export const sameResult = (a: KeysResult | null, b: KeysResult | null): boolean => Boolean(a && b && a.open === b.open && a.focus === b.focus && a.shows === b.shows);

/**
 * The keys played for one behavior, from the component's docs.json only: what opens it first (the first key of its
 * first Opening behavior), a move (the first key of its first Moving behavior), then the behavior's own keys. A new
 * behavior, or one with no keys: the keys of the Opening and Moving behaviors only. Empty when the docs say no key.
 */
export function replaySequence(behaviorsJson: unknown, behaviorId: string | null | undefined): string[] {
  const list = readBehaviors(behaviorsJson);
  const first = (family: string) => list.find((b) => b.family === family && b.keys?.length)?.keys?.[0];
  const own = behaviorId ? (list.find((b) => b.id === behaviorId)?.keys ?? []) : [];
  const lead = [first('Opening'), first('Moving')].filter((k): k is string => Boolean(k));
  // The behavior is itself how it opens or moves: its keys alone.
  if (own.length && lead.some((k) => own.includes(k))) return [...own];
  return [...lead, ...own.slice(0, 1)];
}

/** The behavior a request asks about, as the component's docs.json says it today (its announcement, its keys). */
export function behaviorOf(behaviorsJson: unknown, ask: Pick<BehaviorAsk, 'behavior'>): { announces: string | null; keys: string[] } {
  const b = ask.behavior ? readBehaviors(behaviorsJson).find((x) => x.id === ask.behavior) : undefined;
  return { announces: b?.announces ?? null, keys: b?.keys ?? [] };
}

export type ReplaySide = 'today' | 'preview' | 'build';
export const SIDE_LABEL: Record<ReplaySide, string> = { today: 'Today', preview: "Claude's preview", build: 'Your build' };

/** What Play both shows (BehaviorReplay.tsx). */
export type ReplayState =
  /** No preview yet, or it was made from words the requester changed since: someone asks their Claude to make it. */
  | { kind: 'ask'; update: boolean }
  | { kind: 'preparing'; by: string | null }
  | { kind: 'ready'; today: string; preview: string; updated: boolean }
  | { kind: 'failed'; reason: string | null }
  /** Claude made the change, but the team's Storybook does not publish each branch: nothing to play. */
  | { kind: 'unplayable' };

/**
 * From what was read (Bridge's preview record on the request, the request's wanted sentence now, the team's Storybook
 * and its per-branch template, the story): the state the page shows. A record made from other words than the request
 * says now is out of date: the person who can make it is asked to update it.
 */
export function replayStateOf(x: { preview: BehaviorPreviewState | null; wanted: string; today: string; template: string | null; storyId: string }): ReplayState {
  const p = x.preview;
  if (!p) return { kind: 'ask', update: false };
  if (p.wanted && p.wanted.trim() !== x.wanted.trim()) return { kind: 'ask', update: true };
  if (p.state === 'preparing') return { kind: 'preparing', by: p.by ?? null };
  if (p.state === 'failed') return { kind: 'failed', reason: p.reason ?? null };
  const base = p.branch && x.template && x.today && x.storyId ? httpsStorybook(previewUrl(x.template, { branch: p.branch, ...(p.pr ? { pr: p.pr } : {}), ...(p.sha ? { sha: p.sha } : {}) })) : undefined;
  if (!base) return { kind: 'unplayable' };
  return { kind: 'ready', today: keysStoryUrl(x.today, x.storyId), preview: keysStoryUrl(base, x.storyId), updated: (p.round ?? 1) > 1 };
}
