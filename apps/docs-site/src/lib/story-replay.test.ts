import { describe, expect, it } from 'vitest';
import { CLICK_OUTSIDE, keyLabel } from '@bridge-ds/core';
import { behaviorOf, keysStoryUrl, parseKeysResult, replaySequence, replayStateOf, resultLine, RESULT_MESSAGE, sameResult } from './story-replay';

const behaviors = [
  { id: 'open-on-enter', family: 'Opening', text: 'Enter opens the list', keys: ['Enter', 'ArrowDown'] },
  { id: 'arrows-move', family: 'Moving', text: 'Arrow keys move', keys: ['ArrowDown', 'ArrowUp'] },
  { id: 'tab-leaves', family: 'Focus', text: 'Tab leaves without picking', keys: ['Tab'], announces: 'Shipping speed, collapsed' },
  { id: 'type-to-jump', family: 'Moving', text: 'Type to jump' },
];

describe('the keys played', () => {
  it('opens, moves, then presses the behavior own key, from the docs only', () => {
    expect(replaySequence(behaviors, 'tab-leaves')).toEqual(['Enter', 'ArrowDown', 'Tab']);
    // A behavior that is itself how it opens or moves: its keys alone.
    expect(replaySequence(behaviors, 'arrows-move')).toEqual(['ArrowDown', 'ArrowUp']);
    expect(replaySequence(behaviors, null)).toEqual(['Enter', 'ArrowDown']);
    expect(replaySequence([], 'x')).toEqual([]);
    expect(behaviorOf(behaviors, { behavior: 'tab-leaves' })).toEqual({ announces: 'Shipping speed, collapsed', keys: ['Tab'] });
  });

  it('plays a click outside like a key: open, move, then click away', () => {
    const withMouse = [...behaviors, { id: 'pick-on-outside-click', family: 'Closing', text: 'A click outside keeps the highlighted option', keys: [CLICK_OUTSIDE] }];
    expect(replaySequence(withMouse, 'pick-on-outside-click')).toEqual(['Enter', 'ArrowDown', 'click-outside']);
    expect(behaviorOf(withMouse, { behavior: 'pick-on-outside-click' }).keys.map(keyLabel)).toEqual(['Click outside']);
  });
});

describe('what a story answers', () => {
  it('reads only its own answer, in one plain line', () => {
    const r = parseKeysResult({ type: RESULT_MESSAGE, id: 'a', result: { open: 'listbox', focus: 'Express', shows: 'Shipping speed' } }, 'a');
    expect(r).toEqual({ open: 'list', focus: 'Express', shows: 'Shipping speed' });
    expect(parseKeysResult({ type: RESULT_MESSAGE, id: 'b', result: {} }, 'a')).toBeNull();
    expect(parseKeysResult({ type: RESULT_MESSAGE, id: 'a', result: { open: '<img>' } }, 'a')).toEqual({ open: null, focus: null, shows: null });
    expect(resultLine(r)).toBe('It shows "Shipping speed". The list is open, the focus is on "Express".');
    expect(resultLine({ open: null, focus: null, shows: 'Express' })).toBe('It shows "Express". Nothing is open, the focus left it.');
    expect(resultLine(null)).toBe('No answer from this Storybook.');
    expect(sameResult(r, { ...r! })).toBe(true);
    expect(sameResult(r, { ...r!, focus: 'Notes' })).toBe(false);
  });
});

describe('the state Play both shows', () => {
  const x = { wanted: 'Tab picks the option', today: 'https://sb.acme.com', template: 'https://sb-git-{branch}-acme.vercel.app', storyId: 'components-select--default' };
  it('asks for the preview, then prepares, plays, says it failed', () => {
    expect(replayStateOf({ ...x, preview: null })).toEqual({ kind: 'ask', update: false });
    expect(replayStateOf({ ...x, preview: { state: 'preparing', by: 'Malik', wanted: x.wanted } })).toEqual({ kind: 'preparing', by: 'Malik' });
    expect(replayStateOf({ ...x, preview: { state: 'failed', reason: 'No test folder' } })).toEqual({ kind: 'failed', reason: 'No test folder' });
    expect(replayStateOf({ ...x, preview: { state: 'ready', branch: 'agent/preview-75', round: 2, wanted: x.wanted } })).toEqual({
      kind: 'ready',
      today: keysStoryUrl('https://sb.acme.com', 'components-select--default'),
      preview: 'https://sb-git-agent-preview-75-acme.vercel.app/iframe.html?id=components-select--default&viewMode=story&embed=bridge-keys',
      updated: true,
    });
    expect(replayStateOf({ ...x, template: null, preview: { state: 'ready', branch: 'agent/preview-75' } })).toEqual({ kind: 'unplayable' });
  });

  it('after she changed her words, asks to update it', () => {
    expect(replayStateOf({ ...x, preview: { state: 'ready', branch: 'agent/preview-75', wanted: 'Tab leaves' } })).toEqual({ kind: 'ask', update: true });
  });
});
