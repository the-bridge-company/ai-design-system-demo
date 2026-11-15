// bridge_list_patterns and bridge_get_pattern: this repository's patterns, interactions with the components that list
// their behavior id (each in its own words), actions with their rules and real places, never the Library stage.
import { beforeAll, describe, expect, it } from 'vitest';
import { BridgeContext, ops } from '../src/lib.js';
import { REPO } from './helpers.js';

let ctx: BridgeContext;
beforeAll(async () => {
  ctx = await BridgeContext.create({ root: REPO });
});

describe('bridge_list_patterns', () => {
  it('lists interactions then actions, each with its kind', async () => {
    const r = (await ops.listPatternsOp(ctx, {})) as { patterns: { id: string; kind: string }[]; kinds: string[] };
    expect(r.kinds).toEqual(['interaction', 'action']);
    const kinds = r.patterns.map((p) => p.kind);
    expect(kinds.lastIndexOf('interaction')).toBeLessThan(kinds.indexOf('action'));
    expect(r.patterns.map((p) => p.id)).toEqual(expect.arrayContaining(['close-on-escape', 'delete', 'send-for-review']));
  });

  it('keeps one kind when asked', async () => {
    const r = (await ops.listPatternsOp(ctx, { kind: 'action' })) as { patterns: { kind: string }[] };
    expect(r.patterns.every((p) => p.kind === 'action')).toBe(true);
  });
});

describe('bridge_get_pattern', () => {
  it('gives an interaction its components in their own words', async () => {
    const p = (await ops.getPatternOp(ctx, { id: 'close-on-escape' })) as { kind: string; components: { component: string; text: string }[] };
    expect(p.kind).toBe('interaction');
    expect(p.components).toEqual([
      { component: 'Combobox', text: 'Escape closes the list', keys: ['Escape'] },
      { component: 'Select', text: 'Closes on Escape', keys: ['Escape'] },
    ]);
  });

  it('gives an action its rules, components and places, without the stage', async () => {
    const p = (await ops.getPatternOp(ctx, { id: 'Delete' })) as Record<string, unknown> & { reversible: boolean; components: string[]; usedIn: unknown[] };
    expect(p.kind).toBe('action');
    expect(p.reversible).toBe(false);
    expect(p.components).toEqual(['Button', 'AlertDialog']);
    expect(p.usedIn.length).toBeGreaterThanOrEqual(2);
    expect(p).not.toHaveProperty('stage');
  });

  it('names the known ids when the pattern does not exist', async () => {
    await expect(ops.getPatternOp(ctx, { id: 'teleport' })).rejects.toThrow(/No pattern "teleport". Known: .*delete/);
  });
});
