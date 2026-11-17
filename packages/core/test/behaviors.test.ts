// Behaviors in docs.json: the validator that blocks a malformed list, the reader pages use on any repo's docs, the
// grouping by family, and the agent view. Checked against the real Select and Combobox docs too.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { agentBehaviors, BEHAVIOR_FAMILIES, behaviorGroups, CLICK_OUTSIDE, keyLabel, readBehaviors, validateBehaviors } from '../src/behaviors';
import { validateDocs } from '../src/docs-proposal';
import { formatDocsJson, type ComponentDocsJson } from '../src/docs-draft';

const COMPONENTS = join(__dirname, '../../react/src/components');
const docsOf = (name: string) => JSON.parse(readFileSync(join(COMPONENTS, name, `${name}.docs.json`), 'utf8')) as ComponentDocsJson;

describe('validateBehaviors', () => {
  it('accepts no list and a well-formed one', () => {
    expect(validateBehaviors(undefined)).toEqual([]);
    expect(validateBehaviors([{ id: 'close-on-escape', family: 'Closing', text: 'Closes on Escape', keys: ['Escape'], announces: 'Collapsed' }])).toEqual([]);
  });

  it('names what to fix: shape, id, duplicate id, family, text, keys, announcement, example, em dash', () => {
    expect(validateBehaviors({})[0]!.field).toBe('behaviors');
    const issues = validateBehaviors([
      'x',
      { id: 'Close On Escape', family: 'Closing', text: 'Closes' },
      { id: 'a', family: 'Closing', text: 'One' },
      { id: 'a', family: 'Closing', text: 'Two' },
      { id: 'b', family: 'Somewhere', text: 'Three' },
      { id: 'c', family: 'Closing', text: ' ' },
      { id: 'd', family: 'Closing', text: 'Four', keys: [] },
      { id: 'e', family: 'Closing', text: 'Five', announces: '' },
      { id: 'f', family: 'Closing', text: 'Six', example: 'Select' },
      { id: 'g', family: 'Closing', text: 'Closes \u2014 fast' },
      { id: 'h', family: 'Closing', text: 'Seven', try: ' ' },
    ]);
    expect(issues.map((i) => i.field)).toEqual([
      'behaviors.0',
      'behaviors.1.id',
      'behaviors.3.id',
      'behaviors.4.family',
      'behaviors.5.text',
      'behaviors.6.keys',
      'behaviors.7.announces',
      'behaviors.8.example',
      'behaviors.9.text',
      'behaviors.10.try',
    ]);
    expect(issues.find((i) => i.field === 'behaviors.3.id')!.message).toMatch(/used twice/);
    expect(issues.find((i) => i.field === 'behaviors.4.family')!.message).toContain(BEHAVIOR_FAMILIES.join(', '));
  });

  it('blocks a docs proposal with a malformed list (validateDocs)', () => {
    const d = { ...docsOf('Select'), behaviors: [{ id: 'x', family: 'Nope', text: 'Hi' }] } as ComponentDocsJson;
    expect(validateDocs(d).map((i) => i.field)).toContain('behaviors.0.family');
  });
});

describe('Select and Combobox behaviors (the docs on main)', () => {
  const select = docsOf('Select');
  const combobox = docsOf('Combobox');

  it('are valid, and their docs pass validateDocs', () => {
    expect(validateDocs(select)).toEqual([]);
    expect(validateDocs(combobox)).toEqual([]);
  });

  it('list Select 9 and Combobox 8 behaviors, in the agreed order', () => {
    expect(select.behaviors!.map((b) => b.text)).toEqual([
      'Opens a list',
      'Arrow keys move',
      'Type to jump',
      'Enter picks and closes (with multiple, the list stays open)',
      'Closes on Escape',
      'A click outside closes and keeps the highlighted option (with multiple, it only closes)',
      'Tab leaves without picking',
      'Focus goes back to the trigger',
      'Page scroll paused while open, unless opened by touch',
    ]);
    expect(combobox.behaviors!.map((b) => b.text)).toEqual([
      'Typing filters the list',
      'Down arrow opens the list and moves',
      'Enter picks the highlighted option',
      'Escape closes the list',
      'A second Escape clears what was typed and the pick',
      'Says when nothing matches',
      'Says when results are loading',
      'Focus stays in the field after a pick',
    ]);
  });

  it('share ids for shared behaviors, each with its own wording', () => {
    const byId = (d: ComponentDocsJson) => new Map(d.behaviors!.map((b) => [b.id, b.text]));
    const s = byId(select);
    const c = byId(combobox);
    expect(s.get('close-on-escape')).toBe('Closes on Escape');
    expect(c.get('close-on-escape')).toBe('Escape closes the list');
    for (const id of ['close-on-escape', 'pick-with-enter', 'focus-after-close']) expect(s.has(id) && c.has(id)).toBe(true);
  });

  it('survive the repo formatter in place, after the anatomy', () => {
    const keys = Object.keys(JSON.parse(formatDocsJson(select)) as object);
    expect(keys.indexOf('behaviors')).toBe(keys.indexOf('anatomy') + 1);
  });
});

describe('reading and grouping', () => {
  it('keeps only well-formed entries from any docs.json', () => {
    expect(readBehaviors(null)).toEqual([]);
    expect(readBehaviors([{ id: 'a', family: 'Closing', text: 'T', keys: ['Escape', 3, ''], announces: 4, example: { c: 'Select' } }, { id: 'b' }, 7])).toEqual([
      { id: 'a', family: 'Closing', text: 'T', keys: ['Escape'], example: { c: 'Select' } },
    ]);
  });

  it('groups by family in the shared order, unknown families last', () => {
    const groups = behaviorGroups(readBehaviors(docsOf('Select').behaviors));
    expect(groups.map((g) => g.family)).toEqual(['Opening', 'Moving', 'Picking', 'Closing', 'Focus']);
    expect(groups[0]!.items.map((b) => b.id)).toEqual(['open-list', 'scroll-lock']);
    expect(behaviorGroups([{ id: 'x', family: 'Zoom', text: 'Z' }, { id: 'y', family: 'Opening', text: 'O' }]).map((g) => g.family)).toEqual(['Opening', 'Zoom']);
  });

  it('gives every Select and Combobox behavior a line for the stage', () => {
    for (const n of ['Select', 'Combobox']) expect(readBehaviors(docsOf(n).behaviors).every((b) => Boolean(b.try))).toBe(true);
  });

  it('gives agents id, family, text, keys and announcement, never the stage line or example', () => {
    const say = agentBehaviors(docsOf('Combobox').behaviors).find((b) => b.id === 'say-loading')!;
    expect(say).toEqual({ id: 'say-loading', family: 'Feedback', text: 'Says when results are loading', announces: 'Loading results' });
  });

  it('labels keys the way the Kbd reads them', () => {
    expect(['ArrowDown', 'ArrowUp', 'Escape', 'Enter', 'Tab'].map(keyLabel)).toEqual(['↓', '↑', 'Esc', 'Enter', 'Tab']);
  });

  it('labels the click-outside gesture in words and accepts it in keys', () => {
    expect(CLICK_OUTSIDE).toBe('click-outside');
    expect(keyLabel(CLICK_OUTSIDE)).toBe('Click outside');
    expect(validateBehaviors([{ id: 'close-on-outside-click', family: 'Closing', text: 'Closes on a click outside', keys: [CLICK_OUTSIDE] }])).toEqual([]);
  });
});
