import { afterEach, describe, expect, it } from 'vitest';
import tokensCss from '@bridge-ds/tokens/tokens.css?raw';
import resolved from '@bridge-ds/tokens/resolved.json';
import { bridgeTokenSheet, installBridgeTokens, PIN_ATTR, PIN_CLASS, resolveTokens, TOKENS_STYLE_ATTR } from './bridgeTokens';

// A host on another design system: its :root and scope rules give the same token names other values, its own
// "bridge" brand included, and its stylesheet comes after the toolbar's.
const HOSTILE = `
:root, [data-theme="light"], [data-brand="bridge"], [data-density], [data-density="compact"] {
  --radius-control: 0px;
  --radius-pill: 0px;
  --button-radius: 0px;
  --color-surface-raised: #ff0000;
  --color-border-default: #00ff00;
  --color-action-primary-bg: #ff00ff;
  --typography-ui-family: "Comic Sans MS";
}
[data-theme="dark"], [data-brand="bridge"][data-theme="dark"] {
  --color-surface-raised: #0000ff;
}
`;

const bridge = (theme: 'light' | 'dark') => resolveTokens(tokensCss, { 'data-brand': 'bridge', 'data-density': 'compact', 'data-theme': theme });

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
});

describe('the toolbar wears the Bridge tokens', () => {
  it('resolves every token to a plain value, Bridge brand and compact density', () => {
    const light = bridge('light');
    expect(light.size).toBeGreaterThan(300);
    for (const [name, value] of light) expect(value, name).not.toContain('var(');
    // Same values as the tokens build resolves for the Bridge brand.
    const values = (resolved as unknown as { values: Record<string, Record<string, Record<string, string>>> }).values.bridge!;
    for (const theme of ['light', 'dark'] as const) {
      const mine = bridge(theme);
      for (const token of ['color.surface.raised', 'color.border.default', 'color.text.default', 'color.action.primary.bg']) {
        expect(mine.get(`--${token.replaceAll('.', '-')}`)?.toLowerCase(), `${theme} ${token}`).toBe(values[theme]![token]!.toLowerCase());
      }
    }
    // Compact density, the Bridge radius roles.
    const compact = resolveTokens(tokensCss, { 'data-brand': 'bridge', 'data-density': 'compact', 'data-theme': 'light' });
    const comfortable = resolveTokens(tokensCss, { 'data-brand': 'bridge', 'data-density': 'comfortable', 'data-theme': 'light' });
    expect(compact.get('--control-height-md')).not.toBe(comfortable.get('--control-height-md'));
    expect(light.get('--button-radius')).toBe(light.get('--radius-control'));
    expect(light.get('--radius-control')).not.toBe('0px');
  });

  it('scopes them to the toolbar, in light and dark, at a specificity no token rule reaches', () => {
    const css = bridgeTokenSheet();
    expect(css).not.toContain(':root');
    expect(css).toContain(`[${PIN_ATTR}][${PIN_ATTR}][${PIN_ATTR}] {`.slice(0, -2));
    expect(css).toContain(`.${PIN_CLASS}.${PIN_CLASS}.${PIN_CLASS}[data-theme="dark"]`);
    expect(css).toContain(`--color-surface-raised: ${bridge('dark').get('--color-surface-raised')};`);
  });

  it('wins over a hostile host :root and scope rules', () => {
    // The host's stylesheet is in the page first; the toolbar's lazy chunk adds its own when it opens.
    const host = document.createElement('style');
    host.textContent = HOSTILE;
    document.head.appendChild(host);
    installBridgeTokens();
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.setAttribute('data-brand', 'bridge');
    document.body.innerHTML = `
      <div data-theme="light" data-brand="bridge" data-density="compact" ${PIN_ATTR}="" id="bar"></div>
      <div data-theme="dark" data-brand="bridge" data-density="compact" ${PIN_ATTR}="" id="dark"></div>
      <div data-theme="light" data-brand="bridge" data-density="compact" id="page"></div>`;
    expect(document.head.querySelectorAll(`style[${TOKENS_STYLE_ATTR}]`)).toHaveLength(1);

    const read = (id: string, name: string) => getComputedStyle(document.getElementById(id)!).getPropertyValue(name).trim();
    const light = bridge('light');
    // The host's own surfaces keep the host's values.
    expect(read('page', '--radius-control')).toBe('0px');
    expect(read('page', '--color-surface-raised')).toBe('#ff0000');
    // The toolbar keeps Bridge's.
    for (const name of ['--radius-control', '--radius-pill', '--button-radius', '--color-surface-raised', '--color-border-default', '--color-action-primary-bg', '--typography-ui-family']) {
      expect(read('bar', name), name).toBe(light.get(name));
    }
    expect(read('dark', '--color-surface-raised')).toBe(bridge('dark').get('--color-surface-raised'));
  });

  // jsdom applies matching rules in document order, without specificity: this part is checked on the selectors. A
  // host stylesheet added after the toolbar's (a lazy route) still loses, in a browser, on specificity.
  it('out-ranks every token rule of the host and of the Bridge tokens, in any order', () => {
    // Specificity of a compound selector of attributes, classes and pseudo-classes (all the token files use).
    const spec = (sel: string) => (sel.match(/\[[^\]]*\]|\.[\w-]+|:(?!not\()[\w-]+/g) ?? []).length;
    const selectorsOf = (css: string) =>
      [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{/g)].flatMap((m) => (m[1]!.trim().startsWith('@') ? [] : m[1]!.split(',').map((s) => s.trim())));
    const theirs = Math.max(...[...selectorsOf(HOSTILE), ...selectorsOf(tokensCss)].map(spec));
    const ours = selectorsOf(bridgeTokenSheet()).filter((s) => !s.startsWith(':has('));
    expect(ours.length).toBeGreaterThan(0);
    for (const s of ours) expect(spec(s), s).toBeGreaterThan(theirs);
  });

  it('installs one stylesheet, whatever the number of toolbars', () => {
    installBridgeTokens();
    installBridgeTokens();
    expect(document.head.querySelectorAll(`style[${TOKENS_STYLE_ATTR}]`)).toHaveLength(1);
  });
});
