// The collapsible side nav (components/site/RailCollapse.tsx): open, or a narrow column of icons. The choice is this
// browser's, kept in localStorage under RAIL_KEY; layouts/Layout.astro reads it again in an inline head script, before
// first paint, and sets <html data-rail="collapsed"> (styles/site.css draws the narrow column from it, wide screens only).

/** localStorage key of the choice. layouts/Layout.astro's inline head script reads the same key. */
export const RAIL_KEY = 'bridge.rail';

/** The <html> attribute that says the rail is collapsed. */
export const RAIL_ATTR = 'data-rail';

/** Below this width the rail is the phone sheet behind the menu button, never collapsed (styles/site.css, 960px). */
export const RAIL_DESKTOP_QUERY = '(min-width: 961px)';

/** The keyboard shortcut that toggles the rail. */
export const RAIL_SHORTCUT = '[';

export const RAIL_WORDS = {
  collapse: 'Collapse sidebar',
  expand: 'Expand sidebar',
  collapsed: 'Sidebar collapsed',
  expanded: 'Sidebar expanded',
} as const;

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** Whether this browser keeps the rail collapsed. Any storage failure reads as open. */
export function readRailCollapsed(store: Store | null): boolean {
  try {
    return store?.getItem(RAIL_KEY) === 'collapsed';
  } catch {
    return false;
  }
}

/** Keeps the choice; a storage that refuses it (private mode, blocked site data) only loses the memory. */
export function saveRailCollapsed(store: Store | null, collapsed: boolean): void {
  try {
    store?.setItem(RAIL_KEY, collapsed ? 'collapsed' : 'expanded');
  } catch {
    /* the rail still toggles for this page */
  }
}

/** The element a key went to, as much as the shortcut needs to know. */
export interface ShortcutTarget {
  tagName?: string;
  isContentEditable?: boolean;
}

export interface ShortcutEvent {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  isComposing?: boolean;
  defaultPrevented?: boolean;
  target?: ShortcutTarget | null;
}

const TYPING = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Whether a key press is the rail shortcut: `[` alone, never while typing, never with Ctrl, Cmd or Alt. */
export function isRailShortcut(e: ShortcutEvent): boolean {
  if (e.key !== RAIL_SHORTCUT) return false;
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.defaultPrevented) return false;
  const t = e.target;
  if (t && (t.isContentEditable || TYPING.has((t.tagName ?? '').toUpperCase()))) return false;
  return true;
}

/** The toggle's label for a state: what a press does. */
export const railToggleLabel = (collapsed: boolean): string => (collapsed ? RAIL_WORDS.expand : RAIL_WORDS.collapse);

/** What a collapsed rail item's tooltip says: its name, and its count when something waits ("Library review · 12 waiting"). */
export function railTipText(label: string, count?: number | null): string {
  const name = label.replace(/\s+/g, ' ').trim();
  return count && count > 0 ? `${name} · ${count} waiting` : name;
}

/**
 * Two letters for a product in the collapsed rail, instead of the same folder icon on every row. A word every product
 * starts with (the team's, "Acme" in "Acme CRM", "Acme Prints") says nothing and is dropped. Two words or more: their
 * first letters ("Field Ops" FO); one word: its first two letters as written ("CRM" CR, "Prints" Pr).
 */
export function productInitials(name: string, all: readonly string[] = []): string {
  const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
  let own = words(name);
  const lists = all.map(words);
  if (lists.length > 1 && own.length > 1) {
    const first = own[0]!.toLowerCase();
    if (lists.every((w) => w.length > 1 && w[0]!.toLowerCase() === first)) own = own.slice(1);
  }
  if (own.length === 0) return '';
  if (own.length >= 2) return (own[0]![0]! + own[1]![0]!).toUpperCase();
  const w = [...own[0]!];
  return (w[0]!.toUpperCase() + (w[1] ?? '')).trim();
}
