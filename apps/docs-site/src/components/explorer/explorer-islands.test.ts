// @vitest-environment jsdom
// Studio Tokens islands on the vanilla explorer: the type filter (DS SegmentedControl and a removable DS Tag), the row
// actions (DS Menu opened from the row's button, which comes back with focus), the Library tree (DS SidebarNav).
// Keyboard paths, names and axe, the way scripts/explorer/index.ts mounts them.
import '../../../../../packages/react/src/test/setup';
import { userEvent } from '@testing-library/user-event';
import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../../../../packages/react/src/test/axe';
import { mountTypeFilter, type TypeFilterProps } from './TypeFilter';
import { openRowMenu, rowMenuOpen } from './RowMenu';
import { mountCollectionTree, type TreeEntry } from './CollectionTree';

describe('Type filter', () => {
  it('is one labelled radio group with counts; arrow keys pick; the component scope is a removable Tag', async () => {
    const user = userEvent.setup();
    const host = document.createElement('div');
    document.body.append(host);
    const picks: string[] = [];
    const cleared = vi.fn();
    const filter = mountTypeFilter(host);
    let props: TypeFilterProps;
    const draw = (value: string) => {
      props = {
        options: [
          { value: 'all', label: 'All', count: 12 },
          { value: 'color', label: 'Color', count: 8 },
          { value: 'dimension', label: 'Dimension', count: 4 },
        ],
        value,
        onPick: (v) => {
          picks.push(v);
          draw(v);
        },
        component: 'Button',
        onClearComponent: cleared,
      };
      filter.render(props);
    };
    draw('all');
    const group = host.querySelector('[role="radiogroup"]')!;
    expect(group).toHaveAccessibleName('Filter by type');
    const radios = [...host.querySelectorAll<HTMLElement>('[role="radio"]')];
    expect(radios.map((r) => r.textContent)).toEqual(['All 12', 'Color 8', 'Dimension 4']);
    await user.click(radios[0]!);
    await user.keyboard('{ArrowRight}');
    expect(picks).toEqual(['color']);
    expect(host.querySelector('[data-xp-chip="color"]')!.getAttribute('aria-checked')).toBe('true');
    await user.click(host.querySelector<HTMLElement>('button[aria-label="Remove filter: used by Button"]')!);
    expect(cleared).toHaveBeenCalledOnce();
    await expectNoAxeViolations(host);
    filter.unmount();
    host.remove();
  });
});

describe('Row actions menu', () => {
  it('opens the DS Menu anchored to the row button, which stays in place; runs the picked action after it closes', async () => {
    const user = userEvent.setup();
    const cell = document.createElement('div');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Actions for color.bg');
    btn.setAttribute('aria-haspopup', 'menu');
    btn.dataset.xpRowmenu = '';
    cell.append(btn);
    document.body.append(cell);
    const action = vi.fn();
    const measured = vi.spyOn(btn, 'getBoundingClientRect');
    openRowMenu({ trigger: btn, label: 'Actions for color.bg', items: [{ id: 'edit', label: 'Edit value', icon: 'edit' }, { id: 'copy', label: 'Copy CSS variable', icon: 'copy' }], onAction: action });
    // No swap: the row's own button stays in its cell, expanded, and the menu is positioned against it.
    expect(cell.contains(btn)).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(rowMenuOpen()).toBe(true);
    const menu = await waitFor(() => {
      const m = document.querySelector<HTMLElement>('[role="menu"]');
      if (!m) throw new Error('no menu');
      return m;
    });
    expect(menu).toHaveAccessibleName('Actions for color.bg');
    await waitFor(() => expect(measured).toHaveBeenCalled());
    await expectNoAxeViolations(menu);
    await user.click(document.querySelector<HTMLElement>('[role="menuitem"][data-act="copy"]')!);
    await waitFor(() => expect(action).toHaveBeenCalledWith('copy'));
    expect(cell.contains(btn)).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(rowMenuOpen()).toBe(false);
    await waitFor(() => expect(document.querySelector('.xp-rowmenu-host')).toBeNull());

    // Escape: no action, focus back on the row's button.
    openRowMenu({ trigger: btn, label: 'Actions for color.bg', items: [{ id: 'edit', label: 'Edit value', icon: 'edit' }], onAction: action });
    await waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull());
    (document.querySelector<HTMLElement>('[role="menuitem"]') ?? document.querySelector<HTMLElement>('[role="menu"]'))!.focus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.querySelector('[role="menu"]')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(btn));
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(action).toHaveBeenCalledOnce();

    // The open menu's button again: it closes the menu instead of opening a second one.
    openRowMenu({ trigger: btn, label: 'Actions for color.bg', items: [{ id: 'edit', label: 'Edit value', icon: 'edit' }], onAction: action });
    expect(rowMenuOpen()).toBe(true);
    openRowMenu({ trigger: btn, label: 'Actions for color.bg', items: [{ id: 'edit', label: 'Edit value', icon: 'edit' }], onAction: action });
    expect(rowMenuOpen()).toBe(false);
    await waitFor(() => expect(document.querySelector('[role="menu"]')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(btn));
    expect(action).toHaveBeenCalledOnce();
    cell.remove();
  });
});

describe('Collection tree', () => {
  it('is the DS SidebarNav: buttons with counts, the picked one current', async () => {
    const user = userEvent.setup();
    const host = document.createElement('div');
    document.body.append(host);
    const tree = mountCollectionTree(host);
    const picked = vi.fn();
    const entries: TreeEntry[] = [
      { key: 'all', label: 'All collections', count: 9, depth: 0, current: false, data: { 'data-tier': 'all' } },
      { key: 'semantic', label: 'Semantic', count: 5, depth: 0, current: true, data: { 'data-tier': 'semantic' } },
      { key: 'semantic:color', label: 'color', count: 3, depth: 1, current: false, data: { 'data-tier': 'semantic', 'data-group': 'color' } },
    ];
    tree.render({ entries, note: 'Same collections the Figma plugin creates.', onPick: picked });
    expect(host.querySelector('nav')).toHaveAccessibleName('Collections and groups');
    const items = [...host.querySelectorAll<HTMLButtonElement>('nav button')];
    expect(items.map((b) => b.textContent)).toEqual(['All collections 9', 'Semantic 5', 'color 3']);
    expect(items[1]!.getAttribute('aria-current')).toBe('page');
    await user.click(items[2]!);
    expect(picked).toHaveBeenCalledWith(entries[2]);
    await expectNoAxeViolations(host);
    host.remove();
  });
});
