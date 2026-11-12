// The token detail drawer of the Library foundation pages (components/explorer/TokenDetailDrawer.astro): the same
// renderDetail() as the token explorer, in read mode, opened from a token row, inside the DS Drawer (lib/token-drawer.ts)
// that openDialog opens: focus trap, Escape, scrim click, scroll lock and focus return are the DS's. Values follow the brand and density
// the previews use (top bar), in both themes. Links inside the panel ("Aliased by", contrast pairs) open that token.
import { closeDialog, isDialogOpen, openDialog } from '@bridge-ds/react/dom';
import { initTokenHistoryPanel } from '../history/token-panel';
import { TOKEN_DRAWER_ID } from '../../lib/token-drawer';
import { currentScope } from '../shell';
import { emptyFilters, planColumns, type ViewState } from '../../lib/explorer/model';
import { loadExplorerData } from './data';
import { renderDetail } from './detail';
import type { ExplorerData, ExplorerState, View } from './types';
import { copyText } from './util';

export function initTokenDrawer() {
  const found = document.getElementById(TOKEN_DRAWER_ID);
  if (!found || found.dataset.ready) return;
  found.dataset.ready = '';
  const root: HTMLElement = found;
  // The drawer moves to the end of <body> when it opens: keep its parts, not selectors from the page.
  const panel = root.querySelector<HTMLElement>('[data-fd-detail]')!;
  const popup = root.querySelector<HTMLElement>('[role="dialog"]')!;
  const title = root.querySelector<HTMLElement>(`#${TOKEN_DRAWER_ID}-title`);
  const crumb = root.querySelector<HTMLElement>(`#${TOKEN_DRAWER_ID}-description`);
  let data: ExplorerData | null = null;
  let current: string | null = null;
  initTokenHistoryPanel();

  function viewFor(d: ExplorerData, path: string): View | null {
    const x = d.byPath.get(path);
    if (!x) return null;
    const scope = currentScope();
    const pick = (list: string[], want: string) => (list.includes(want) ? want : (list[0] ?? ''));
    const vs: ViewState = { brand: pick(d.modes.brands, scope.brand), theme: d.modes.themes[0] ?? '', density: pick(d.modes.densities, scope.density), allCombos: false };
    const plan = planColumns({ lens: 'collections', tier: x.tier }, d.modes, vs, x.varies);
    return { visible: [x], plan, columns: plan.columns };
  }

  function state(path: string): ExplorerState {
    return {
      mode: 'read',
      selection: { lens: 'collections', tier: 'all' },
      filters: emptyFilters(),
      view: { brand: '', theme: '', density: '', allCombos: false },
      syntax: 'css',
      showCode: false,
      showDescription: false,
      flat: false,
      collapsed: new Set(),
      treeOpen: new Set(),
      selected: path,
      active: null,
    };
  }

  function syncUrl(path: string | null) {
    try {
      const p = new URLSearchParams(location.search);
      if (path) p.set('t', path);
      else p.delete('t');
      const q = p.toString();
      history.replaceState(null, '', `${location.pathname}${q ? `?${q}` : ''}${location.hash}`);
    } catch {
      /* sandboxed: the drawer still works */
    }
  }

  function open(path: string, opener?: HTMLElement | null) {
    data ??= loadExplorerData();
    const view = viewFor(data, path);
    if (!view) return;
    const wasOpen = isDialogOpen(root);
    current = path;
    renderDetail(panel, data, view, state(path), path);
    // The DS header names the drawer: the token path, and where it sits (the panel's own bar and name stay hidden).
    if (title) title.textContent = path;
    if (crumb) crumb.textContent = panel.querySelector('.xp-d-crumb')?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    document.querySelectorAll('[data-fd-row][aria-current]').forEach((r) => r.removeAttribute('aria-current'));
    document.querySelector(`[data-fd-row="${CSS.escape(path)}"]`)?.setAttribute('aria-current', 'true');
    // Focus goes to the dialog itself (named by the token path): the heading is not a control and shows no ring.
    if (!wasOpen) openDialog(root, { returnFocus: opener ?? (document.activeElement as HTMLElement | null), initialFocus: popup });
    else popup.focus();
    syncUrl(path);
  }

  // Closed by the DS (close button, Escape, scrim) or by closeDialog: forget the token.
  root.addEventListener('close', () => {
    document.querySelectorAll('[data-fd-row][aria-current]').forEach((r) => r.removeAttribute('aria-current'));
    current = null;
    syncUrl(null);
  });
  const close = () => closeDialog(root);

  document.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const opener = t.closest<HTMLElement>('[data-fd-open]');
    if (opener?.dataset.fdOpen) {
      e.preventDefault();
      open(opener.dataset.fdOpen, opener);
    }
  });
  panel.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const copy = t.closest<HTMLElement>('[data-copy]');
    if (copy) {
      e.stopPropagation();
      return void copyText(copy.dataset.copy!, copy);
    }
    const go = t.closest<HTMLElement>('[data-goto]');
    if (go?.dataset.goto) return open(go.dataset.goto);
    if (t.closest('[data-xp-close]')) close();
  });
  document.addEventListener('bridge:scope', () => {
    if (current && isDialogOpen(root)) open(current);
  });

  const deep = new URLSearchParams(location.search).get('t');
  if (deep) open(deep);
}
