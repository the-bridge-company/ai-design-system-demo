// @vitest-environment jsdom
// The token cell editor's family tabs (components/explorer/FamilyTabs.tsx in scripts/explorer/inline-edit.ts): the DS
// Tabs, not buttons styled as tabs. A labelled tablist, arrow keys and Home and End that pick the family as they move
// (the ramp follows), focus that stays on the tab through the editor's redraws, More (the DS Menu) beside the list, axe clean.
import '../../../../../packages/react/src/test/setup';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from '@testing-library/user-event';
import { buildTokenSet, layoutOptions, loadConfig } from '@bridge-ds/core';
import { expectNoAxeViolations } from '../../../../../packages/react/src/test/axe';
import { buildTokens, modesOf, type Column, type UsageMap } from '../../lib/explorer/model';
import type { ExplorerData } from './types';

const ramp = (hexes: string[]) =>
  Object.fromEntries(hexes.map((hex, i) => [String((i + 1) * 100), { $type: 'color', $value: { colorSpace: 'srgb', components: [0, 0, 0], hex } }]));
const files = {
  'primitives/palette.tokens.json': JSON.stringify({
    palette: {
      neutral: ramp(['#f5f5f5', '#a3a3a3', '#404040']),
      primary: ramp(['#dbeafe', '#3b82f6', '#1e3a8a']),
      accent: ramp(['#fce7f3', '#ec4899', '#831843']),
      success: ramp(['#dcfce7', '#22c55e', '#14532d']),
      warning: ramp(['#fef9c3', '#eab308', '#713f12']),
    },
    color: { text: { $type: 'color', $value: '{palette.neutral.300}' } },
  }),
};
const set = buildTokenSet(files, layoutOptions(loadConfig('{}')));
const paths = [...set.byPath.keys()];
const P = 'color.text';
const options = paths.filter((p) => p.startsWith('palette.'));
const usage: UsageMap = Object.fromEntries(paths.map((p) => [p, { used: false, usedBy: [], styles: [] }]));
const tokens = buildTokens(set, usage);
const modes = modesOf(set);
const ctx = { brand: modes.brands[0] ?? 'bridge', theme: modes.themes[0] ?? 'light', density: modes.densities[0] ?? 'comfortable' };
const col: Column = { key: 'value', label: 'Value', ctx };
const d: ExplorerData = { set, head: set, tokens, byPath: new Map(tokens.map((t) => [t.path, t])), usage, pairs: [], results: [], before: [], modes };

vi.mock('../token-editor', () => ({
  aliasOptions: () => options,
  applyValues: () => {},
  draftDescription: () => '',
  draftValue: () => '{palette.neutral.300}',
  editDescription: () => {},
  pendingOverrides: () => ({}),
  previewContrast: () => [],
}));
vi.mock('../shell', () => ({ announce: () => {}, currentScope: () => ctx }));
window.matchMedia ??= ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;

const { openInlineEditor, closeInlineEditor } = await import('./inline-edit');

function open() {
  const container = document.createElement('div');
  const cell = document.createElement('button');
  container.append(cell);
  document.body.append(container);
  openInlineEditor({ container, cell, d, path: P, col, columns: [col] });
  return document.querySelector<HTMLElement>('.xe-pop')!;
}
const ramp_ = (pop: HTMLElement) => pop.querySelector('[role="radiogroup"]')?.getAttribute('aria-label');
const tabs = (pop: HTMLElement) => [...pop.querySelectorAll<HTMLElement>('[role="tab"]')];

