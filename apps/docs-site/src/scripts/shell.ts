// App shell behaviour, shipped on every page (small, no framework):
// the theme (light, dark or System, picked in Settings), copy buttons, the mobile navigation sheet, the Cmd+K command palette, header menus, the "On this
// page" rail and, in the Studio, the view of a change (scripts/view-change), the nav counts and the GitHub connection.
import { bindCodeBlocks, bindDialogs, bindTooltips, closeDialog, isDialogOpen, openDialog } from '@bridge-ds/react/dom';
import { currentContributor, getToken, initGitHubConnect } from './github-session';
import { rememberedMine, viewerRole } from './needs-you';
import { viewerDecidesExplorations } from './design-lead';
import { initMaintainer } from './maintainer';
import { pointLinksAtTeam } from './team-links';
import { initVanillaControls } from './vanilla-controls';
import { initViewChange } from './view-change';
import { followThemePref } from '../lib/theme-pref';
import { buildingBadgeLabel, explorationsBadgeLabel, reviewBadgeLabel } from '../lib/waiting-on';
import { BUILDING_EVENT, rememberedBuildWaiting, rememberedWaitingExplorations, WAITING_EVENT } from './waiting-counts';
import { navGroupOpen, readNavGroup, writeNavGroup } from '../lib/nav-groups';
import { PALETTE_OPEN_EVENT } from '../lib/palette-search';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T | null;

export function announce(text: string) {
  const live = $('live');
  if (!live) return;
  live.textContent = text;
  window.setTimeout(() => {
    if (live.textContent === text) live.textContent = '';
  }, 1500);
}

/** The theme follows this browser's choice (Settings, Appearance): the OS until a pick, and other tabs. */
function initTheme() {
  followThemePref();
}

/**
 * Brand and density of the design system previews. Stored per browser, kept on <html> as data-preview-brand and
 * data-preview-density, and applied to every element below <html> that sets data-theme (preview frames, islands):
 * tokens.css resolves brand x theme overrides only when the attributes sit on the same element, so each themed
 * scope carries all three. <html> itself keeps data-brand="bridge" and comfortable density: the Bridge chrome is
 * built with the design system and does not change with the preview scope.
 */
type Scope = { brand: string; density: string };
const SCOPE_DEFAULT: Scope = { brand: 'bridge', density: 'comfortable' };
const LABELS: Record<string, string> = { bridge: 'Bridge', ocean: 'Ocean', comfortable: 'Comfortable', compact: 'Compact' };
/** A label for any brand or density, including brands added after this script was written. */
const labelOf = (v: string) => LABELS[v] ?? v.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

export function currentScope(): Scope {
  const root = document.documentElement;
  return { brand: root.dataset.previewBrand ?? SCOPE_DEFAULT.brand, density: root.dataset.previewDensity ?? SCOPE_DEFAULT.density };
}

function applyScope(scope: Scope, within: ParentNode = document) {
  const root = document.documentElement;
  root.dataset.previewBrand = scope.brand;
  root.dataset.previewDensity = scope.density;
  // Specimen stages on the page's own theme (Library foundation pages): they follow the page theme and the scope.
  const theme = root.dataset.theme ?? 'light';
  within.querySelectorAll<HTMLElement>('[data-scope-stage]').forEach((el) => {
    if (el.dataset.theme !== theme) el.dataset.theme = theme;
  });
  within.querySelectorAll<HTMLElement>('[data-theme]').forEach((el) => {
    if (el === root || el.hasAttribute('data-scope-fixed')) return;
    if (el.dataset.brand !== scope.brand) el.dataset.brand = scope.brand;
    if (el.dataset.density !== scope.density) el.dataset.density = scope.density;
  });
  // Specimen brand and density switches (components/ds/library/FoundationParts.tsx ScopeSwitch, static SegmentedControls).
  document.querySelectorAll<HTMLElement>('[data-scope-switch]').forEach((s) => paintSegments(s, s.dataset.scopeSwitch === 'density' ? scope.density : scope.brand));
  document.querySelectorAll<HTMLElement>('[data-scope-label]').forEach((l) => {
    const key = l.dataset.scopeLabel as keyof Scope;
    l.textContent = labelOf(scope[key]);
  });
}

