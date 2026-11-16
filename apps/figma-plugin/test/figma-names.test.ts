// What is missing in Figma, by name: the team's own components count, Bridge's mark wins (sync/figma-names.ts).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeComponentName, presenceInFigma } from '../src/sync/figma-names';

test('names match across case, spaces, hyphens, underscores and a path prefix', () => {
  for (const n of ['Select', 'select', 'Forms/Select', 'forms/select', ' Forms / Select ']) assert.equal(normalizeComponentName(n), 'select');
  for (const n of ['IconButton', 'Icon Button', 'icon-button', 'icon_button', 'Actions/Icon Button']) assert.equal(normalizeComponentName(n), 'iconbutton');
});

test('a hand-made Button and forms/select are present, a missing one is listed, the mark wins', () => {
  const x = presenceInFigma(
    ['Button', 'Select', 'Badge', 'Card'],
    ['Card'],
    [
      { name: 'Button', nodeId: '1:1' },
      { name: 'forms/select', nodeId: '1:2' },
      { name: 'Card', nodeId: '1:3' }, // a hand-made Card next to the one Bridge drew: the mark counts, not the name
      { name: 'Card', nodeId: '9:9', componentId: 'Card' },
    ],
  );
  assert.deepEqual(x.marked, ['Card']);
  assert.deepEqual(x.byName.map((m) => [m.name, m.figmaName]), [['Button', 'Button'], ['Select', 'forms/select']]);
  assert.deepEqual(x.missing, ['Badge']);
});

test('a set Bridge drew is never matched by its name for another code component', () => {
  const x = presenceInFigma(['Tag'], [], [{ name: 'Tag', nodeId: '2:1', componentId: 'Badge' }]);
  assert.deepEqual(x.missing, ['Tag']);
});
