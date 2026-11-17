// bridge_list_patterns and bridge_get_pattern: this repository's patterns, interactions with the components that list
// their behavior id (each in its own words), actions with their rules and real places, never the Library stage.
import { beforeAll, describe, expect, it } from 'vitest';
import { BridgeContext, ops } from '../src/lib.js';
import { REPO } from './helpers.js';
import { parseConfig } from '../src/config.js';
import { getPattern, listPatterns } from '../src/patterns.js';
import type { RepoSource } from '../src/source.js';

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

describe('a place in a product of its own repository', () => {
  const place = (product: string) => ({ screen: 'Contacts', label: 'Delete contact', product, file: 'src/contacts/Row.tsx', match: 'Delete contact' });
  const pattern = (id: string, product: string) =>
    JSON.stringify({ id, kind: 'action', name: id, purpose: 'Removes it.', reversible: false, rules: ['Ask first.'], components: ['Button'], usedIn: [{ screen: 'Settings', label: 'Delete', file: 'a.ts', match: 'Delete' }, place(product)] });
  const files: Record<string, string> = { 'patterns/delete.pattern.json': pattern('delete', 'crm'), 'patterns/remove.pattern.json': pattern('remove', 'shop') };
  const source: RepoSource = { kind: 'local', label: 'acme', list: async (prefix = '') => Object.keys(files).filter((f) => f.startsWith(prefix)), read: async (p) => files[p] ?? null };
  const config = parseConfig({ repo: { owner: 'acme-design-demo', name: 'acme-ds' }, products: [{ key: 'crm', name: 'CRM', repo: 'acme-design-demo/acme-crm' }, { key: 'library', name: 'Library', default: true }] });

  it('gives agents the product name and repository, and reports an unknown product key', async () => {
    const p = (await getPattern(source, config, { id: 'delete' })) as { usedIn: Record<string, unknown>[] };
    expect(p.usedIn[1]).toEqual({ ...place('crm'), productName: 'CRM', repo: 'acme-design-demo/acme-crm' });
    expect(p.usedIn[0]).not.toHaveProperty('product');
    const list = await listPatterns(source, config, {});
    expect(list.patterns.map((x) => x.id)).toEqual(['delete']);
    expect(list.problems).toEqual([expect.stringMatching(/^patterns\/remove\.pattern\.json: usedIn\.1\.product: bridge\.config\.json products has no "shop"/)]);
  });
});
