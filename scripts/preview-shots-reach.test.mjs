// Who gets it, the robot's pure parts (scripts/preview-shots.mjs measureReach): which screens of a product, which
// values a library change sets, when to measure again.
import { describe, expect, it } from 'vitest';
import { changeState, cssValueOf, fileModes, productAddress, REACH_MAX_AGE_MS, reachDue, reachProducts, routeSegments, screenTargets, tokenFilesOf, tokenOverrides } from './preview-shots.mjs';
import { reachProductsOf } from './private-shots.mjs';

describe('who gets it: the screens of a product', () => {
  const links = [
    { href: '#main', text: 'Skip to content' },
    { href: '#/', text: 'Dashboard' },
    { href: '#/orders', text: 'Orders30' },
    { href: '#/products', text: 'Products' },
    { href: '#/orders', text: 'Orders52+24%vs previous 30 days' },
    { href: '#/orders/103', text: 'Caleigh Littel' },
    { href: '#/orders/65', text: 'Celestine' },
    { href: '#/categories', text: 'Categories' },
    { href: '#/categories/3/show', text: 'Prints' },
    { href: 'https://elsewhere.example/', text: 'Help' },
    { href: '/logout', text: 'Sign out' },
    { href: '/export.csv', text: 'Export' },
  ];

  it('takes the sections of the navigation in order, then one detail page per section, never elsewhere', () => {
    const t = screenTargets(links, 'https://acme-prints.pages.dev/?tenant=acme');
    expect(t.map((x) => [x.url, x.title])).toEqual([
      ['https://acme-prints.pages.dev/?tenant=acme#/orders', 'Orders'],
      ['https://acme-prints.pages.dev/?tenant=acme#/products', 'Products'],
      ['https://acme-prints.pages.dev/?tenant=acme#/categories', 'Categories'],
      ['https://acme-prints.pages.dev/?tenant=acme#/orders/103', 'Order detail'],
      ['https://acme-prints.pages.dev/?tenant=acme#/categories/3/show', 'Category detail'],
    ]);
    // The first page itself counts in the cap.
    expect(screenTargets(links, 'https://acme-prints.pages.dev/', 3)).toHaveLength(2);
    expect(routeSegments(new URL('https://x.dev/?t=1#/orders/12?tab=a'))).toEqual(['orders', '12']);
  });
});

describe('who gets it: the values a change sets', () => {
  const color = (hex) => ({ $type: 'color', $value: { colorSpace: 'srgb', components: [0, 0, 0], hex } });
  const file = (path, before, after) => ({ path, before: JSON.stringify(before), after: JSON.stringify(after) });
  const modes = { brand: { values: ['bridge', 'ocean'], default: 'bridge' }, theme: { values: ['light', 'dark'], default: 'light' } };

  it('sets every token whose value changed, as its CSS variable, where its file applies', () => {
    const o = tokenOverrides(
      [
        file('packages/tokens/src/primitives/color.tokens.json', { color: { harbor: { 700: color('#0b4a8b'), 800: color('#083a6e') } } }, { color: { harbor: { 700: color('#0a4380'), 800: color('#083a6e'), 900: color('#062a50') } } }),
        file('packages/tokens/src/semantic/dark.tokens.json', { color: { text: { muted: { $type: 'color', $value: '{palette.neutral.400}' } } } }, { color: { text: { muted: { $type: 'color', $value: '{palette.neutral.300}' } } } }),
        file('packages/tokens/src/brands/bridge.tokens.json', { radius: { container: { $type: 'dimension', $value: { value: 20, unit: 'px' } } } }, { radius: { container: { $type: 'dimension', $value: { value: 16, unit: 'px' } } } }),
      ],
      { modes, cssVar: { prefix: '--', separator: '-' } },
    );
    expect(o.css).toBe(
      [':root { --color-harbor-700: #0a4380 !important; }', '[data-theme="dark"] { --color-text-muted: var(--palette-neutral-300) !important; }', '[data-brand="bridge"] { --radius-container: 16px !important; }'].join('\n'),
    );
    expect(o).toMatchObject({ changed: 3, added: 1, removed: 0, theme: 'light' });
    expect(changeState(o)).toBe('measured');
  });

  it('measures a change to dark values only in the dark theme, and a change that only adds as new', () => {
    const dark = tokenOverrides([file('src/semantic/dark.tokens.json', { a: { $type: 'color', $value: '{b}' } }, { a: { $type: 'color', $value: '{c}' } })], { modes });
    expect(dark.theme).toBe('dark');
    const added = tokenOverrides([file('src/semantic/base.tokens.json', { a: { $value: 1 } }, { a: { $value: 1 }, b: { $value: 2 } })], { modes });
    expect(changeState(added)).toBe('new');
    expect(added.css).toBe('');
    const typography = tokenOverrides([file('src/semantic/base.tokens.json', { t: { $type: 'typography', $value: { fontSize: 1 } } }, { t: { $type: 'typography', $value: { fontSize: 2 } } })], { modes });
    expect(changeState(typography)).toBe('unmeasured');
  });

  it('writes token values as CSS, and nothing it cannot write safely', () => {
    expect(cssValueOf({ colorSpace: 'srgb', components: [1, 0, 0], hex: '#ff0000', alpha: 0.5 }, 'color')).toBe('#ff000080');
    expect(cssValueOf({ colorSpace: 'srgb', components: [1, 0, 0] }, 'color')).toBe('rgb(255 0 0)');
    expect(cssValueOf({ value: 150, unit: 'ms' }, 'duration')).toBe('150ms');
    expect(cssValueOf(['Instrument Sans', 'system-ui'], 'fontFamily')).toBe('"Instrument Sans", system-ui');
    expect(cssValueOf([0.2, 0, 0, 1], 'cubicBezier')).toBe('cubic-bezier(0.2, 0, 0, 1)');
    expect(cssValueOf({ offsetX: { value: 0, unit: 'px' }, offsetY: { value: 2, unit: 'px' }, blur: { value: 4, unit: 'px' }, spread: { value: 0, unit: 'px' }, color: '{shadow.color}' }, 'shadow')).toBe('0px 2px 4px 0px var(--shadow-color)');
    expect(cssValueOf({ fontFamily: 'x', fontSize: 1 }, 'typography')).toBeNull();
    expect(cssValueOf('red; } body { display: none', 'color')).toBeNull();
    expect(fileModes('brands/ocean.dark.tokens.json', modes)).toEqual({ brand: 'ocean', theme: 'dark' });
    expect(fileModes('primitives/color.tokens.json', modes)).toEqual({});
  });

  it('reads only the token files a change modifies, under the tokens root', () => {
    const files = [
      { filename: 'packages/tokens/src/brands/bridge.tokens.json', status: 'modified' },
      { filename: 'packages/tokens/src/brands/forest.tokens.json', status: 'added' },
      { filename: '.changeset/x.md', status: 'added' },
      { filename: 'other/a.tokens.json', status: 'modified' },
    ];
    expect(tokenFilesOf(files, 'packages/tokens/src')).toEqual(['packages/tokens/src/brands/bridge.tokens.json']);
  });
});