function initScope() {
  applyScope(currentScope());
  const set = (patch: Partial<Scope>) => {
    const next = { ...currentScope(), ...patch };
    try {
      localStorage.setItem('ds-brand', next.brand);
      localStorage.setItem('ds-density', next.density);
    } catch {
      /* private mode: applies to this page only */
    }
    applyScope(next);
    announce(`Previews: ${labelOf(next.brand)}, ${labelOf(next.density)}`);
    document.dispatchEvent(new CustomEvent('bridge:scope', { detail: next }));
  };
  // React islands (scope menu, props playground) ask for a change with an event; see components/ds/scope.ts.
  document.addEventListener('bridge:set-scope', (e) => set((e as CustomEvent<Partial<Scope>>).detail ?? {}));
  document.addEventListener('bridge:segment', (e) => {
    const sw = (e.target as HTMLElement).closest<HTMLElement>('[data-scope-switch]');
    const value = (e as CustomEvent<{ value: string }>).detail.value;
    if (sw) set(sw.dataset.scopeSwitch === 'density' ? { density: value } : { brand: value });
  });
  // Islands and drawers add themed scopes after load: keep them in step.
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      applyScope(currentScope());
    });
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-theme'] });
  // The page theme lives on <html>: specimen stages follow it.
  new MutationObserver(() => applyScope(currentScope())).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  const menu = document.getElementById('scope-menu') as HTMLDetailsElement | null;
  if (menu) {
    document.addEventListener('click', (e) => {
      if (menu.open && !menu.contains(e.target as Node)) menu.open = false;
    });
    menu.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.open) {
        menu.open = false;
        menu.querySelector('summary')?.focus();
      }
    });
  }
}

/**
 * Statically rendered DS SegmentedControls (Astro, no hydration) opt in with `data-vanilla`. Base UI renders every
 * segment with tabindex -1 on the server, so this restores the roving tab stop, selects on click and moves the
 * selection with arrow keys, Home and End, like the hydrated control. A change dispatches `bridge:segment`
 * ({ value }) on the group root, bubbling. Other scripts select programmatically with selectSegment().
 */
const SEG_ROOT = '[data-segmented-control][data-vanilla]';
const segmentsOf = (root: Element) => [...root.querySelectorAll<HTMLButtonElement>('[data-segment]')];
const segDisabled = (b: HTMLButtonElement) => b.disabled || b.hasAttribute('data-disabled');

function paintSegments(root: Element, value: string | null) {
  const segs = segmentsOf(root);
  const current = segs.find((b) => b.dataset.value === value) ?? null;
  const stop = current ?? segs.find((b) => !segDisabled(b)) ?? null;
  for (const b of segs) {
    const on = b === current;
    b.setAttribute('aria-checked', String(on));
    b.toggleAttribute('data-checked', on);
    b.toggleAttribute('data-unchecked', !on);
    b.tabIndex = b === stop ? 0 : -1;
  }
  // Too many segments for the width (a phone): the DS inner track scrolls sideways; keep the selected one in view,
  // clear of the faded edge (the track's scroll-padding).
  const track = root.querySelector<HTMLElement>('[data-segment-track]') ?? (root as HTMLElement);
  if (current && track.scrollWidth > track.clientWidth) {
    const pad = parseFloat(getComputedStyle(track).scrollPaddingInlineStart) || 0;
    const start = current.offsetLeft - pad;
    const end = current.offsetLeft + current.offsetWidth + pad;
    if (start < track.scrollLeft) track.scrollLeft = Math.max(0, start);
    else if (end > track.scrollLeft + track.clientWidth) track.scrollLeft = end - track.clientWidth;
  }
  markOverflow(root as HTMLElement);
}

/** The DS static contract for a scrolling track: data-overflow on the root names the edges of its inner track that hide
 * segments (the CSS fades them). */
function markOverflow(root: HTMLElement) {
  const track = root.querySelector<HTMLElement>('[data-segment-track]') ?? root;
  const max = track.scrollWidth - track.clientWidth;
  const start = track.scrollLeft > 1;
  const end = max - track.scrollLeft > 1;
  const value = start && end ? 'both' : start ? 'start' : end ? 'end' : null;
  if (value) root.setAttribute('data-overflow', value);
  else root.removeAttribute('data-overflow');
}

/** Select a segment of a static SegmentedControl. `emit` dispatches bridge:segment as a user change would. */
export function selectSegment(root: Element, value: string, emit = false) {
  paintSegments(root, value);
  if (emit) root.dispatchEvent(new CustomEvent('bridge:segment', { detail: { value }, bubbles: true }));
}

