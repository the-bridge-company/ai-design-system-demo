// What this browser keeps for a failed read later (a team's settings, its design system model, GitHub answers, the
// saved list) is tagged with the shape of the data and the app build that kept it. A copy from another build, or of an
// older shape, is ignored and dropped: it may say things the code reading it no longer means. A kept copy only ever
// stands in when the live read fails, never as the first paint while GitHub answers.

/** Bump when the shape of anything kept in the browser changes. */
export const KEPT_SHAPE = 2;

declare const __BRIDGE_BUILD__: string | undefined;

/** The app build (the deploy's commit, set by astro.config.mjs), 'dev' where none is set (tests, dev server). */
export const APP_BUILD: string = typeof __BRIDGE_BUILD__ === 'string' && __BRIDGE_BUILD__ ? __BRIDGE_BUILD__ : 'dev';

/** The tag every kept copy carries: shape and build. */
export const KEPT_VERSION = `${KEPT_SHAPE}:${APP_BUILD}`;

/** Wraps a value for keeping, tagged with `version` (KEPT_VERSION by default). */
export const keptEnvelope = <T>(value: T, version: string = KEPT_VERSION): { v: string; value: T } => ({ v: version, value });

/**
 * The value of a kept envelope, or undefined when it is missing, not an envelope (kept before versions) or from
 * another shape or build.
 */
export function keptValue<T>(raw: unknown, version: string = KEPT_VERSION): T | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const e = raw as { v?: unknown; value?: unknown };
  return e.v === version && 'value' in e ? (e.value as T) : undefined;
}
