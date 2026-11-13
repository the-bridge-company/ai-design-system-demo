// Tab-like controls, one logic (docs/DESIGN-LANGUAGE.md, section 7; AGENTS.md, UI quality bar): Tabs (underline) switch
// sections, SegmentedControl switches a view or a filter. Each has one selected look, never the focus look: the focus
// ring is the keyboard's only (:focus-visible), and the site never restyles a selection. jsdom has no :focus-visible
// and the react test project empties stylesheets, so the contracts are read from the CSS sources here.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface CssRule {
  selectors: string[];
  body: string;
}

/** The style rules of a CSS source, `@media` and other at-rules flattened, comments dropped, keyframes skipped. */
function cssRules(source: string): CssRule[] {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules: CssRule[] = [];
  const walk = (text: string) => {
    let i = 0;
    while (i < text.length) {
      const open = text.indexOf('{', i);
      if (open === -1) return;
      const head = text.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      while (j < text.length && depth > 0) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') depth--;
        j++;
      }
      const inner = text.slice(open + 1, j - 1);
      if (head.startsWith('@keyframes')) {
        // Animation frames are not selectors.
      } else if (head.startsWith('@')) walk(inner);
      else rules.push({ selectors: head.split(',').map((s) => s.trim()).filter(Boolean), body: inner });
      i = j;
    }
  };
  walk(css);
  return rules;
}

const COMPONENTS = join(__dirname, '../../../../packages/react/src/components');
const read = (file: string) => cssRules(readFileSync(join(COMPONENTS, file), 'utf8'));

/** Every rule that uses a focus ring token sits under :focus-visible, and a pointer focus draws no outline. */
function expectKeyboardOnlyRing(rules: CssRule[], pointerSelector: string) {
  for (const r of rules.filter((x) => x.body.includes('--focus-ring'))) {
    for (const s of r.selectors) expect(s, s).toContain(':focus-visible');
  }
  expect(rules.find((r) => r.selectors.includes(pointerSelector))?.body).toMatch(/outline:\s*none/);
}

describe('Tabs CSS contract', () => {
  const rules = read('Tabs/Tabs.module.css');

  it('marks the selected tab with ink text, never a box, a fill or a ring', () => {
    expect(rules.find((r) => r.selectors.includes('.tab[data-active]'))?.body).toContain('var(--tabs-text-active)');
    for (const r of rules.filter((x) => x.selectors.some((s) => s.includes('[data-active]')))) {
      expect(r.body, r.selectors.join(', ')).not.toMatch(/outline|focus-ring|border|background|box-shadow/);
    }
  });

  it('draws the selection with the indicator token', () => {
    const indicator = rules.find((r) => r.selectors.includes('.underline .indicator'));
    expect(indicator?.body).toContain('var(--tabs-indicator)');
    expect(indicator?.body).not.toContain('focus-ring');
  });

  it('shows the focus ring on keyboard focus only', () => {
    expectKeyboardOnlyRing(rules, '.tab:focus:not(:focus-visible)');
  });

  it('keeps the count tag the same on every tab, selected or not', () => {
    expect(rules.some((r) => r.selectors.some((s) => /\[data-active\][^,]*\.count/.test(s)))).toBe(false);
  });
});

describe('SegmentedControl CSS contract', () => {
  const rules = read('SegmentedControl/SegmentedControl.module.css');
  const selected = /\[aria-checked="true"\]|\[aria-current="page"\]/;

  it('selects with the raised plate, in radio and link mode alike', () => {
    const plate = rules.find((r) => r.selectors.includes('.segment[aria-checked="true"]'));
    expect(plate?.selectors).toContain('.segment[aria-current="page"]');
    expect(plate?.body).toContain('var(--color-surface-raised)');
    expect(plate?.body).toContain('var(--color-border-emphasis)');
    expect(plate?.body).toContain('var(--elevation-raised)');
    expect(plate?.body).toContain('var(--color-text-default)');
  });

  it('never outlines a selection with focus tokens, and only strong uses Deep Harbor', () => {
    for (const r of rules) {
      const sel = r.selectors.filter((s) => selected.test(s) && !s.includes(':focus-visible'));
      if (!sel.length) continue;
      expect(r.body, sel.join(', ')).not.toMatch(/focus-ring|outline/);
      if (/control-checked/.test(r.body)) for (const s of sel) expect(s).toMatch(/^\.strong /);
    }
  });

  it('shows the focus ring on keyboard focus only', () => {
    expectKeyboardOnlyRing(rules, '.segment:focus:not(:focus-visible)');
  });

  it('keeps the count tag the same in every segment, selected or not', () => {
    expect(rules.some((r) => r.selectors.some((s) => selected.test(s) && s.includes('.count')))).toBe(false);
  });
});

// The site places the DS controls and never restyles their selection: no third look, no custom tab-like CSS.
describe('site CSS leaves the selection to the DS', () => {
  const STYLES = join(__dirname, '../styles');
  const control = /\[data-segment|\[data-segmented-control|\.space-nav|\[role="?tab"?\]|xe-family-tabs/;
  const state = /\[aria-checked|\[aria-current|\[aria-selected|\[data-active\]|\[data-checked\]/;

  it('no site rule paints a selected segment or tab (color, border, fill, outline, shadow)', () => {
    const offenders: string[] = [];
    for (const file of readdirSync(STYLES).filter((f) => f.endsWith('.css'))) {
      for (const r of cssRules(readFileSync(join(STYLES, file), 'utf8'))) {
        // Decorations inside the segment (an icon's fill, a motion) are the page's own; the segment's paint is not.
        const own = r.selectors.filter((s) => control.test(s) && state.test(s.split(/\s+/).pop() ?? ''));
        if (own.length && /(^|[;\s])(color|border[a-z-]*|background[a-z-]*|outline[a-z-]*|box-shadow)\s*:/.test(r.body)) {
          offenders.push(`${file}: ${own.join(', ')}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