/** Restores the roving tab stop of the static SegmentedControls under `root` (a view rendered after load). */
export function paintStaticSegments(root: ParentNode = document) {
  root.querySelectorAll(SEG_ROOT).forEach((el) => {
    const checked = el.querySelector<HTMLElement>('[data-segment][aria-checked="true"]');
    paintSegments(el, checked?.dataset.value ?? null);
  });
}

function initSegmented() {
  paintStaticSegments();
  // Scrolling tracks (phones): fade the edges that hide segments, on scroll and on resize.
  document.addEventListener(
    'scroll',
    (e) => {
      const root = e.target instanceof HTMLElement ? e.target.closest<HTMLElement>(SEG_ROOT) : null;
      if (root) markOverflow(root);
    },
    { capture: true, passive: true },
  );
  window.addEventListener('resize', () => document.querySelectorAll<HTMLElement>(SEG_ROOT).forEach(markOverflow), { passive: true });
  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(`${SEG_ROOT} [data-segment]`);
    const root = b?.closest(SEG_ROOT);
    if (!b || !root || segDisabled(b) || b.getAttribute('aria-checked') === 'true') return;
    selectSegment(root, b.dataset.value ?? '', true);
  });
  document.addEventListener('keydown', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>(`${SEG_ROOT} [data-segment]`);
    const root = b?.closest(SEG_ROOT);
    if (!b || !root) return;
    const segs = segmentsOf(root).filter((x) => !segDisabled(x));
    const i = segs.indexOf(b);
    const rtl = getComputedStyle(root).direction === 'rtl';
    const step: Record<string, number> = { ArrowRight: rtl ? -1 : 1, ArrowDown: 1, ArrowLeft: rtl ? 1 : -1, ArrowUp: -1 };
    let next: HTMLButtonElement | undefined;
    if (e.key in step) next = segs[(i + step[e.key] + segs.length) % segs.length];
    else if (e.key === 'Home') next = segs[0];
    else if (e.key === 'End') next = segs[segs.length - 1];
    if (!next) return;
    e.preventDefault();
    next.focus();
    if (next !== b) selectSegment(root, next.dataset.value ?? '', true);
  });
}

function initCopy() {
  document.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-copy]');
    if (!b) return;
    let text = b.getAttribute('data-copy') ?? '';
    const from = b.getAttribute('data-copy-from');
    if (from) text = document.getElementById(from)?.textContent ?? '';
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text).then(
      () => {
        b.setAttribute('data-copied', '');
        const label = b.querySelector<HTMLElement>('[data-copy-label]');
        const old = label?.textContent;
        if (label) label.textContent = 'Copied';
        announce('Copied to clipboard');
        window.setTimeout(() => {
          b.removeAttribute('data-copied');
          if (label && old != null) label.textContent = old;
        }, 1400);
      },
      () => announce('Copy failed. Select the text and copy it by hand.'),
    );
  });
}

function initRail() {
  const rail = $('rail');
  const open = $<HTMLButtonElement>('rail-toggle');
  const close = $<HTMLButtonElement>('rail-close');
  const scrim = $('scrim');
  const main = $('main');
  if (!rail || !open || !close || !scrim) return;
  const mq = matchMedia('(max-width: 960px)');
  const setInert = () => {
    const isOpen = rail.classList.contains('is-open');
    if (mq.matches) rail.toggleAttribute('inert', !isOpen);
    else rail.removeAttribute('inert');
    main?.toggleAttribute('inert', mq.matches && isOpen);
  };
  const toggle = (state: boolean) => {
    rail.classList.toggle('is-open', state);
    scrim.hidden = !state;
    open.setAttribute('aria-expanded', String(state));
    document.body.classList.toggle('no-scroll', state);
    setInert();
    if (state) close.focus();
    else open.focus();
  };
  open.addEventListener('click', () => toggle(true));
  close.addEventListener('click', () => toggle(false));
  scrim.addEventListener('click', () => toggle(false));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && rail.classList.contains('is-open')) toggle(false);
  });
  mq.addEventListener('change', () => {
    if (!mq.matches && rail.classList.contains('is-open')) toggle(false);
    setInert();
  });
  setInert();
  rail.querySelector('[aria-current="page"]')?.scrollIntoView({ block: 'nearest' });
}

/**
 * The side nav is sticky and one screen tall. A strip above the shell (the demo banner) pushes it down while it is in
 * view: --shell-offset is how much of it still shows under the header, so the rail fits the screen and its foot stays
 * visible. Zero once scrolled past, and on pages with no strip.
 */
