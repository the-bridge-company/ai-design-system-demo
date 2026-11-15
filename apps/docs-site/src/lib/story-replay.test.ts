import { describe, expect, it } from 'vitest';
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
  const x = { workflow: true, today: 'https://sb.acme.com', template: 'https://sb-git-{branch}-acme.vercel.app', storyId: 'components-select--default' };
  it('prepares, plays, says it failed, or is off', () => {
    expect(replayStateOf({ ...x, preview: null })).toEqual({ kind: 'preparing' });
    expect(replayStateOf({ ...x, workflow: false, preview: null })).toEqual({ kind: 'off' });
    expect(replayStateOf({ ...x, preview: { state: 'no-key' } })).toEqual({ kind: 'off' });
    expect(replayStateOf({ ...x, preview: { state: 'failed', reason: 'No test folder' } })).toEqual({ kind: 'failed', reason: 'No test folder' });
    expect(replayStateOf({ ...x, preview: { state: 'ready', branch: 'agent/preview-75', round: 2 } })).toEqual({
      kind: 'ready',
      today: keysStoryUrl('https://sb.acme.com', 'components-select--default'),
      preview: 'https://sb-git-agent-preview-75-acme.vercel.app/iframe.html?id=components-select--default&viewMode=story&embed=bridge-keys',
      updated: true,
    });
    expect(replayStateOf({ ...x, template: null, preview: { state: 'ready', branch: 'agent/preview-75' } })).toEqual({ kind: 'unplayable' });
  });
});
