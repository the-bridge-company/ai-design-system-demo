// Team Settings in four groups, one shown at a time (pages/team-shell/settings): a section nav on top, each group's
// bands below it, instead of one long scroll with every section open. Pure, covered by settings-sections.test.ts;
// scripts/settings-sections.ts switches the groups in the browser. Without script every group shows, in order.
//
// Every anchor a link or a redirect may land on (#roles, #changes, #team, #figma...) opens the group that holds it, so
// old links keep working even before the band itself is drawn (its island renders after the team is read).

export type SettingsGroupKey = 'team' | 'reviews' | 'tools' | 'you';

export interface SettingsGroup {
  key: SettingsGroupKey;
  /** The nav item, one or two words. */
  label: string;
  /** The anchors of the bands inside it, in page order (and the older anchors that now land there). */
  anchors: readonly string[];
}

export const SETTINGS_GROUPS: readonly SettingsGroup[] = [
  {
    key: 'team',
    label: 'Team',
    anchors: ['general', 'team', 'members', 'products', 'library-access', 'danger-zone'],
  },
  {
    key: 'reviews',
    label: 'Reviews',
    anchors: ['roles', 'approvals', 'changes', 'github-usage', 'safety', 'protection', 'repository'],
  },
  {
    key: 'tools',
    label: 'Tools',
    anchors: ['team-claude', 'tools', 'figma', 'integrations'],
  },
  {
    key: 'you',
    label: 'You',
    anchors: ['appearance', 'ai-tools', 'account'],
  },
];

export const DEFAULT_SETTINGS_GROUP: SettingsGroupKey = 'team';

/** The id of a group's region on the page ("set-group-team"): its own anchor too. */
export const groupId = (key: SettingsGroupKey) => `set-group-${key}`;

/** The group an address hash opens ("#roles", "roles", "#set-group-tools"), else the default group. */
export function groupForHash(hash: string | null | undefined): SettingsGroupKey {
  const h = decodeURIComponent((hash ?? '').replace(/^#/, '')).trim().toLowerCase();
  if (!h) return DEFAULT_SETTINGS_GROUP;
  const byId = SETTINGS_GROUPS.find((g) => groupId(g.key) === h || g.key === h);
  if (byId) return byId.key;
  return SETTINGS_GROUPS.find((g) => g.anchors.includes(h))?.key ?? DEFAULT_SETTINGS_GROUP;
}

/** True when the hash names a band inside the group (so the page scrolls to it), not the group itself. */
export function hashNamesBand(hash: string | null | undefined): boolean {
  const h = (hash ?? '').replace(/^#/, '').trim().toLowerCase();
  return Boolean(h) && SETTINGS_GROUPS.some((g) => g.anchors.includes(h));
}
