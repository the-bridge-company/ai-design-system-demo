// bridge_get_component gives agents a component's behaviors ({ id, family, text, keys?, announces? }) with the version
// of the package that ships their ids, said once at the top level (not again inside docs).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { BridgeContext, ops } from '../src/lib.js';
import { REPO } from './helpers.js';

let ctx: BridgeContext;
beforeAll(async () => {
  ctx = await BridgeContext.create({ root: REPO });
});

const reactVersion = (JSON.parse(readFileSync(join(REPO, 'packages/react/package.json'), 'utf8')) as { version: string }).version;

describe('bridge_get_component: behaviors', () => {
  it('returns Select behaviors in order, with the react package version', async () => {
    const s = (await ops.getComponentOp(ctx, { name: 'Select' })) as Record<string, unknown> & { behaviors?: Record<string, unknown>[]; docs?: Record<string, unknown> };
    expect(s.version).toBe(reactVersion);
    expect(s.behaviors).toHaveLength(9);
    expect(s.behaviors![0]).toEqual({ id: 'open-list', family: 'Opening', text: 'Opens a list', keys: ['Enter', 'Space', 'ArrowDown', 'ArrowUp'] });
    expect(s.behaviors!.find((b) => b.id === 'close-on-escape')).toEqual({ id: 'close-on-escape', family: 'Closing', text: 'Closes on Escape', keys: ['Escape'] });
    expect(s.docs).not.toHaveProperty('behaviors');
  });

  it('gives Combobox its own wording for a shared id, the announcement, and never the stage example', async () => {
    const c = (await ops.getComponentOp(ctx, { name: 'Combobox', include: ['accessibility'] })) as { version?: string; behaviors?: Record<string, unknown>[] };
    expect(c.version).toBe(reactVersion);
    expect(c.behaviors!.find((b) => b.id === 'close-on-escape')!.text).toBe('Escape closes the list');
    expect(c.behaviors!.find((b) => b.id === 'say-loading')).toEqual({ id: 'say-loading', family: 'Feedback', text: 'Says when results are loading', announces: 'Loading results' });
    expect(c.behaviors!.every((b) => !('example' in b))).toBe(true);
  });

  it('adds neither behaviors nor version to a component without behaviors', async () => {
    const b = await ops.getComponentOp(ctx, { name: 'Button' });
    expect(b).not.toHaveProperty('behaviors');
    expect(b).not.toHaveProperty('version');
  });
});