describe('who gets it: when to measure again, and where', () => {
  const now = Date.parse('2026-11-10T12:00:00Z');
  const products = [{ key: 'prints', url: 'https://acme-prints.pages.dev' }];
  const changes = [{ repo: 'acme/ds', pr: 13, sha: 'a1' }];
  const stored = { measuredAt: new Date(now - 3600_000).toISOString(), products, changes };

  it('measures when never measured, a day old, or when a change or a product address moved', () => {
    expect(reachDue(null, { products, changes }, now)).toBe(true);
    expect(reachDue(stored, { products, changes }, now)).toBe(false);
    expect(reachDue(stored, { products, changes }, now, true)).toBe(true);
    expect(reachDue({ ...stored, measuredAt: new Date(now - REACH_MAX_AGE_MS - 1).toISOString() }, { products, changes }, now)).toBe(true);
    expect(reachDue(stored, { products, changes: [{ ...changes[0], sha: 'b2' }] }, now)).toBe(true);
    expect(reachDue(stored, { products, changes: [] }, now)).toBe(true);
    expect(reachDue(stored, { products: [{ key: 'prints', url: 'https://other.dev' }], changes }, now)).toBe(true);
  });

  it('measures a product at its live address, else its preview of the default branch', () => {
    const previewUrl = (t, { branch }) => t.replace('{branch}', branch);
    expect(productAddress({ production: 'https://acme-prints.pages.dev', preview: 'https://{branch}.x.dev' }, previewUrl)).toBe('https://acme-prints.pages.dev');
    expect(productAddress({ preview: 'https://{branch}.x.dev' }, previewUrl)).toBe('https://main.x.dev');
    expect(productAddress({ preview: 'http://{branch}.x.dev' }, previewUrl)).toBeNull();
    expect(reachProducts({ products: [{ key: 'library', name: 'Library', default: true }, { key: 'prints', name: 'Acme Prints', repo: 'acme/prints', production: 'https://p.dev' }, { key: 'x', name: 'X' }] }, previewUrl)).toEqual([
      { key: 'prints', name: 'Acme Prints', repo: 'acme/prints', url: 'https://p.dev' },
    ]);
    expect(reachProductsOf({ products: [{ key: 'a', url: 'https://a.dev' }, { key: 'b', url: null, template: 'https://{branch}.b.dev', branch: 'main' }, { key: 'c', url: null, template: null }] }, previewUrl).map((p) => p.url)).toEqual(['https://a.dev', 'https://main.b.dev']);
  });
});