function initRailFit() {
  const shell = document.querySelector<HTMLElement>('.shell');
  const header = document.querySelector<HTMLElement>('.topbar');
  if (!shell || !header) return;
  let frame = 0;
  let last = -1;
  const fit = () => {
    frame = 0;
    const offset = Math.max(0, Math.round(shell.getBoundingClientRect().top - header.getBoundingClientRect().bottom));
    if (offset === last) return;
    last = offset;
    shell.style.setProperty('--shell-offset', `${offset}px`);
  };
  const queue = () => {
    if (!frame) frame = requestAnimationFrame(fit);
  };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  // The demo banner mounts (and wraps) after first paint.
  const strip = document.querySelector<HTMLElement>('[data-demo-strip]');
  if (strip && typeof ResizeObserver === 'function') new ResizeObserver(queue).observe(strip);
  // The sample team's strip shows the built banner from first paint (styles/site.css); a page where the live banner
  // never came after a while lets it go.
  if (strip && document.documentElement.hasAttribute('data-sample-team'))
    window.setTimeout(() => {
      if (strip.hidden) strip.dataset.settled = '';
    }, SAMPLE_STRIP_WAIT_MS);
  fit();
}

/**
 * Side nav groups: a button with aria-expanded shows or hides its list of pages. The same for every visitor: the group
 * holding the current page is always open, the others start open and follow this tab's toggles (lib/nav-groups.ts).
 * Applied again when the page comes back from the back-forward cache, and nothing takes focus on load.
 */
function initNavGroups() {
  const session = (() => {
    try {
      return window.sessionStorage;
    } catch {
      return null;
    }
  })();
  const groups = [...document.querySelectorAll<HTMLButtonElement>('[data-nav-group]')]
    .map((btn) => ({ btn, list: document.getElementById(btn.getAttribute('aria-controls') ?? '') }))
    .filter((g): g is { btn: HTMLButtonElement; list: HTMLElement } => Boolean(g.list));
  const set = (g: { btn: HTMLButtonElement; list: HTMLElement }, open: boolean) => {
    g.btn.setAttribute('aria-expanded', String(open));
    g.list.hidden = !open;
  };
  const apply = () => {
    for (const g of groups) {
      const label = g.btn.dataset.navGroup ?? '';
      set(g, navGroupOpen({ current: g.btn.hasAttribute('data-nav-current'), stored: readNavGroup(label, session) }));
    }
  };
  apply();
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    apply();
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.matches('[data-nav-group]')) active.blur();
  });
  for (const g of groups) {
    g.btn.addEventListener('click', () => {
      const open = g.btn.getAttribute('aria-expanded') !== 'true';
      set(g, open);
      writeNavGroup(g.btn.dataset.navGroup ?? '', open, session);
    });
  }
}

/**
 * The Cmd+K search palette: a DS Dialog (ScriptDialog `palette`) holding the SearchPalette island, a DS Combobox in
 * inline mode. The shell opens it (the header button, Cmd+K, "/") and tells the island, which loads the index,
 * clears the query and takes focus.
 */
function initPalette() {
  const dialog = $('palette');
  const trigger = $<HTMLButtonElement>('search-open');
  if (!dialog || !trigger) return;

  const open = () => {
    if (isDialogOpen(dialog)) return;
    openDialog(dialog);
    dialog.dispatchEvent(new CustomEvent(PALETTE_OPEN_EVENT));
  };

  trigger.addEventListener('click', open);
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (isDialogOpen(dialog)) closeDialog(dialog);
      else open();
    } else if (e.key === '/' && !isDialogOpen(dialog) && !(e.target as HTMLElement).closest('input, textarea, [contenteditable]')) {
      e.preventDefault();
      open();
    }
  });
}

/**
 * Header menus (<details data-menu>): close on outside click and on Escape, one open at a time. Delegated, so menus a
 * page renders after load (a team's Library view) behave the same.
 */
function initMenus() {
  const menus = () => [...document.querySelectorAll<HTMLDetailsElement>('details[data-menu]')];
  document.addEventListener('click', (e) => {
    for (const m of menus()) if (m.open && !m.contains(e.target as Node)) m.open = false;
  });
  // 'toggle' does not bubble: listen in the capture phase.
  document.addEventListener(
    'toggle',
    (e) => {
      const m = e.target;
      if (!(m instanceof HTMLDetailsElement) || !m.matches('details[data-menu]') || !m.open) return;
      for (const o of menus()) if (o !== m) o.open = false;
    },
    true,
  );
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const m = (e.target as Element | null)?.closest?.<HTMLDetailsElement>('details[data-menu]');
    if (m?.open) {
      m.open = false;
      m.querySelector('summary')?.focus();
    }
  });
}

