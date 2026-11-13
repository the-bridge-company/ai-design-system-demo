// Team Settings (pages/team-shell/settings): each group's bands are islands that mount after first paint and then read
// the team (members, products, library access), each one changing the height of the bands under it. A group stays
// invisible, its place kept under a skeleton out of flow (styles/settings.css), until its bands have settled: every
// island hydrated, nothing busy, and the group's height still for a moment. Then it shows at once: content that
// appears is not a layout shift, content that moves in view is.

/** How long the group's height must stay the same before it shows. */
export const SETTLE_QUIET_MS = 200;
/** The longest a group waits: past this it shows whatever it holds. */
export const SETTLE_MAX_MS = 2500;
const TICK_MS = 50;

/** Whether the group's islands are all hydrated and none of its parts says it is busy. */
export function groupReady(group: Element): boolean {
  return !group.querySelector('astro-island[ssr]') && !group.querySelector('[aria-busy="true"]');
}

/**
 * Marks `group` data-settled once it is ready and its height has not changed for `quiet` ms, or after `max` ms.
 * Returns a function that stops waiting (and settles it).
 */
export function settleWhenStill(group: HTMLElement, opts: { quiet?: number; max?: number } = {}): () => void {
  const quiet = opts.quiet ?? SETTLE_QUIET_MS;
  const max = opts.max ?? SETTLE_MAX_MS;
  const start = Date.now();
  let lastHeight = -1;
  let stillSince = start;
  let timer: number | null = null;
  const settle = () => {
    if (timer !== null) window.clearInterval(timer);
    timer = null;
    group.dataset.settled = '';
  };
  const tick = () => {
    const now = Date.now();
    const h = group.getBoundingClientRect().height;
    if (h !== lastHeight || !groupReady(group)) {
      lastHeight = h;
      stillSince = now;
    }
    if (now - stillSince >= quiet || now - start >= max) settle();
  };
  timer = window.setInterval(tick, TICK_MS);
  tick();
  return settle;
}

/** Every Settings group of the page waits for its bands (a group shown later from its tab has settled by then). */
export function settleSettingsGroups(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>('[data-set-group]:not([data-settled])').forEach((g) => void settleWhenStill(g));
}
