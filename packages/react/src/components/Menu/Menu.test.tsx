import { useRef, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { Pencil } from 'lucide-react';
import { Button } from '../Button';
import { Menu, MenuCheckboxItem, MenuContent, MenuItem, MenuSeparator, MenuTrigger, type MenuAnchor } from './Menu';

function TokenMenu({ onRename = () => {} }: { onRename?: () => void }) {
  return (
    <Menu>
      <MenuTrigger render={<Button variant="secondary" />}>Token actions</MenuTrigger>
      <MenuContent>
        <MenuItem onClick={onRename}>Rename</MenuItem>
        <MenuItem>Duplicate</MenuItem>
        <MenuCheckboxItem defaultChecked={false}>Show deprecated</MenuCheckboxItem>
        <MenuSeparator />
        <MenuItem tone="danger">Delete</MenuItem>
      </MenuContent>
    </Menu>
  );
}

describe('Menu', () => {
  it('opens with the keyboard and moves the highlight with arrows', async () => {
    const user = userEvent.setup();
    render(<TokenMenu />);
    const trigger = screen.getByRole('button', { name: 'Token actions' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    const menu = await screen.findByRole('menu');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus());
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toHaveFocus());
    await expectNoAxeViolations(menu);
  });

  it('Enter activates the highlighted item and closes the menu', async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(<TokenMenu onRename={onRename} />);
    screen.getByRole('button', { name: 'Token actions' }).focus();
    await user.keyboard('{ArrowDown}');
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus());
    await user.keyboard('{Enter}');
    expect(onRename).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
  });

  it('a checkbox item toggles aria-checked and keeps the menu open', async () => {
    const user = userEvent.setup();
    render(<TokenMenu />);
    await user.click(screen.getByRole('button', { name: 'Token actions' }));
    const item = await screen.findByRole('menuitemcheckbox', { name: 'Show deprecated' });
    expect(item).toHaveAttribute('aria-checked', 'false');
    await user.click(item);
    expect(item).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('Escape closes it and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<TokenMenu />);
    const trigger = screen.getByRole('button', { name: 'Token actions' });
    trigger.focus();
    await user.keyboard('{ArrowDown}');
    await screen.findByRole('menu');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
  it('renders leading icons, Lucide or an element, hidden from assistive tech', async () => {
    const user = userEvent.setup();
    render(
      <Menu>
        <MenuTrigger render={<Button variant="secondary" />}>Token actions</MenuTrigger>
        <MenuContent>
          <MenuItem icon={Pencil}>Rename</MenuItem>
          <MenuItem icon={<svg data-testid="brand" />}>Open in Figma</MenuItem>
        </MenuContent>
      </Menu>,
    );
    await user.click(screen.getByRole('button', { name: 'Token actions' }));
    const rename = await screen.findByRole('menuitem', { name: 'Rename' });
    expect(rename.querySelector('svg')?.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByRole('menuitem', { name: 'Open in Figma' })).toContainElement(screen.getByTestId('brand'));
    await expectNoAxeViolations(screen.getByRole('menu'));
  });

  describe('anchor', () => {
    function RowMenu({ onEdit = () => {} }: { onEdit?: () => void }) {
      const [open, setOpen] = useState(false);
      const button = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button ref={button} type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(true)}>
            Actions for color.bg
          </button>
          <Menu
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) button.current?.focus();
            }}
          >
            <MenuContent anchor={button} aria-label="Actions for color.bg">
              <MenuItem onClick={onEdit}>Edit value</MenuItem>
              <MenuItem>Copy CSS variable</MenuItem>
            </MenuContent>
          </Menu>
        </>
      );
    }

    it('opens from an element that is not its trigger, with the menu keyboard and ARIA', async () => {
      const user = userEvent.setup();
      const onEdit = vi.fn();
      render(<RowMenu onEdit={onEdit} />);
      const button = screen.getByRole('button', { name: 'Actions for color.bg' });
      const measured = vi.spyOn(button, 'getBoundingClientRect');
      await user.click(button);
      const menu = await screen.findByRole('menu', { name: 'Actions for color.bg' });
      // The positioner measures the anchor, not a trigger.
      await waitFor(() => expect(measured).toHaveBeenCalled());
      screen.getByRole('menuitem', { name: 'Edit value' }).focus();
      await user.keyboard('{ArrowDown}');
      await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Copy CSS variable' })).toHaveFocus());
      await expectNoAxeViolations(menu);
      await user.keyboard('{ArrowUp}{Enter}');
      expect(onEdit).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      await waitFor(() => expect(button).toHaveFocus());
    });

    it('Escape closes an anchored menu; focus goes where onOpenChange puts it', async () => {
      const user = userEvent.setup();
      render(<RowMenu />);
      const button = screen.getByRole('button', { name: 'Actions for color.bg' });
      await user.click(button);
      await screen.findByRole('menu');
      screen.getByRole('menuitem', { name: 'Edit value' }).focus();
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('menu')).not.toBeInTheDocument());
      await waitFor(() => expect(button).toHaveFocus());
    });

    it('takes a virtual box or a point', async () => {
      const rect = { x: 120, y: 80, width: 0, height: 0, top: 80, right: 120, bottom: 80, left: 120 };
      const virtual = { getBoundingClientRect: vi.fn(() => rect) };
      const anchors: MenuAnchor[] = [virtual, { x: 120, y: 80 }];
      for (const anchor of anchors) {
        const { unmount } = render(
          <Menu defaultOpen>
            <MenuContent anchor={anchor} aria-label="Selection actions">
              <MenuItem>Copy</MenuItem>
            </MenuContent>
          </Menu>,
        );
        const menu = await screen.findByRole('menu', { name: 'Selection actions' });
        expect(screen.getByRole('menuitem', { name: 'Copy' })).toBeInTheDocument();
        await expectNoAxeViolations(menu);
        unmount();
      }
      expect(virtual.getBoundingClientRect).toHaveBeenCalled();
    });
  });
});
