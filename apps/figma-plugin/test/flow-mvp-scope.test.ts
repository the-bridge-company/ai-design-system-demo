// Flow: the plugin as it ships for the MVP (shared/scope.ts, owner decisions 2026-11-11 and 2026-11-18). Tokens both
// ways. Hidden: what is missing in Figma, Compare with code, drawing components, component requests, the Claude fix loop, Draft with
// Claude and the Claude setup card. The other flow tests open the plugin with `fullScope` to cover the hidden code.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PLUGIN_MVP_SCOPE } from '../src/shared/scope';
import { openPlugin } from './ui-harness';

test('the MVP scope is what ships', () => {
  assert.equal(PLUGIN_MVP_SCOPE, true);
});

test('MVP: Pull shows tokens only, no component and no Compare with code; Push sends variables only; no Claude anywhere', async () => {
  const p = await openPlugin({
    pulled: true,
    edit: (s) => {
      const prim = s.collections.find((c) => c.name === 'Primitives')!;
      const v = s.variables.find((x) => x.collectionId === prim.id && x.resolvedType === 'FLOAT' && /space/.test(x.name) && Object.values(x.valuesByMode)[0]!.kind === 'float')!;
      const k = Object.keys(v.valuesByMode)[0]!;
      v.valuesByMode[k] = { kind: 'float', value: (v.valuesByMode[k] as { value: number }).value + 1 };
    },
  });

  // Pull start: no Compare with code block.
  assert.ok(!p.document.querySelector('[data-block="compare"]'), 'no Compare with code');
  // Pull: tokens only. No component count, no missing list, nothing offers to build or compare.
  await p.click('Check for updates');
  await p.until(() => p.headline() !== 'Get the latest design system' && !/Checking|Reading/i.test(p.headline()));
  const text = p.text();
  assert.ok(!p.document.querySelector('[data-block="missing-in-figma"]'), 'no list of missing components');
  assert.doesNotMatch(text, /components from the code|missing in Figma|Compare with code/);
  assert.doesNotMatch(text, /Include components|New components|to add, on a "Components" page|Update all|Pull components first/);
  assert.doesNotMatch(text, /Ask Claude|Draft with Claude|Claude's fix/);
  assert.ok(!p.calls.includes('apply-components'), 'no component set is drawn');
  assert.ok(!p.calls.includes('scan-components'), 'no component of the file is read for updates');
  assert.ok(!p.calls.includes('list-components'), 'the file is not read for component names');

  // Push: the variable edit only, no component scan, no request, no drafting help.
  await p.click('Push');
  await p.click('Scan for changes');
  await p.until(() => p.headline().includes('ready to send'));
  const push = p.text();
  assert.doesNotMatch(push, /Request a component change|Not in the design system yet|Fix in Figma first|Send as a request instead/);
  assert.doesNotMatch(push, /Draft with Claude/);
  assert.ok(!p.calls.includes('scan-components'), 'component changes are not read from Figma');
  assert.equal(p.primary()?.textContent?.trim(), 'Send for review');

  // Settings: no Claude card, and the fix loop never asks Bridge anything.
  await p.click('Settings');
  await p.settle(200);
  assert.ok(!p.document.querySelector('[data-card="claude"]'), 'no Claude setup card');
  assert.ok(!p.calls.some((c) => /\/api\/fix-sessions/.test(c)), 'no fix session read');
  assert.ok(!p.calls.some((c) => c === 'POST /api/ship'), 'no approval asked before any send');
});
