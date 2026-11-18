// Flow (full scope; the MVP shows no component since 2026-11-18): Compare with code says once per component the team
// made under a code name (matched by name, Bridge's mark wins) that it cannot compare it. Nothing is drawn.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openPlugin } from './ui-harness';

test('a hand-made "Button" set and "forms/select" are matched by name; the Card Bridge drew counts by its mark', async () => {
  const p = await openPlugin({
    fullScope: true,
    pulled: true,
    components: [{ name: 'Button' }, { name: 'forms/select' }, { name: 'Card' }],
    generated: [{ componentId: 'Card', nodeId: 'g1', name: 'Card', specHash: 'old', variants: [] }],
  });
  await p.click('Check for updates');
  await p.until(() => !!p.document.querySelector('[data-block="not-drawn-by-bridge"]'));
  const notDrawn = p.document.querySelector('[data-block="not-drawn-by-bridge"]')?.textContent ?? '';
  assert.match(notDrawn, /Button/);
  assert.match(notDrawn, /Select/);
  assert.doesNotMatch(notDrawn, /Card/, 'the Card Bridge drew is matched by its mark, not by name');
  assert.match(notDrawn, /Bridge can't compare this one yet: it was not drawn by Bridge\./);
  assert.ok(!p.calls.includes('apply-components'));
});
