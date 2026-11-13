// @vitest-environment jsdom
// Layout contracts of the token explorer (styles/token-explorer.css, scripts/explorer/cells.ts) that a screenshot
// review caught breaking: the value previews are one fixed box that never stretches with the row or spills out of the
// Studio edit pill, every Studio value starts on one column, the frame hugs short lists up to the viewport, and the
// cell editor lines every part up on the footer's padding.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildTokenSet, layoutOptions, loadConfig } from '@bridge-ds/core';
import { buildTokens, modesOf, type Column, type UsageMap } from '../../lib/explorer/model';
import { preview, studioCellHtml } from './cells';
import type { ExplorerData } from './types';

const css = readFileSync(join(__dirname, '../../styles/token-explorer.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const exploration = readFileSync(join(__dirname, '../../styles/exploration-page.css'), 'utf8');

/** Declarations of the top-level rule whose selector list is exactly `selector` (outside media queries). */
function rule(selector: string): Record<string, string> {
  const top = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  for (const m of top.matchAll(re)) {
    if (m[1]!.trim().replace(/\s+/g, ' ') !== selector) continue;
    return Object.fromEntries(
      m[2]!
        .split(';')
        .map((d: string) => d.trim())
        .filter(Boolean)
        .map((d: string) => [d.slice(0, d.indexOf(':')).trim(), d.slice(d.indexOf(':') + 1).trim()]),
    );
  }
  throw new Error(`no rule ${selector}`);
}

const ramp = (hexes: string[]) =>
  Object.fromEntries(hexes.map((hex, i) => [String((i + 1) * 100), { $type: 'color', $value: { colorSpace: 'srgb', components: [0, 0, 0], hex } }]));
const set = buildTokenSet(
  {
    'primitives/all.tokens.json': JSON.stringify({
      palette: { neutral: ramp(['#ffffff', '#111111']) },
      color: { bg: { default: { $type: 'color', $value: '{palette.neutral.100}' } }, surface: { default: { $type: 'color', $value: '{palette.neutral.100}' } } },
      shadow: { raised: { $type: 'shadow', $value: { color: '#00000033', offsetX: { value: 0, unit: 'px' }, offsetY: { value: 2, unit: 'px' }, blur: { value: 4, unit: 'px' }, spread: { value: 0, unit: 'px' } } } },
      motion: {
        easing: { standard: { $type: 'cubicBezier', $value: [0.2, 0, 0, 1] } },
        duration: { fast: { $type: 'duration', $value: { value: 150, unit: 'ms' } }, slow: { $type: 'duration', $value: { value: 900, unit: 'ms' } } },
      },
      radius: { control: { $type: 'dimension', $value: { value: 6, unit: 'px' } } },
      border: { width: { thin: { $type: 'dimension', $value: { value: 2, unit: 'px' } } } },
      space: { '4': { $type: 'dimension', $value: { value: 16, unit: 'px' } } },
      opacity: { muted: { $type: 'number', $value: 0.5 } },
    }),
  },
  layoutOptions(loadConfig('{}')),
);
const paths = [...set.byPath.keys()];
const usage: UsageMap = Object.fromEntries(paths.map((p) => [p, { used: false, usedBy: [], styles: [] }]));
const tokens = buildTokens(set, usage);
const modes = modesOf(set);
const ctx = { brand: modes.brands[0] ?? 'bridge', theme: modes.themes[0] ?? 'light', density: modes.densities[0] ?? 'comfortable' };
const col: Column = { key: 'value', label: 'Value', ctx };
const d: ExplorerData = { set, head: set, tokens, byPath: new Map(tokens.map((t) => [t.path, t])), usage, pairs: [], results: [], before: [], modes };
const mount = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
};

describe('Value previews', () => {
  it('are one fixed box: border-box, never shrinking or growing, clipped, and not the exploration page stage class', () => {
    const base = rule('.xp-thumb');
    expect(base['box-sizing']).toBe('border-box');
    expect(base.flex).toBe('none');
    expect(base.overflow).toBe('hidden');
    expect(base.padding).toBe('0');
    // Studio rows: the DS size 6 square (24px) for every preview, the color swatch included.
    const studio = rule('.xp[data-surface="app"] .xp-grid .xp-thumb, .xp[data-surface="app"] .xp-grid .xp-ms');
    expect(studio.width).toBe('var(--size-6)');
    expect(studio.height).toBe('var(--size-6)');
    // The exploration page's padded `.xp-stage` leaked into the cells: the explorer no longer uses that name.
    expect(exploration).toMatch(/\.xp-stage\b/);
    expect(css).not.toMatch(/\.xp-stage\b/);
  });

  it('every Studio value cell has exactly one preview slot before its value, empty for types without a picture', () => {
    for (const p of ['color.bg.default', 'shadow.raised', 'motion.easing.standard', 'motion.duration.fast', 'radius.control', 'border.width.thin', 'space.4', 'opacity.muted']) {
      const field = mount(studioCellHtml(d, p, col, false)).querySelector('.xp-field')!;
      const lead = field.firstElementChild!;
      expect(lead.matches('.xp-thumb, .xp-ms'), p).toBe(true);
      expect(field.querySelectorAll('.xp-thumb, .xp-ms'), p).toHaveLength(1);
    }
    expect(mount(studioCellHtml(d, 'space.4', col, false)).querySelector('.xp-thumb.is-empty')).not.toBeNull();
  });

  it('draws motion and shadows: the bezier curve, a duration bar to scale, a card of the column surface with the shadow', () => {
    const curve = mount(preview(d, 'cubicBezier', 'motion.easing.standard', { resolved: [0.2, 0, 0, 1], css: '', raw: [0.2, 0, 0, 1], line: '' } as never, col));
    expect(curve.querySelector('.xp-thumb svg path.xp-curve')?.getAttribute('d')).toMatch(/^M0 20 C/);
    const bar = (ms: number) =>
      mount(preview(d, 'duration', 'motion.duration.fast', { resolved: { value: ms, unit: 'ms' }, css: `${ms}ms`, raw: {}, line: '' } as never, col)).querySelector<HTMLElement>('.xp-dur i')!.style.width;
    expect(bar(150)).toBe('30%');
    expect(bar(900)).toBe('100%');
    expect(bar(0)).toBe('8%');
    const shadow = mount(studioCellHtml(d, 'shadow.raised', col, false)).querySelector<HTMLElement>('.xp-thumb.is-shadow .xp-card')!;
    expect(shadow.style.boxShadow).not.toBe('');
    expect(shadow.style.backgroundColor).not.toBe('');
  });

  it('the chevron keeps its room at rest, so the end value does not move on hover', () => {
    expect(rule('.xp[data-mode="edit"] .xp-field-chev')).toMatchObject({ display: 'block', visibility: 'hidden' });
  });
});

describe('Explorer frame', () => {
  it('hugs its content up to the viewport height (max-height, no fixed or minimum height), the rows scroll inside', () => {
    for (const sel of ['.xp', '.xp[data-surface="app"]']) {
      const r = rule(sel);
      expect(r['max-height'], sel).toMatch(/100dvh/);
      expect(r.height, sel).toBeUndefined();
      expect(r['min-height'], sel).toBeUndefined();
    }
    expect(rule('.xp')['grid-template-rows']).toBe('minmax(0, 1fr)');
    expect(rule('.xp[data-surface="app"], .xp[data-surface="app"].has-detail')['max-height']).toMatch(/100dvh/);
    expect(rule('.xp-scroll')).toMatchObject({ 'min-height': '0', overflow: 'auto' });
    expect(css).not.toMatch(/size-140/);
  });
});

describe('Cell editor spacing', () => {
  it('every part sits on the footer padding; More keeps a DS gap from the tabs', () => {
    expect(rule('.xe-pop')['--xe-pad']).toBe('var(--space-4)');
    expect(rule('.xe-foot').padding).toBe('var(--space-3) var(--xe-pad)');
    for (const sel of ['.xe-title', '.xe-pick', '.xe-ramp-host']) expect(rule(sel).padding, sel).toBe('var(--space-3) var(--xe-pad) 0');
    for (const sel of ['.xe-families', '.xe-status', '.xe-more', '.xe-pop-pv']) expect(rule(sel).margin, sel).toBe('var(--space-3) var(--xe-pad) 0');
    expect(rule('.xe-family-host').gap).toBe('var(--space-2)');
    // Ramp tiles: a 32px swatch, the step number at the caption size (12px).
    expect(rule('.xe-tile-sw')).toMatchObject({ width: 'var(--size-8)', height: 'var(--size-8)' });
    expect(rule('.xe-tile-step')['font-size']).toBe('var(--typography-caption-size)');
  });
});
