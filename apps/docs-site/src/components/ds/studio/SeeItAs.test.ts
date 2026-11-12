// @vitest-environment jsdom
// "See it as" on the sample banner (SeeItAs.tsx): its items sit inside the DS Menu's own padding, with the DS item
// inset and concentric radius (the note's gap above its line is the DS MenuSeparator's, #1137). Checked on the class contract
// (the DS Menu's popup class on the content, no styles/demo-home.css rule that moves an item to the menu's edges).
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SeeItAs } from './SeeItAs';
import { SAMPLE_CAST } from '../../../lib/demo-cast';

afterEach(cleanup);

const css = readFileSync(join(__dirname, '../../../styles/demo-home.css'), 'utf8');
const menuCss = readFileSync(join(__dirname, '../../../../../../packages/react/src/components/Menu/Menu.module.css'), 'utf8');
/** The declarations of one exact selector's rule (its own rule, after any shared one). */
const rule = (src: string, selector: string) => {
  const at = src.lastIndexOf(`\n${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  return src.slice(at, src.indexOf('}', at));
};

describe('SeeItAs menu inset', () => {
  it('keeps the DS Menu popup class on its content, the items inside it', async () => {
    render(createElement(SeeItAs, { current: SAMPLE_CAST[0]!.key, onPick: vi.fn() }));
    await userEvent.click(screen.getByRole('button', { name: /See it as/ }));
    const menu = await screen.findByRole('menu');
    expect([...menu.classList].some((c) => /(^|_)popup(_|$)/.test(c))).toBe(true);
    expect(menu).toHaveClass('see-as-menu');
    const items = screen.getAllByRole('menuitemradio');
    expect(items).toHaveLength(SAMPLE_CAST.length);
    for (const item of items) {
      expect([...item.classList].some((c) => /(^|_)item(_|$)/.test(c))).toBe(true);
      expect(item.style.margin).toBe('');
    }
  });

  it('never cancels the DS padding, inset or radius: no margin, padding or radius on the menu or its items', () => {
    for (const selector of ['.see-as-menu', '.see-as-item']) {
      const r = rule(css, selector);
      expect(r, selector).not.toMatch(/(^|\s)(margin|padding|border-radius)[a-z-]*:/m);
    }
    expect(css).not.toMatch(/see-as-item[^{]*\{[^}]*margin[^}]*-/);
  });

  it('the DS Menu holds the inset: popup padding, item radius concentric with it', () => {
    expect(rule(menuCss, '.popup')).toMatch(/padding: var\(--space-1\);/);
    expect(rule(menuCss, '.item')).toMatch(/border-radius: calc\(var\(--popup-radius\) - var\(--space-1\)\);/);
  });
});
