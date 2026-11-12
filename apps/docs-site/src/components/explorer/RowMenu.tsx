// Studio Tokens: the actions menu of a table row (Edit value, Details, Copy ...). The DS Menu (Base UI: arrow keys,
// typeahead, Home and End, Escape returns focus) opened from the row's "Actions" button. The table is vanilla and has
// hundreds of rows, so the menu is a React island only while it is open: openRowMenu() swaps the row's button for the
// DS trigger, opens the menu, and puts the row's button back (with focus) when it closes. The picked action runs
// after that, so an action that moves focus (the value editor, the details panel) keeps it.
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Copy, Info, MoreHorizontal, Pencil } from 'lucide-react';
import { IconButton, Menu, MenuContent, MenuItem, MenuTrigger } from '@bridge-ds/react';

export type RowMenuIcon = 'edit' | 'details' | 'copy';
const ICONS = { edit: Pencil, details: Info, copy: Copy } as const;

export interface RowMenuItem {
  id: string;
  label: string;
  icon: RowMenuIcon;
}

export interface RowMenuOptions {
  /** The row's own Actions button: the menu opens from where it is. */
  trigger: HTMLElement;
  /** Accessible name of the trigger and the menu ("Actions for color.bg.default"). */
  label: string;
  items: RowMenuItem[];
  /** The picked item, once the menu is closed and the row's button is back. */
  onAction: (id: string) => void;
}

let close: (() => void) | null = null;

/** Closes the open row menu, if any, without running an action. */
export function closeRowMenu() {
  close?.();
}

export const rowMenuOpen = () => close !== null;

export function openRowMenu({ trigger, label, items, onAction }: RowMenuOptions) {
  closeRowMenu();
  const host = document.createElement('span');
  host.className = 'xp-rowmenu-host';
  trigger.replaceWith(host);
  const root = createRoot(host);
  let picked: string | null = null;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    close = null;
    // After Base UI's own close (it returns focus to its trigger, which is about to go): the row's button comes back.
    window.setTimeout(() => {
      root.unmount();
      host.replaceWith(trigger);
      trigger.setAttribute('aria-expanded', 'false');
      if (picked) onAction(picked);
      else trigger.focus({ preventScroll: true });
    }, 0);
  };
  close = finish;
  flushSync(() =>
    root.render(
      <Menu defaultOpen onOpenChange={(open) => !open && finish()}>
        <MenuTrigger render={<IconButton icon={MoreHorizontal} label={label} size="sm" className="xp-rowmenu-trigger" />} />
        <MenuContent align="end" aria-label={label} className="xp-rowmenu-menu">
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
