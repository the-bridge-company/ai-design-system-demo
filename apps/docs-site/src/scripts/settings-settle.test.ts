// @vitest-environment jsdom
// Team Settings: a group shows once its bands have settled (islands hydrated, nothing busy, height still), never while
// they still move each other; and never later than the cap. The page and its CSS keep the group invisible until then.
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SETTLE_MAX_MS, SETTLE_QUIET_MS, settleSettingsGroups, settleWhenStill } from './settings-settle';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

let height = 0;
const group = (inner: string) => {
  document.body.innerHTML = `<div data-set-group="team">${inner}</div>`;
  const g = document.querySelector<HTMLElement>('[data-set-group]')!;
  g.getBoundingClientRect = () => ({ height }) as DOMRect;
  return g;
};

beforeEach(() => {
  vi.useFakeTimers();
  height = 100;
});
afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('settings-settle', () => {
  it('waits for every island to hydrate and for nothing to be busy, then for the height to stay still', () => {
    const g = group('<astro-island ssr></astro-island><div aria-busy="true"></div>');
    settleWhenStill(g);
    vi.advanceTimersByTime(SETTLE_QUIET_MS * 2);
    expect(g.hasAttribute('data-settled')).toBe(false);
    g.querySelector('astro-island')!.removeAttribute('ssr');
    vi.advanceTimersByTime(SETTLE_QUIET_MS * 2);
    expect(g.hasAttribute('data-settled')).toBe(false);
    g.querySelector('[aria-busy]')!.setAttribute('aria-busy', 'false');
    // A band still grows: the clock starts again.
    vi.advanceTimersByTime(SETTLE_QUIET_MS - 50);
    height = 180;
    vi.advanceTimersByTime(SETTLE_QUIET_MS - 50);
    expect(g.hasAttribute('data-settled')).toBe(false);
    vi.advanceTimersByTime(100);
    expect(g.hasAttribute('data-settled')).toBe(true);
  });

  it('shows the group after the cap, whatever still moves', () => {
    const g = group('<astro-island ssr></astro-island>');
    settleWhenStill(g);
    vi.advanceTimersByTime(SETTLE_MAX_MS + 50);
    expect(g.hasAttribute('data-settled')).toBe(true);
  });

  it('every group of the page waits, each on its own', () => {
    document.body.innerHTML = '<div data-set-group="team"><astro-island ssr></astro-island></div><div data-set-group="you"></div>';
    settleSettingsGroups();
    vi.advanceTimersByTime(SETTLE_QUIET_MS + 100);
    const [team, you] = document.querySelectorAll('[data-set-group]');
    expect(team!.hasAttribute('data-settled')).toBe(false);
    expect(you!.hasAttribute('data-settled')).toBe(true);
  });

  it('the page hides each unsettled group under a skeleton out of flow, and starts the wait', () => {
    const page = read('../pages/team-shell/settings/index.astro');
    expect(page.match(/<TabsPanel className="set-group"[^>]*>\s*\{[^}]*\}\s*<div class="set-wait" aria-hidden="true">/g)).toHaveLength(4);
    expect(page).toContain('settleSettingsGroups();');
    const css = read('../styles/settings.css');
    expect(css).toMatch(/\.ts \.set-group:not\(\[data-settled\]\) > :not\(\.set-wait\) \{\s*visibility: hidden;/);
    expect(css).toMatch(/\.set-wait \{\s*position: absolute;/);
  });
});
