// Flow (MVP scope, owner decision 2026-11-19): tokens only. What is missing in Figma and Compare with code are hidden,
// code kept; flow-full-scope-1119.test.ts opens the same file with the full scope and sees them again.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openPlugin } from './ui-harness';

// The same file in both: a set the team made ("Button") and one Bridge drew before ("Card"). One plugin per test file
// (the UI module loads once).
const file = { pulled: true, components: [{ name: 'Button' }], generated: [{ componentId: 'Card', nodeId: 'g1', name: 'Card', specHash: 'old', variants: [] }] };

test('MVP: no Compare with code and no list of what is missing in Figma, and How updates work says tokens only', async () => {
  const p = await openPlugin(file);
  assert.ok(!p.document.querySelector('[data-block="compare"]'), 'no Compare with code block on the Pull start');
  assert.doesNotMatch(p.text(), /Compare with code|Compare again|See the differences/);
  const how = p.document.querySelector('[data-how="updates"]')?.textContent ?? '';
  assert.match(how, /Bridge reads the design system's tokens\./);
  assert.doesNotMatch(how, /component/i);
  await p.click('Check for updates');
  await p.until(() => p.headline() !== 'Get the latest design system' && !/Checking|Reading/i.test(p.headline()));
  const text = p.text();
  assert.doesNotMatch(text, /not in Figma yet|missing in Figma|components? from the code|found by name|Compare with code|Spec source/);
  assert.ok(!p.document.querySelector('[data-block="not-drawn-by-bridge"]'));
  assert.ok(!p.calls.includes('scan-generated'), 'no component of the file is read');
  assert.ok(!p.calls.includes('list-components'), 'the file is not read for component names');
});
