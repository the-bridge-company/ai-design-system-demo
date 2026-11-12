// A tab left open across a deploy asks for the old build's code files (/_astro/<name>.<hash>.js) when it opens an
// island or a lazy part, and the new deploy no longer has them (404): the page stays on its skeletons and never
// hydrates. When a code file fails to load, the page reloads once to the new version. A second failure within
// RELOAD_GUARD_MS does not reload again (a broken deploy, an offline tab): the page stays as it is, never a loop.
//
// Where a failure shows: Vite's preload helper fires `vite:preloadError` on window; a dynamic import nobody caught is an
// `unhandledrejection`; an Astro island catches its own import and only logs "[astro-island] Error hydrating" with the
// error (console.error), so that log is read too. Installed first in the head of every page (layouts/Layout.astro).

/** The session key holding when this tab last reloaded for a missing code file (ms). */
export const RELOAD_KEY = 'bridge.chunkReloadAt';
/** No second reload within this window: a deploy that is still broken after one reload is not fixed by another. */
export const RELOAD_GUARD_MS = 60_000;

/** The browsers' words for a module (or its CSS) that could not be fetched. */
const CHUNK_WORDS = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|Failed to load module script/i;

/** Whether `reason` (an error, an event's reason, a message) says a code file of the build could not be loaded. */
export function isChunkLoadError(reason: unknown): boolean {
  if (!reason) return false;
  if (typeof reason === 'string') return CHUNK_WORDS.test(reason);
  if (typeof reason === 'object') {
    const r = reason as { message?: unknown; name?: unknown; payload?: unknown };
    if (typeof r.message === 'string' && CHUNK_WORDS.test(r.message)) return true;
    // Vite's preload error carries the original error as `payload`.
    if (r.payload && r.payload !== reason) return isChunkLoadError(r.payload);
  }
  return false;
}

/** Whether a reload is allowed now, given when the tab last reloaded for this (null: never). */
export function mayReload(lastAt: number | null, now: number, guardMs = RELOAD_GUARD_MS): boolean {
  return lastAt === null || !Number.isFinite(lastAt) || now - lastAt >= guardMs || now < lastAt;
}

export interface ReloadEnv {
  storage: Pick<Storage, 'getItem' | 'setItem'> | null;
  reload: () => void;
  now: () => number;
}

/**
 * Reloads once for a missing code file: notes the time first, then reloads. Without session storage (blocked, private
 * mode) it never reloads, since nothing would stop a loop. Returns whether it reloaded.
 */
export function reloadOnce(env: ReloadEnv): boolean {
  if (!env.storage) return false;
  const now = env.now();
  try {
    const raw = env.storage.getItem(RELOAD_KEY);
    const last = raw === null ? null : Number(raw);
    if (!mayReload(last, now)) return false;
    env.storage.setItem(RELOAD_KEY, String(now));
  } catch {
    return false;
  }
  env.reload();
  return true;
}

/** Hooks the page: every way a missing code file shows leads to reloadOnce. Returns a function that unhooks it. */
export function installChunkReload(win: Window & typeof globalThis = window): () => void {
  let storage: Storage | null = null;
  try {
    storage = win.sessionStorage;
  } catch {
    storage = null;
  }
  const env: ReloadEnv = { storage, reload: () => win.location.reload(), now: () => Date.now() };
  const onPreload = (e: Event) => {
    if (reloadOnce(env)) e.preventDefault();
  };
  const onRejection = (e: PromiseRejectionEvent) => {
    if (isChunkLoadError(e.reason) && reloadOnce(env)) e.preventDefault();
  };
  const onError = (e: ErrorEvent) => {
    if (isChunkLoadError(e.error ?? e.message)) reloadOnce(env);
  };
  win.addEventListener('vite:preloadError', onPreload);
  win.addEventListener('unhandledrejection', onRejection);
  win.addEventListener('error', onError);
  // An island that could not load its code only logs it: read that one log, pass every log on unchanged.
  const original = win.console.error;
  const patched = function (this: Console, ...args: unknown[]) {
    try {
      if (typeof args[0] === 'string' && args[0].startsWith('[astro-island]') && args.slice(1).some(isChunkLoadError)) reloadOnce(env);
    } catch {
      /* Never in the way of a log. */
    }
    return original.apply(this, args as []);
  };
  win.console.error = patched;
  return () => {
    win.removeEventListener('vite:preloadError', onPreload);
    win.removeEventListener('unhandledrejection', onRejection);
    win.removeEventListener('error', onError);
    if (win.console.error === patched) win.console.error = original;
  };
}
