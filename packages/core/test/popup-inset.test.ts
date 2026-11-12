// One inset for every DS popup list (Menu, Select, Combobox): 8px (space.2) between the popup edge and its items, the
// items' corners concentric with the popup's (popup radius minus the inset), separators running to the popup edge with
// the inset's gap above and below. jsdom computes no styles, so the contract is read from the CSS modules' source, and
// from the component specs the Figma plugin draws (packages/react/component-specs.json).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(__dirname, '../../..');
const css = (name: string) => readFileSync(join(ROOT, 'packages/react/src/components', name, `${name}.module.css`), 'utf8');
const rule = (source: string, selector: string) => {
  const at = source.search(new RegExp(`^${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\{`, 'm'));
  expect(at, `${selector} exists`).toBeGreaterThanOrEqual(0);
  return source.slice(at, source.indexOf('}', at));
};

describe('the popup inset', () => {
  for (const name of ['Menu', 'Select', 'Combobox']) {
    it(`${name}: 8px inset, concentric items, separators keep the inset's gap`, () => {
      const source = css(name);
      expect(rule(source, '.popup')).toMatch(/\n\s*padding: var\(--space-2\);/);
      expect(rule(source, '.item')).toMatch(/border-radius: calc\(var\(--popup-radius\) - var\(--space-2\)\);/);
      expect(rule(source, '.separator')).toMatch(/margin: var\(--space-2\) calc\(var\(--space-2\) \* -1\);/);
      // No leftover of the 4px inset.
      expect(source).not.toMatch(/popup-radius\) - var\(--space-1\)/);
    });
  }

  it('the Figma specs draw the same inset and item radius', () => {
    const specs = readFileSync(join(ROOT, 'packages/react/component-specs.json'), 'utf8');
    expect(specs).toContain('"cornerRadius": "calc(popup.radius - space.2)"');
    expect(specs).not.toContain('calc(popup.radius - space.1)');
  });
});
