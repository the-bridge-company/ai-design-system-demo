// Studio Tokens: the actions menu of a table row (Edit value, Details, Copy ...). The DS Menu (Base UI: arrow keys,
// typeahead, Home and End, Escape) opened from the row's "Actions" button. The table is vanilla and has hundreds of
// rows, so the menu is a React island only while it is open: openRowMenu() mounts a MenuContent anchored to the row's
// own button (it stays in place), and unmounts it when the menu closes. Focus goes back to the row's button, and the
// picked action runs after the close, so an action that moves focus (the value editor, the details panel) keeps it.
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Copy, Info, Pencil } from 'lucide-react';
import { Menu, MenuContent, MenuItem } from '@bridge-ds/react';

export type RowMenuIcon = 'edit' | 'details' | 'copy';
const ICONS = { edit: Pencil, details: Info, copy: Copy } as const;

export interface RowMenuItem {
  id: string;
  label: string;
  icon: RowMenuIcon;
}

export interface RowMenuOptions {
  /** The row's own Actions button: the menu opens from it, and focus returns to it. */
  trigger: HTMLElement;
  /** Accessible name of the menu ("Actions for color.bg.default"). */
  label: string;
  items: RowMenuItem[];
  /** The picked item, once the menu is closed. */
  onAction: (id: string) => void;
}

let close: (() => void) | null = null;
let current: HTMLElement | null = null;
// The open menu's own button pressed (the press outside closes the menu first): its click must not open it again.
let pressed: { el: HTMLElement; at: number } | null = null;

/** Closes the open row menu, if any, without running an action. */
export function closeRowMenu() {
  close?.();
}

export const rowMenuOpen = () => close !== null;

export function openRowMenu({ trigger, label, items, onAction }: RowMenuOptions) {
  // A second click on the open menu's button closes it, as a menu button does.
  const toggled = (pressed?.el === trigger && performance.now() - pressed.at < 1000) || (close !== null && current === trigger);
  pressed = null;
  if (toggled) {
    closeRowMenu();
    return;
  }
  closeRowMenu();
  const host = document.createElement('div');
  host.className = 'xp-rowmenu-host';
  document.body.append(host);
  const root = createRoot(host);
  const onPress = () => (pressed = { el: trigger, at: performance.now() });
  trigger.addEventListener('pointerdown', onPress);
  trigger.setAttribute('aria-expanded', 'true');
  current = trigger;
  let picked: string | null = null;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    close = null;
    current = null;
    trigger.setAttribute('aria-expanded', 'false');
    // After Base UI's own close and the press that caused it: the island goes, then focus or the action.
    window.setTimeout(() => {
      trigger.removeEventListener('pointerdown', onPress);
      root.unmount();
      host.remove();
      if (picked) onAction(picked);
      else if (trigger.isConnected) trigger.focus({ preventScroll: true });
    }, 0);
  };
  close = finish;
  flushSync(() =>
    root.render(
      <Menu defaultOpen onOpenChange={(open) => !open && finish()}>
        <MenuContent anchor={trigger} align="end" aria-label={label} className="xp-rowmenu-menu">
          {items.map((it) => (
            <MenuItem key={it.id} icon={ICONS[it.icon]} data-act={it.id} onClick={() => (picked = it.id)}>
              {it.label}
            </MenuItem>
          ))}
        </MenuContent>
      </Menu>,
    ),
  );
  // Opened by the row's button (mouse or keyboard): the first action takes focus, as a menu button's menu does.
  requestAnimationFrame(() => document.querySelector<HTMLElement>('.xp-rowmenu-menu [role="menuitem"]')?.focus());
}
