// Flow (full scope): what the MVP hides since 2026-11-19 comes back with fullScope() (PLUGIN_MVP_SCOPE false): Compare
// with code on the Pull start, and the components from the code this file does not have. flow-mvp-hidden-1119.test.ts is the MVP.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openPlugin } from './ui-harness';

// The same file in both: a set the team made ("Button") and one Bridge drew before ("Card"). One plugin per test file
// (the UI module loads once).
const file = { pulled: true, components: [{ name: 'Button' }], generated: [{ componentId: 'Card', nodeId: 'g1', name: 'Card', specHash: 'old', variants: [] }] };

test('full scope shows them again: Compare with code on the Pull start, the components from the code to add after a check', async () => {
  const p = await openPlugin({ ...file, fullScope: true });
  assert.ok(p.document.querySelector('[data-block="compare"]'), 'Compare with code block on the Pull start');
  await p.click('Check for updates');
  await p.until(() => /components? to add, on a "Components" page/.test(p.text()));
  // Compare with code after the check: the team's own "Button" is named, with why it is not compared.
  await p.until(() => !!p.document.querySelector('[data-block="not-drawn-by-bridge"]'));
  assert.match(p.document.querySelector('[data-block="not-drawn-by-bridge"]')?.textContent ?? '', /Button/);
  assert.ok(p.calls.includes('list-components'), 'the file is read for component names');
});
