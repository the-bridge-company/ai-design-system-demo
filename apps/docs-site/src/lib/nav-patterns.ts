// Whether a team's Studio nav shows Patterns (lib/nav.ts studioNav, `until: 'patterns'`): the same rule as its Library
// (scripts/library-team.ts showPatternsNav), once the team's data has patterns. The answer is kept per team in this
// browser, so the entry paints at once on the next page instead of after the team's data is read again.
// Pure: the storage is passed in. Unit tested in nav-patterns.test.ts.

/** The browser memory of a team's answer ("1" has patterns, "0" has none). */
export const navPatternsKey = (team: string): string => `bridge.nav.patterns:${team.toLowerCase()}`;

/** Fired on the document when a team's data says whether it has patterns: detail { team, has }. */
export const NAV_PATTERNS_EVENT = 'bridge:team-patterns';

type Store = Pick<Storage, 'getItem' | 'setItem'> | null | undefined;

/** What this browser remembers for the team: true, false, or null when it never read the team. */
export function rememberedPatterns(team: string | null, storage: Store): boolean | null {
  if (!team || !storage) return null;
  try {
    const v = storage.getItem(navPatternsKey(team));
    return v === '1' ? true : v === '0' ? false : null;
  } catch {
    return null;
  }
}

/** Keeps the team's answer for the next pages. */
export function notePatterns(team: string, has: boolean, storage: Store): void {
  try {
    storage?.setItem(navPatternsKey(team), has ? '1' : '0');
  } catch {
    /* storage blocked: the next page reads the team's data again */
  }
}

/** The Design system pages the rail draws: a page built hidden (`until`) only once the team has patterns. */
export const shownDesignPages = <P extends { until?: 'patterns' | undefined }>(pages: readonly P[], patterns: boolean): P[] => pages.filter((p) => !p.until || patterns);
