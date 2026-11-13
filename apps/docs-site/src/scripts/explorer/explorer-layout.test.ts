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
import { cellLabel, preview, studioCellHtml } from './cells';
import type { ExplorerData } from './types';

const css = readFileSync(join(__dirname, '../../styles/token-explorer.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const exploration = readFileSync(join(__dirname, '../../styles/exploration-page.css'), 'utf8');

/**
 * Declarations of the top-level rules whose selector list is exactly `selector` (outside media queries), merged in
 * source order as the cascade does (a later rule's declaration wins).
 */
function rule(selector: string): Record<string, string> {
  const top = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let found = false;
  const out: Record<string, string> = {};
  for (const m of top.matchAll(re)) {
    if (m[1]!.trim().replace(/\s+/g, ' ') !== selector) continue;
    found = true;
    for (const d of m[2]!.split(';').map((x: string) => x.trim()).filter(Boolean)) out[d.slice(0, d.indexOf(':')).trim()] = d.slice(d.indexOf(':') + 1).trim();
  }
  if (!found) throw new Error(`no rule ${selector}`);
  return out;
}

const ramp = (hexes: string[]) =>
  Object.fromEntries(hexes.map((hex, i) => [String((i + 1) * 100), { $type: 'color', $value: { colorSpace: 'srgb', components: [0, 0, 0], hex } }]));
const set = buildTokenSet(
  {
    'primitives/all.tokens.json': JSON.stringify({
      palette: { neutral: ramp(['#ffffff', '#111111', '#eeeeee']) },
      color: { bg: { default: { $type: 'color', $value: '{palette.neutral.100}' }, subtle: { $type: 'color', $value: '{palette.neutral.300}' } }, surface: { default: { $type: 'color', $value: '{palette.neutral.100}' } } },
      shadow: { raised: { $type: 'shadow', $value: { color: '#00000033', offsetX: { value: 0, unit: 'px' }, offsetY: { value: 2, unit: 'px' }, blur: { value: 4, unit: 'px' }, spread: { value: 0, unit: 'px' } } } },
      motion: {
        easing: { standard: { $type: 'cubicBezier', $value: [0.16, 1, 0.3, 1] }, emphasized: { $type: 'cubicBezier', $value: '{motion.easing.standard}' } },
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
    // The column's surface card on the column's subtle background: never white on white.
    expect(shadow.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(shadow.parentElement!.style.backgroundColor).toBe('rgb(238, 238, 238)');
  });

  it('the chevron keeps its room at rest, so the end value does not move on hover', () => {
    expect(rule('.xp[data-mode="edit"] .xp-field-chev')).toMatchObject({ display: 'block', visibility: 'hidden' });
  });

  it('the token name always shows whole; only the resolved value gives way (ellipsis), with the whole text on the title', () => {
    expect(rule('.xp-field')).toMatchObject({ 'min-width': '0', overflow: 'hidden' });
    // The alias never shrinks (flex: none); it ellipsizes only past the whole pill width.
    expect(rule('.xp-field-main')).toMatchObject({ flex: 'none', 'max-width': '100%', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' });
    // The resolved value is the one that shrinks.
    expect(rule('.xp-field-end')).toMatchObject({ flex: '0 1 auto', 'min-width': '0', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' });
  });

  it('an easing reads as its curve and its four numbers, not cubic-bezier(...) cut in two; title and label keep it whole', () => {
    const aliased = mount(studioCellHtml(d, 'motion.easing.emphasized', col, false)).querySelector<HTMLElement>('.xp-field')!;
    expect(aliased.querySelector('.xp-thumb.is-curve svg')).not.toBeNull();
    expect(aliased.querySelector('.xp-field-main')?.textContent).toBe('easing.standard');
    expect(aliased.querySelector('.xp-field-end')?.textContent).toBe('0.16, 1, 0.3, 1');
    expect(aliased.title).toBe('easing.standard cubic-bezier(0.16, 1, 0.3, 1)');
    // Voice control finds the cell by what it shows: the label starts with the visible text.
    expect(cellLabel(d, 'motion.easing.emphasized', col, true)).toMatch(/^easing\.standard 0\.16, 1, 0\.3, 1, Value/);
    const literal = mount(studioCellHtml(d, 'motion.easing.standard', col, false)).querySelector<HTMLElement>('.xp-field')!;
    expect(literal.querySelector('.xp-field-main')?.textContent).toBe('0.16, 1, 0.3, 1');
    expect(literal.title).toBe('cubic-bezier(0.16, 1, 0.3, 1)');
  });

  it('an easing stacks: its numbers on their own line under the name, wrapping rather than ellipsized, one space between', () => {
    const field = mount(studioCellHtml(d, 'motion.easing.emphasized', col, false)).querySelector<HTMLElement>('.xp-field')!;
    expect(field.classList.contains('is-stack')).toBe(true);
    const text = field.querySelector('.xp-field-text')!;
    expect(text.querySelector('.xp-field-main + .xp-field-end')).not.toBeNull();
    expect(text.textContent).toBe('easing.standard 0.16, 1, 0.3, 1');
    expect(field.textContent).not.toMatch(/\s{2}/);
    expect(rule('.xp[data-surface="app"] .xp-field.is-stack .xp-field-end')).toMatchObject({ flex: '1 0 100%', 'white-space': 'normal', overflow: 'visible' });
    expect(rule('.xp-field.is-stack')).toMatchObject({ height: 'auto', 'min-height': 'var(--size-8)' });
  });
});

/** Declarations of `selector` inside every `@media <query>` block (later blocks win, as in the cascade). */
function mediaRule(query: string, selector: string): Record<string, string> {
  const out: Record<string, string> = {};
  const head = `@media ${query} {`;
  for (let i = css.indexOf(head); i !== -1; i = css.indexOf(head, i + 1)) {
    let depth = 0;
    let j = i + head.length - 1;
    do {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    } while (depth > 0 && j < css.length);
    const inner = css.slice(i + head.length, j - 1);
    for (const m of inner.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (m[1]!.trim().replace(/\s+/g, ' ') !== selector) continue;
      for (const d of m[2]!.split(';').map((x: string) => x.trim()).filter(Boolean)) out[d.slice(0, d.indexOf(':')).trim()] = d.slice(d.indexOf(':') + 1).trim();
    }
  }
  return out;
}

describe('Studio toolbar (type filter)', () => {
  it('desktop (861px and up): one row inside its container; the search grows but never under size 40, the types give way and scroll, Options stays', () => {
    const q = '(min-width: 861px)';
    expect(mediaRule(q, '.xp[data-surface="app"] .xp-search')).toMatchObject({ flex: '1 0 calc(var(--size-40) + var(--size-12))', 'min-width': 'calc(var(--size-40) + var(--size-12))' });
    // The types keep their natural width when it fits, and shrink (their DS track scrolls with the edge fade) when not.
    expect(mediaRule(q, '.xp[data-surface="app"] .xp-chips')).toMatchObject({ flex: '0 1 auto', 'min-width': '0' });
    expect(mediaRule(q, '.xp[data-surface="app"] .xp-options')).toMatchObject({ flex: 'none' });
    expect(mediaRule(q, '.xp[data-surface="app"] .xp-tools .xp-grow')).toMatchObject({ display: 'none' });
    expect(rule('.xp-types')).toMatchObject({ 'min-width': '0', 'max-width': '100%' });
    expect(rule('.xp[data-surface="app"] .xp-tools')['min-width']).toBe('0');
  });

  it('phone: the types wrap onto a second row; never on a desktop', () => {
    expect(mediaRule('(max-width: 640px)', '.xp-types [data-segment-track]')).toMatchObject({ 'flex-wrap': 'wrap', 'overflow-x': 'visible' });
    expect(() => rule('.xp-types [data-segment-track]')).toThrow();
    expect(mediaRule('(min-width: 861px)', '.xp-types [data-segment-track]')).toEqual({});
  });
});

describe('Hex values', () => {
  it('are never cut: the hex keeps its width and the mode column keeps room for preview, palette name, hex and chevron', async () => {
    const { modeMin, gridTemplate } = await import('./grid');
    // 24px preview + "categorical.950" (15 mono chars at 14px) + "#rrggbb" + chevron, gaps and padding: about 16.5rem.
    expect(modeMin({ mode: 'edit', flat: false })).toBeGreaterThanOrEqual(17);
    expect(modeMin({ mode: 'read', flat: true })).toBeGreaterThanOrEqual(16);
    expect(gridTemplate({ columns: [col, col] } as never, { mode: 'edit', flat: false, showCode: false, showDescription: false } as never)).toContain('minmax(17rem, 1fr) minmax(17rem, 1fr)');
    expect(rule('.xp-field.is-color .xp-field-end')).toMatchObject({ flex: 'none' });
    expect(mount(studioCellHtml(d, 'color.bg.default', col, true)).querySelector('.xp-field.is-color .xp-field-end')?.textContent).toBe('#ffffff');
    // The details panel open never hides the hex any more: the table scrolls sideways instead.
    expect(css).not.toMatch(/has-detail \.xp-field-end\s*\{\s*display: none/);
  });
});

describe('Name column', () => {
  it('keeps a typical name on one line: a min width, ellipsis and the full path on hover beyond it; wraps at dots only on a phone', async () => {
    const { nameMin, gridTemplate } = await import('./grid');
    expect(nameMin({ mode: 'edit', flat: false })).toBeGreaterThanOrEqual(15);
    expect(nameMin({ mode: 'read', flat: true })).toBeGreaterThanOrEqual(15);
    expect(gridTemplate({ columns: [col, col] } as never, { mode: 'edit', flat: false, showCode: false, showDescription: false } as never)).toMatch(/^minmax\(15rem, 1\.6fr\) /);
    expect(rule('.xp[data-surface="app"] .xp-name-main')).toMatchObject({ overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' });
    expect(mediaRule('(max-width: 640px)', '.xp[data-surface="app"] .xp-name-main')).toMatchObject({ 'white-space': 'normal' });
  });

  it('every Studio name cell: the full path as title, one line without break points on a desktop, a dot-wrapped copy only on a phone', async () => {
    const { renderGrid } = await import('./grid');
    const host = document.createElement('div');
    document.body.append(host);
    const visible = tokens.filter((t) => t.path.startsWith('color.') || t.path.startsWith('motion.'));
    const s = { mode: 'read', flat: true, selection: { lens: 'collections', tier: 'all' }, collapsed: new Set(), showCode: false, showDescription: false, syntax: 'css', selected: visible[0]!.path } as never;
    renderGrid(host, d, { visible, columns: [col] } as never, s, { sync: true });
    const names = [...host.querySelectorAll<HTMLElement>('.xp-td.is-name .xp-name-main')];
    expect(names.length).toBe(visible.length);
    for (const [i, n] of names.entries()) {
      expect(n.title, visible[i]!.path).toBe(visible[i]!.path);
      const line = n.querySelector('.xp-name-line')!;
      expect(line.textContent).toBe(visible[i]!.path);
      expect(line.querySelector('wbr')).toBeNull();
      expect(n.querySelector('.xp-name-wrap')?.innerHTML).toBe(visible[i]!.path.replace(/\./g, '.<wbr>'));
    }
    host.remove();
  });

  it('no rule outside the phone breakpoint lets a Studio name wrap, in any row state (selected, hovered, row menu shown)', () => {
    const outsidePhone = css.replace(/@media \(max-width: 640px\) \{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
    for (const m of outsidePhone.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (!/xp-name(-main|-line)?\b|is-name/.test(m[1]!)) continue;
      expect(m[2], m[1]!.trim()).not.toMatch(/white-space:\s*(normal|pre-wrap|break-spaces)/);
    }
    expect(rule('.xp[data-surface="app"] .xp-name-main')).toMatchObject({ 'min-width': '0', overflow: 'hidden', 'text-overflow': 'ellipsis', 'white-space': 'nowrap' });
    expect(rule('.xp[data-surface="app"] .xp-name-wrap')).toMatchObject({ display: 'none' });
    expect(mediaRule('(max-width: 640px)', '.xp[data-surface="app"] .xp-name-line')).toMatchObject({ display: 'none' });
    expect(mediaRule('(max-width: 640px)', '.xp[data-surface="app"] .xp-name-wrap')).toMatchObject({ display: 'inline' });
    // The row menu keeps its room in every state (shown by opacity, never by display), so the name never narrows.
    expect(rule('.xp-rowmenu')).toMatchObject({ flex: 'none', opacity: '0' });
    expect(css).not.toMatch(/\.xp-rowmenu[^{]*\{[^}]*display:/);
  });

  it('the table is as wide as its column minimums, so a narrow page scrolls it sideways instead of squeezing names and values', async () => {
    const src = readFileSync(join(__dirname, 'grid.ts'), 'utf8');
    expect(src).toMatch(/--xp-minw', `\$\{nameMin\(s\) \+ modeMin\(s\)/);
    expect(src).toMatch(/class="xp-name-main mono" title="\$\{esc\(t\.path\)\}"/);
    expect(rule('.xp-grid')['min-width']).toBe('var(--xp-minw, 100%)');
  });
});

describe('Step list of the cell editor (sizes, durations, easings)', () => {
  it('marks the original value with the "was" dot and word (not ", was" glued to the value), the picked step checked', async () => {
    const { mountRampPicker } = await import('../../components/explorer/RampPicker');
    const slot = document.createElement('div');
    document.body.append(slot);
    const ramp = mountRampPicker();
    const steps = ['standard', 'linear', 'emphasized'].map((s) => ({ path: `motion.easing.${s}`, label: `easing.${s}`, step: s, value: 'cubic-bezier(0, 0, 1, 1)' }));
    ramp.render(slot, { kind: 'steps', label: 'Easing', steps, value: 'motion.easing.linear', original: 'motion.easing.standard', onPick: () => {} });
    const host = document.querySelector('.xe-ramp-host')!;
    const radios = [...host.querySelectorAll<HTMLElement>('[role="radio"]')];
    expect(radios).toHaveLength(3);
    expect(radios[1]!.getAttribute('aria-checked')).toBe('true');
    expect(host.querySelectorAll('[data-xe-was]')).toHaveLength(1);
    expect(radios[0]!.closest('label')!.querySelector('[data-xe-was] .xe-was-dot')).not.toBeNull();
    expect(host.textContent).not.toMatch(/, was/);
    // The values use the mono face of the pick row.
    expect(host.querySelectorAll('.mono')).toHaveLength(6);
    expect([...host.querySelectorAll('.mono')].filter((m) => m.textContent === 'cubic-bezier(0, 0, 1, 1)')).toHaveLength(3);
    expect(rule('.xe-steps[data-fade="end"]')['mask-image']).toMatch(/linear-gradient/);
    ramp.unmount();
    host.remove();
  });
});

describe('Token details', () => {
  it('the description wraps (up to three lines, whole on a phone), never one line cut mid-word', () => {
    const r = rule('.xp-d-line');
    expect(r['white-space']).toBeUndefined();
    expect(r['-webkit-line-clamp']).toBe('3');
    expect(css).toMatch(/@media \(max-width: 640px\) \{\s*\.xp-d-line \{\s*display: block;\s*-webkit-line-clamp: none;/);
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
      // One grey baseline on the whole tab row (the same line as the DS Tabs baseline), under the tabs and More alike.
    expect(rule('.xe-families')).toMatchObject({ position: 'relative', 'align-items': 'flex-end' });
    expect(rule('.xe-family-host')['align-items']).toBe('flex-end');
    expect(rule('.xe-families::before')).toMatchObject({ position: 'absolute', inset: 'auto 0 0', height: 'var(--border-width-default)', 'background-color': 'var(--color-border-default)' });
    // Ramp tiles: a 32px swatch, the step number at the caption size (12px).
    expect(rule('.xe-tile-sw')).toMatchObject({ width: 'var(--size-8)', height: 'var(--size-8)' });
    expect(rule('.xe-tile-step')['font-size']).toBe('var(--typography-caption-size)');
  });
});
