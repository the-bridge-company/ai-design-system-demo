// @vitest-environment jsdom
// Library component page tabs (ComponentTabs.tsx with scripts/component-page.ts): the DS Tabs, not links styled as
// tabs. A labelled tablist, each tab wired to its panel, the Changelog count in the DS count tag, arrow keys per the
// APG, one panel shown at a time, the address following the tab, old section anchors opening the tab that holds them.
import '../../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../../packages/react/src/test/axe';
import { COMPONENT_TABS, componentTabButtonId, componentTabPanelId } from '../../../../lib/library/component-page';
import { initComponentPage } from '../../../../scripts/component-page';
import ComponentTabs from './ComponentTabs';

// The page as ComponentView draws it: the tabs slot, then one panel per tab with a section heading in it.
const SECTIONS: Record<string, string> = { usage: 'do-dont', tokens: 'anatomy', code: 'props', changelog: 'changes' };
const host = document.createElement('div');
host.className = 'cp-page';
host.innerHTML = `<div data-tabs-slot></div>${COMPONENT_TABS.map(
  (t) =>
    `<div class="cp-panel" role="tabpanel" tabindex="0" id="${componentTabPanelId(t.id)}" aria-labelledby="${componentTabButtonId(t.id)}" data-panel="${t.id}"><section><h2 id="${SECTIONS[t.id]}">${t.label} section</h2></section></div>`,
).join('')}`;
document.body.append(host);
Element.prototype.scrollIntoView = () => {};

const shown = () => [...document.querySelectorAll<HTMLElement>('[data-panel]')].filter((p) => !p.hidden).map((p) => p.dataset.panel);
const tab = (name: RegExp) => screen.getByRole('tab', { name });

beforeAll(() => {
  history.replaceState(null, '', '/components/button/#props');
  initComponentPage(document);
});
// Testing Library unmounts after each test: the tabs wake up again on the panel the script shows.
beforeEach(() => {
  render(createElement(ComponentTabs, { name: 'Button', changelogCount: 3 }), { container: host.querySelector<HTMLElement>('[data-tabs-slot]')! });
});

describe('Library component page tabs', () => {
  it('renders the DS Tabs wired to the panels, with the Changelog count in the count tag', async () => {
    const list = screen.getByRole('tablist', { name: 'Button documentation' });
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.querySelector('[class*="label"]')?.textContent)).toEqual(['Usage', 'Tokens', 'Code', 'Changelog']);
    for (const [i, t] of COMPONENT_TABS.entries()) {
      expect(tabs[i]).toHaveAttribute('id', componentTabButtonId(t.id));
      expect(tabs[i]).toHaveAttribute('aria-controls', componentTabPanelId(t.id));
      expect(tabs[i]).toHaveAttribute('data-tab', t.id);
    }
    expect(tabs[3]!.textContent).toMatch(/Changelog\s*3/);
    expect(tabs[0]!.textContent).toBe('Usage');
    expect(list.tagName).not.toBe('NAV');
    expect(list.querySelector('a')).toBeNull();
    await expectNoAxeViolations(host);
  });

  it('opens the tab an old section anchor names, before and after the tabs woke up', async () => {
    // #props, set before the script ran: Code.
    await waitFor(() => expect(tab(/^Code/)).toHaveAttribute('aria-selected', 'true'));
    expect(shown()).toEqual(['code']);
    act(() => {
      history.replaceState(null, '', '/components/button/#anatomy');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(() => expect(tab(/^Tokens/)).toHaveAttribute('aria-selected', 'true'));
    expect(shown()).toEqual(['tokens']);
  });

  it('moves with the arrow keys, Home and End, selects with Enter, and keeps the tab in the address', async () => {
    const user = userEvent.setup();
    await user.click(tab(/^Usage/));
    expect(shown()).toEqual(['usage']);
    expect(location.hash).toBe('#usage');
    await user.keyboard('{ArrowRight}');
    expect(tab(/^Tokens/)).toHaveFocus();
    await user.keyboard('{End}');
    expect(tab(/^Changelog/)).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(tab(/^Usage/)).toHaveFocus();
    await user.keyboard('{Home}{ArrowRight}{ArrowRight}{Enter}');
    expect(tab(/^Code/)).toHaveAttribute('aria-selected', 'true');
    expect(shown()).toEqual(['code']);
    expect(location.hash).toBe('#code');
  });
});
