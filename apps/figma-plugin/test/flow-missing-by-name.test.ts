// Flow (MVP scope): what is missing in Figma counts the team's own components by name, Bridge's mark wins, and
// Compare with code says once per name-only component that it cannot compare it. Nothing is drawn.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openPlugin } from './ui-harness';

test('a hand-made "Button" set and "forms/select" are in Figma; Badge is missing; the Card Bridge drew counts by its mark', async () => {
  const p = await openPlugin({
    pulled: true,
    components: [{ name: 'Button' }, { name: 'forms/select' }, { name: 'Card' }],
    generated: [{ componentId: 'Card', nodeId: 'g1', name: 'Card', specHash: 'old', variants: [] }],
  });
  await p.click('Check for updates');
  await p.until(() => !!p.document.querySelector('[data-block="present-by-name"]'));
  const missing = p.document.querySelector('[data-block="missing-in-figma"]')?.textContent ?? '';
  const byName = p.document.querySelector('[data-block="present-by-name"]')?.textContent ?? '';
  assert.match(p.text(), /3 of \d+ components from the code are in this file/);
  assert.match(byName, /2 components found by name/);
  assert.match(byName, /Button/);
  assert.match(byName, /Select \(forms\/select in Figma\)/);
  assert.doesNotMatch(byName, /Card/, 'the Card Bridge drew is matched by its mark, not by name');
  assert.match(missing, /Badge/);
  assert.doesNotMatch(missing, /\bButton\b|\bSelect\b|\bCard\b/);

  // Compare with code: the name-only ones say why they are not compared; nothing is drawn.
  const notDrawn = p.document.querySelector('[data-block="not-drawn-by-bridge"]')?.textContent ?? '';
  assert.match(notDrawn, /Button/);
  assert.match(notDrawn, /Bridge can't compare this one yet: it was not drawn by Bridge\./);
  assert.ok(!p.calls.includes('apply-components'));
});
