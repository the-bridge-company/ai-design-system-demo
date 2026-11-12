// The Library <-> Studio switch in the top bar (components/SpaceSwitch.tsx) in the browser:
// - the target: the layout renders it at build time; where the query or the team decides it (a Studio drawer at
//   ?c=button, a team shell, a team's Library) it is resolved again here, on load and before each use;
// - the click: the plate moves to the other space (it becomes the current segment), then the other space loads, NAVIGATE_AFTER_MS later (at once under reduced motion).
//   Modified clicks (new tab, new window) are left to the browser;
// - the first-visit hint: once per browser, a dot crosses the track toward the other space.
// The link to the other space carries the hooks (a[data-space-switch]); the control around it (the DS
// SegmentedControl in link mode) carries the state the styles read: data-mode, data-anim, data-hint.
import { isHosted, repoFromPath, studioBase, teamHref } from '../lib/team-path';
import { libraryFromPath } from '../lib/library-shells';
import {
  isPlainClick,
  markHintSeen,
  NAVIGATE_AFTER_MS,
  otherSpace,
  shouldShowHint,
  switchTarget,
  switchTooltip,
  type SwitchContext,
  type SwitchSpace,
} from '../lib/space-switch';

export interface SpaceSwitchOptions {
  /** Loads the other space. Default: location.assign. */
  navigate?: (href: string) => void;
  /** Default: the prefers-reduced-motion media query. */
  reducedMotion?: boolean;
  /** Where "hint seen" is kept. Default: localStorage, when the browser allows it. */
  store?: Pick<Storage, 'getItem' | 'setItem'> | null;
}

const SELECTOR = 'a[data-space-switch]';

/** The SegmentedControl around the link: where the plate and the motion live. */
const controlOf = (el: HTMLElement): HTMLElement => el.closest<HTMLElement>('[data-segmented-control]') ?? el;

function safeLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** A Studio component's name from the Studio Components list (its row), when the page shows it. */
function studioRowName(slug: string): string | null {
  const row = document.getElementById(`c-${slug}`);
  return row?.querySelector('.cm-name-text')?.textContent?.trim() || null;
}

/** The context of this page for switchTarget, or null where the build-time target is already final. */
function contextOf(el: HTMLAnchorElement): SwitchContext | null {
  const space = el.dataset.switchSpace as SwitchSpace;
  const { pathname, search } = location;
  if (space === 'studio') {
    const hosted = isHosted();
    return { space, pathname, search, studioRoot: studioBase(pathname, hosted), team: hosted ? repoFromPath(pathname) : null, nameOf: studioRowName };
  }
  // A team's Library: /library/<owner>/<repo>/<route>, with that team's Studio.
  const team = document.documentElement.hasAttribute('data-library-shell') ? libraryFromPath(pathname) : null;
  // Bridge's own Library, for an email member (scripts/email-studio.ts set their team's Studio): the same page there.
  if (!team) return el.dataset.studioRoot ? { space, pathname, search, studioRoot: el.dataset.studioRoot } : null;
  const route = pathname.split('/').filter(Boolean).slice(3).join('/');
  const studioRoot = el.dataset.studioRoot ?? teamHref(team.owner, team.repo, null);
  return { space, pathname, search, studioRoot, team, libraryRoute: route ? `${route}/` : '' };
}

/** Points the switch at the right place for this page now, and names it in the tooltip. */
export function refreshSpaceSwitch(root: ParentNode = document) {
  for (const el of root.querySelectorAll<HTMLAnchorElement>(SELECTOR)) {
    const ctx = contextOf(el);
    if (!ctx) continue;
    const target = switchTarget(ctx);
    el.setAttribute('href', target.href);
    el.setAttribute('data-tooltip', switchTooltip(ctx.space, target.item));
  }
}

/** The two segments: the one for the space you are in, and the link to the other one. */
function segmentsOf(el: HTMLElement): { here: HTMLElement | null; there: HTMLElement } {
  return { here: controlOf(el).querySelector<HTMLElement>('[data-switch-current]'), there: el };
}

/** Plays the switch: the plate moves to the other space (it is now the current one) and stretches as it lands. */
export function playSwitch(el: HTMLElement) {
  const space = el.dataset.switchSpace as SwitchSpace;
  const control = controlOf(el);
  const { here, there } = segmentsOf(el);
  control.removeAttribute('data-hint');
  control.removeAttribute('data-anim');
  void control.offsetWidth;
  control.dataset.mode = otherSpace(space);
  here?.removeAttribute('aria-current');
  there.setAttribute('aria-current', 'page');
  control.setAttribute('data-anim', '');
}

/** Puts the switch back as the page rendered it (a page restored from the back/forward cache). */
function settle(el: HTMLElement) {
  const control = controlOf(el);
  const { here, there } = segmentsOf(el);
  control.removeAttribute('data-anim');
  control.dataset.mode = el.dataset.switchSpace;
  there.removeAttribute('aria-current');
  here?.setAttribute('aria-current', 'page');
}

export function initSpaceSwitch(opts: SpaceSwitchOptions = {}) {
  const els = [...document.querySelectorAll<HTMLAnchorElement>(SELECTOR)];
  if (!els.length) return;
  const reduced = opts.reducedMotion ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  const navigate = opts.navigate ?? ((href: string) => location.assign(href));
  const store = opts.store === undefined ? safeLocalStorage() : opts.store;
  refreshSpaceSwitch();

  const hint = shouldShowHint(store, reduced);
  if (hint) markHintSeen(store);

  for (const el of els) {
    if (el.dataset.switchReady) continue;
    el.dataset.switchReady = '';
    const control = controlOf(el);
    if (hint) {
      control.setAttribute('data-hint', '');
      control.addEventListener('animationend', (e) => {
        if ((e as AnimationEvent).animationName === 'ss-hint') control.removeAttribute('data-hint');
      });
    }
    // The page's state can change after load (a Studio drawer opens a component): resolve again before each use.
    el.addEventListener('pointerenter', () => refreshSpaceSwitch(el.parentElement ?? document));
    el.addEventListener('focus', () => refreshSpaceSwitch(el.parentElement ?? document));
    el.addEventListener('click', (e) => {
      refreshSpaceSwitch(el.parentElement ?? document);
      // Already on its way: a second click does not load the page twice.
      if (control.hasAttribute('data-anim')) return e.preventDefault();
      if (!isPlainClick(e)) return;
      const href = el.href;
      e.preventDefault();
      if (reduced) return navigate(href);
      playSwitch(el);
      window.setTimeout(() => navigate(href), NAVIGATE_AFTER_MS);
    });
  }
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) els.forEach(settle);
  });
}