let tocObserver: IntersectionObserver | null = null;

/**
 * Right rail of reading pages: one link per h2, the current section marked while scrolling. Run again by a page that
 * renders its sections after load (a team's Library view): it starts over from the headings there now.
 */
export function initToc() {
  const aside = document.querySelector<HTMLElement>('[data-auto-toc]');
  const list = aside?.querySelector('ul');
  if (!aside || !list) return;
  tocObserver?.disconnect();
  tocObserver = null;
  list.replaceChildren();
  aside.hidden = true;
  const heads = [...document.querySelectorAll<HTMLElement>('.page-body h2')].filter((h) => !h.closest('[hidden], dialog, .sr-only') && !h.classList.contains('sr-only'));
  if (heads.length < 2) return;
  const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  for (const h of heads) {
    if (!h.id) h.id = slug(h.textContent ?? '') || `section-${heads.indexOf(h)}`;
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = `#${h.id}`;
    a.textContent = (h.textContent ?? '').trim();
    li.appendChild(a);
    list.appendChild(li);
  }
  aside.hidden = false;
  const links = [...list.querySelectorAll('a')];
  if (!('IntersectionObserver' in window)) return;
  const io = (tocObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a) => (a.hash === `#${e.target.id}` ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
      }
    },
    { rootMargin: '-10% 0px -75% 0px' },
  ));
  heads.forEach((h) => io.observe(h));
}

const DRAFT_KEY = 'bridge.draft.v1';

/** How long the sample team's banner strip holds its place before giving it back when no banner came. */
const SAMPLE_STRIP_WAIT_MS = 6000;

/** Draft edits kept in this browser by the token editor. */
export function draftCount(): number {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? ((JSON.parse(raw) as { edits?: unknown[] }).edits?.length ?? 0) : 0;
  } catch {
    return 0;
  }
}

/**
 * The Library review badge: Home's review count, the changes in review that wait on the viewer's decision
 * (scripts/needs-you), hidden at 0. Only whoever holds the review right sees it (a design lead, a reviewer): a designer
 * reads Library review without a number, the decisions are not hers.
 */
export const setReviewCount = (n: number | null) => setCount('reviews', n);

/** The viewer holds the review right here, the rule of Home's review queue and of Library review's buttons. */
function reviewsHere(): boolean {
  try {
    return viewerRole() === 'reviewer' || viewerDecidesExplorations();
  } catch {
    return false;
  }
}

/** The Explorations badge: the explorations that wait on the viewer (Waiting on you), hidden at 0 (scripts/waiting-counts). */
export const setExplorationsCount = (n: number | null) => setCount('explorations', n);

type CountKind = 'drafts' | 'reviews' | 'explorations' | 'building';
/** The last number each badge was given: the reviews badge paints again once the viewer's review right is known. */
const lastCount = new Map<CountKind, number | null>();

function setCount(kind: CountKind, n: number | null) {
  lastCount.set(kind, n);
  // The nav shows two numbers, one source each (lib/waiting-counts): on Explorations what waits on the viewer there,
  // on Library review the changes that wait on the viewer's decision (for whoever holds the review right). Hidden at 0.
  // A link reads "Library review, 17 pieces wait for your decision", never the clause alone.
  const shown = kind === 'reviews' ? Boolean(n) && reviewsHere() : Boolean(n);
  document.querySelectorAll<HTMLElement>(`[data-nav-count="${kind}"]`).forEach((el) => {
    el.hidden = !shown;
    const v = el.querySelector('[data-nav-count-value]');
    if (v) v.textContent = n ? String(n) : '';
    const said = el.querySelector('[data-nav-count-label]');
    if (said) said.textContent = kind === 'explorations' ? explorationsBadgeLabel(n) : kind === 'building' ? buildingBadgeLabel(n) : reviewBadgeLabel(n);
  });
  // The Drafts counter in the Studio header always shows its number, zero included.
  if (kind === 'drafts')
    document.querySelectorAll<HTMLElement>('[data-drafts-open]').forEach((el) => {
      el.dataset.count = String(n ?? 0);
      el.setAttribute('aria-label', `Drafts, ${n ?? 0} change${n === 1 ? '' : 's'} in this browser`);
      const v = el.querySelector('[data-nav-count-value-hd]');
      if (v) v.textContent = String(n ?? 0);
    });
}

