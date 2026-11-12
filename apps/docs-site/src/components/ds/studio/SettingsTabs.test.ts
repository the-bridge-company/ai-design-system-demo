// @vitest-environment jsdom
// Team Settings tabs (SettingsTabs.tsx): the DS Tabs over the four groups, not links styled as tabs. A tablist with one
// tab per group, each tab pointing at its group (the tabpanel in the page), arrow keys per the APG, one group shown at
// a time, the address following the tab, and every old anchor opening its group. Axe clean.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TabsPanel } from '@bridge-ds/react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import { SETTINGS_GROUPS, groupId, tabId } from '../../../lib/settings-sections';
import SettingsTabs from './SettingsTabs';

// The page's four groups, as pages/team-shell/settings renders them (the DS TabsPanel outside the Tabs root, static),
// with one band each.
function mountPanels() {
  const host = document.createElement('div');
  host.innerHTML = SETTINGS_GROUPS.map((g) =>
    renderToStaticMarkup(
      createElement(
        TabsPanel,
        { className: 'set-group', value: g.key, id: groupId(g.key), tabId: tabId(g.key), 'data-set-group': g.key } as Parameters<typeof TabsPanel>[0],
        createElement('section', { id: g.anchors[0] }, createElement('h2', null, `${g.label} band`)),
      ),
    ),
  ).join('');
  document.body.appendChild(host);
  return host;
}

const visible = () => [...document.querySelectorAll<HTMLElement>('[data-set-group]')].filter((g) => !g.hidden).map((g) => g.dataset.setGroup);

let panels: HTMLElement;
beforeEach(() => {
  history.replaceState(null, '', '/studio/acme/ds/settings/');
  panels = mountPanels();
  Element.prototype.scrollIntoView = () => {};
});
afterEach(() => panels.remove());

describe('Team Settings tabs', () => {
  it('renders the DS Tabs: a labelled tablist, one tab per group, wired to its panel', async () => {
    const { container } = render(createElement(SettingsTabs));
    const list = screen.getByRole('tablist', { name: 'Settings sections' });
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Team', 'Reviews', 'Tools', 'You']);
    for (const [i, g] of SETTINGS_GROUPS.entries()) {
      expect(tabs[i]).toHaveAttribute('id', tabId(g.key));
      expect(tabs[i]).toHaveAttribute('aria-controls', groupId(g.key));
    }
    expect(list.tagName).not.toBe('NAV');
    expect(container.querySelector('a')).toBeNull();
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    expect(visible()).toEqual(['team']);
    await expectNoAxeViolations(document.body);
  });

  it('moves focus with the arrow keys, Home and End, and selects with Enter', async () => {
    const user = userEvent.setup();
    render(createElement(SettingsTabs));
    const tabs = screen.getAllByRole('tab');
    await user.click(tabs[0]!);
    await user.keyboard('{ArrowRight}');
    expect(tabs[1]).toHaveFocus();
    await user.keyboard('{End}');
    expect(tabs[3]).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(tabs[0]).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(tabs[3]).toHaveFocus();
    await user.keyboard('{Home}');
    expect(tabs[0]).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}{Enter}');
    expect(tabs[2]).toHaveAttribute('aria-selected', 'true');
    expect(visible()).toEqual(['tools']);
    expect(location.hash).toBe(`#${groupId('tools')}`);
  });

  it('shows one group at a time and keeps it in the address', async () => {
    const user = userEvent.setup();
    render(createElement(SettingsTabs));
    await user.click(screen.getByRole('tab', { name: 'Reviews' }));
    expect(screen.getByRole('tab', { name: 'Reviews' })).toHaveAttribute('aria-selected', 'true');
    expect(visible()).toEqual(['reviews']);
    expect(location.hash).toBe(`#${groupId('reviews')}`);
  });

  it('opens the group an old anchor names, on load and on a hash change', async () => {
    history.replaceState(null, '', '/studio/acme/ds/settings/#roles');
    render(createElement(SettingsTabs));
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Reviews' })).toHaveAttribute('aria-selected', 'true'));
    expect(visible()).toEqual(['reviews']);
    act(() => {
      history.replaceState(null, '', '/studio/acme/ds/settings/#figma');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Tools' })).toHaveAttribute('aria-selected', 'true'));
    expect(visible()).toEqual(['tools']);
  });
});
