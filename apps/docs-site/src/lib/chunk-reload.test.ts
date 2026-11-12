import { describe, expect, it, vi } from 'vitest';
import { RELOAD_GUARD_MS, RELOAD_KEY, installChunkReload, isChunkLoadError, mayReload, reloadOnce } from './chunk-reload';

const memoryStorage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
};

describe('isChunkLoadError', () => {
  it('knows each browser’s words for a code file that could not be loaded', () => {
    expect(isChunkLoadError(new TypeError('Failed to fetch dynamically imported module: https://x.test/_astro/A.1a2b.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: https://x.test/_astro/A.js'))).toBe(true);
    expect(isChunkLoadError({ payload: new Error('Unable to preload CSS for /_astro/a.css') })).toBe(true);
  });

  it('leaves every other failure alone', () => {
    expect(isChunkLoadError(new Error('Bridge is busy, try again in 2 min.'))).toBe(false);
    expect(isChunkLoadError(new TypeError('Failed to fetch'))).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});

describe('reloadOnce', () => {
  it('reloads once, then not again within the guard window, then again after it', () => {
    const storage = memoryStorage();
    const reload = vi.fn();
    let now = 1_000_000;
    const env = { storage, reload, now: () => now };
    expect(reloadOnce(env)).toBe(true);
    expect(storage.m.get(RELOAD_KEY)).toBe('1000000');
    now += RELOAD_GUARD_MS - 1;
    expect(reloadOnce(env)).toBe(false);
    now += 1;
    expect(reloadOnce(env)).toBe(true);
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it('never reloads without session storage (nothing would stop a loop)', () => {
    const reload = vi.fn();
    expect(reloadOnce({ storage: null, reload, now: () => 1 })).toBe(false);
    const throwing = { getItem: () => { throw new Error('blocked'); }, setItem: () => undefined };
    expect(reloadOnce({ storage: throwing, reload, now: () => 1 })).toBe(false);
    expect(reload).not.toHaveBeenCalled();
  });

  it('mayReload reads a clock that went back as allowed', () => {
    expect(mayReload(null, 5)).toBe(true);
    expect(mayReload(10, 5)).toBe(true);
    expect(mayReload(5, 6)).toBe(false);
  });
});

describe('installChunkReload', () => {
  const fakeWindow = () => {
    const target = new EventTarget();
    const storage = memoryStorage();
    const reload = vi.fn();
    const logged: unknown[][] = [];
    const win = Object.assign(target, {
      sessionStorage: storage,
      location: { reload },
      console: { error: (...a: unknown[]) => void logged.push(a) },
    });
    return { win: win as unknown as Window & typeof globalThis, reload, logged };
  };

  it('reloads on Vite’s preload error and cancels it', () => {
    const { win, reload } = fakeWindow();
    const off = installChunkReload(win);
    const e = new Event('vite:preloadError', { cancelable: true });
    win.dispatchEvent(e);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
    off();
  });

  it('reloads on an island that could not load its code, and still logs it', () => {
    const { win, reload, logged } = fakeWindow();
    const off = installChunkReload(win);
    win.console.error('[astro-island] Error hydrating /_astro/StudioHome.abc.js', new TypeError('Failed to fetch dynamically imported module: /_astro/StudioHome.abc.js'));
    expect(reload).toHaveBeenCalledTimes(1);
    expect(logged).toHaveLength(1);
    // A second failure right after (the same broken deploy) does not loop.
    win.console.error('[astro-island] Error hydrating /_astro/Other.js', new TypeError('Importing a module script failed.'));
    expect(reload).toHaveBeenCalledTimes(1);
    off();
  });

  it('reloads on an uncaught dynamic import, never on another rejection', () => {
    const { win, reload } = fakeWindow();
    const off = installChunkReload(win);
    const rejection = (reason: unknown) => Object.assign(new Event('unhandledrejection', { cancelable: true }), { reason });
    win.dispatchEvent(rejection(new Error('Bridge is busy')));
    expect(reload).not.toHaveBeenCalled();
    win.dispatchEvent(rejection(new TypeError('Failed to fetch dynamically imported module: /_astro/x.js')));
    expect(reload).toHaveBeenCalledTimes(1);
    off();
  });

  it('unhooks cleanly', () => {
    const { win, reload } = fakeWindow();
    const before = win.console.error;
    const off = installChunkReload(win);
    off();
    expect(win.console.error).toBe(before);
    win.dispatchEvent(new Event('vite:preloadError', { cancelable: true }));
    expect(reload).not.toHaveBeenCalled();
  });
});