/**
 * Changes > "Review and propose" lands on Studio Tokens with #review: open the draft review sheet once the
 * explorer has painted its draft bar (it loads its data first), then drop the hash.
 */
function openReviewFromHash() {
  if (location.hash !== '#review') return;
  let tries = 0;
  const tick = () => {
    const bar = document.querySelector<HTMLElement>('[data-xe-bar]');
    const review = bar?.querySelector<HTMLElement>('[data-xe-review]');
    if (bar && review && !bar.hidden) {
      review.click();
      history.replaceState(null, '', location.pathname + location.search);
      return;
    }
    if (++tries < 60) window.setTimeout(tick, 100);
  };
  tick();
}

function initStudio() {
  if (document.documentElement.dataset.space === 'library') return;
  initGitHubConnect();
  // The start screen and the browser workspace read no repository: no drafts, no review count, no view selector.
  if (document.documentElement.hasAttribute('data-no-repo')) return;

  setCount('drafts', draftCount());
  // What waits on the viewer among the explorations: the set Home and Explorations remembered (one source).
  const paintWaiting = () => setCount('explorations', rememberedWaitingExplorations()?.length ?? null);
  initGitHubConnect(paintWaiting);
  // Nothing remembered yet for this team and viewer (a page opened directly): read it once, as Library review's count
  // is (below), so the badge shows on every page, not only after Home or Explorations. Home and Explorations write it.
  const q = new URLSearchParams(location.search);
  const explorationsList = /\/explorations\/?$/.test(location.pathname) && !q.has('exploration') && !q.has('pr');
  const homeCounts = Boolean(document.querySelector('[data-studio-home]')) || explorationsList;
  if (!homeCounts)
    initGitHubConnect((v) => {
      if (rememberedWaitingExplorations() !== null || !(v || currentContributor())) return;
      void import('./waiting-counts').then((m) => m.countWaitingExplorations()).catch(() => undefined);
    });
  document.addEventListener(WAITING_EVENT, paintWaiting);
  // Being built: the build requests a developer's Home counted to pick up, the same number on every page (A6).
  const paintBuilding = () => setCount('building', rememberedBuildWaiting());
  initGitHubConnect(paintBuilding);
  document.addEventListener(BUILDING_EVENT, paintBuilding);
  // The review right is known only once the team's settings are read (a team shell reads them after first paint): the
  // Library review badge paints again then, so it shows on every page, not only on Home, which sets it late (A6). The
  // remembered sets are read again too: who the viewer is may settle after the first paint.
  document.addEventListener('bridge:team-model', () => {
    if (lastCount.has('reviews')) setCount('reviews', lastCount.get('reviews') ?? null);
    paintWaiting();
    paintBuilding();
  });
  // Paint the last known count at once, so the nav does not jump while GitHub answers (or when it cannot).
  setCount('reviews', getToken() ? rememberedMine() : null);
  // The Overview reads the same statuses for its Needs you list and sets the badge itself.
  const pageCounts = Boolean(document.querySelector('[data-review-count-owner]'));
  openReviewFromHash();
  document.addEventListener('bridge:draft', () => setCount('drafts', draftCount()));
  window.addEventListener('storage', (e) => {
    if (e.key === DRAFT_KEY) setCount('drafts', draftCount());
  });

  // "Viewing: Latest library" on Tokens, Components and Quality, the view banner, and links that keep the view.
  initViewChange();
  // The Library review count is Library review's own number (its loader and rule, scripts/library-waiting): Home and
  // Library review refresh it, other pages show what this browser remembers for this team and viewer, and read it once
  // when nothing is remembered yet. The view selector reads the open changes itself (scripts/view-change).
  if (!pageCounts)
    initGitHubConnect((v) => {
      const known = rememberedMine(currentContributor() ? undefined : (v?.login ?? null));
      setCount('reviews', known);
      if (known === null && (v || currentContributor())) void import('./library-waiting').then((m) => m.countLibraryWaiting()).then((n) => n !== null && setCount('reviews', n));
    });
}

export function initShell() {
  // First, so every handler below sees the team's addresses on a team shell.
  pointLinksAtTeam();
  initTheme();
  initMaintainer();
  initSegmented();
  initVanillaControls();
  initMenus();
  initToc();
  initStudio();
  initScope();
  initCopy();
  // DS components rendered without React at runtime (static Astro HTML, script-built rows): tooltips, copy, dialogs.
  bindTooltips();
  bindCodeBlocks();
  bindDialogs();
  initRail();
  initRailFit();
  initNavGroups();
  initPalette();
}
