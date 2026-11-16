// Flow (MVP scope): checking again right after a first pull. The MVP builds no components, so while the plugin reads
// the design system again its headline never says components are being built (seen in the Figma review recording).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openPlugin } from './ui-harness';

test('MVP: checking again after a pull never says components are being built', async () => {
  const p = await openPlugin();
  await p.click('Check for updates');
  await p.click('Apply to Figma');
  await p.until(() => p.headline() === 'Your design system is in Figma', 15000);
  const seen = new Set<string>();
  await p.click('Check again');
  for (let i = 0; i < 100; i++) {
    seen.add(p.headline());
    await p.settle(10);
  }
  assert.ok(![...seen].some((h) => /building components/i.test(h)), `headlines while checking: ${[...seen].join(' | ')}`);
});