describe('Token editor family tabs', () => {
  it('draws the DS Tabs: a labelled tablist, the first families as tabs, More beside the list', async () => {
    const pop = open();
    const list = pop.querySelector('[role="tablist"]')!;
    expect(list.getAttribute('aria-label')).toBe('Families');
    expect(tabs(pop).map((t) => t.textContent)).toEqual(['Neutral', 'Primary', 'Accent']);
    expect(tabs(pop)[0]!.getAttribute('aria-selected')).toBe('true');
    expect(list.contains(pop.querySelector('[data-xe-family-menu]'))).toBe(false);
    expect(ramp_(pop)).toBe('Neutral');
    await expectNoAxeViolations(pop);
    closeInlineEditor(false);
  });

  it('picks a family with the arrow keys, Home and End, and keeps focus on the tab through the redraw', async () => {
    const user = userEvent.setup();
    const pop = open();
    await new Promise((r) => setTimeout(r, 80));
    await user.click(tabs(pop)[0]!);
    await user.keyboard('{ArrowRight}');
    expect(document.activeElement?.textContent).toBe('Primary');
    expect(document.activeElement?.getAttribute('aria-selected')).toBe('true');
    expect(ramp_(pop)).toBe('Primary');
    await user.keyboard('{End}');
    expect(ramp_(pop)).toBe('Accent');
    expect(document.activeElement?.textContent).toBe('Accent');
    await user.keyboard('{Home}');
    expect(ramp_(pop)).toBe('Neutral');
    await user.click(tabs(pop)[1]!);
    expect(ramp_(pop)).toBe('Primary');
    // Still there after the editor's delayed redraw (contrast), still focused.
    await new Promise((r) => setTimeout(r, 80));
    expect(document.activeElement?.textContent).toBe('Primary');
    closeInlineEditor(false);
  });

  it('a family picked from More becomes the last tab, selected', async () => {
    const user = userEvent.setup();
    const pop = open();
    await user.click(pop.querySelector<HTMLElement>('[data-xe-family-menu]')!);
    // The DS Menu renders in a portal; picking in it never closes the editor.
    const item = await vi.waitFor(() => {
      const el = document.querySelector<HTMLElement>('[role="menuitem"][data-xe-family="4"]');
      if (!el) throw new Error('no menu yet');
      return el;
    });
    await user.click(item);
    expect(tabs(pop).map((t) => t.textContent)).toEqual(['Neutral', 'Primary', 'Warning']);
    expect(tabs(pop)[2]!.getAttribute('aria-selected')).toBe('true');
    expect(ramp_(pop)).toBe('Warning');
    closeInlineEditor(false);
    expect(document.querySelector('.xe-pop')).toBeNull();
  });

  it('the ramp is the DS SegmentedControl: arrow keys pick the next swatch, focus stays on it, More options is a DS Button', async () => {
    const user = userEvent.setup();
    const pop = open();
    await new Promise((r) => setTimeout(r, 80));
    const swatches = () => [...pop.querySelectorAll<HTMLElement>('[data-segmented-control] [role="radio"]')];
    expect(swatches().map((s) => s.getAttribute('data-xe-pick'))).toEqual(['palette.neutral.100', 'palette.neutral.200', 'palette.neutral.300']);
    const picked = swatches().find((s) => s.getAttribute('aria-checked') === 'true')!;
    expect(picked).toHaveAccessibleName('neutral.300, #404040');
    expect(picked.getAttribute('data-tooltip')).toBe('neutral.300 · #404040');
    await user.click(picked);
    await user.keyboard('{ArrowLeft}');
    expect(pop.querySelector('.xe-pick-name')?.textContent).toBe('neutral.200');
    expect(document.activeElement?.getAttribute('data-xe-pick')).toBe('palette.neutral.200');
    await new Promise((r) => setTimeout(r, 80));
    expect(document.activeElement?.getAttribute('data-xe-pick')).toBe('palette.neutral.200');
    const more = pop.querySelector<HTMLElement>('[data-xe-more]')!;
    expect(more.getAttribute('aria-expanded')).toBe('false');
    await user.click(more);
    expect(pop.querySelector<HTMLElement>('[data-xe-more]')!.getAttribute('aria-expanded')).toBe('true');
    expect(pop.querySelector<HTMLElement>('.xe-more')!.hidden).toBe(false);
    await expectNoAxeViolations(pop);
    closeInlineEditor(false);
  });
});
