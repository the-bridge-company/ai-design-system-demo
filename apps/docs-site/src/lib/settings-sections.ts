// Team Settings in four groups, one shown at a time (pages/team-shell/settings): the DS Tabs on top
// (components/ds/studio/SettingsTabs.tsx), each group's bands below it as that tab's panel, instead of one long scroll
// with every section open. Pure, covered by settings-sections.test.ts; scripts/settings-sections.ts switches the groups
// in the browser. Without script every group shows, in order.
//
// Every anchor a link or a redirect may land on (#roles, #changes, #team, #figma...) opens the group that holds it, so
// old links keep working even before the band itself is drawn (its island renders after the team is read).

export type SettingsGroupKey = 'team' | 'reviews' | 'tools' | 'you';

export interface SettingsGroup {
  key: SettingsGroupKey;
  /** The tab's label, one or two words. */
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
    anchors: ['face', 'appearance', 'ai-tools', 'account'],
  },
];

export const DEFAULT_SETTINGS_GROUP: SettingsGroupKey = 'team';

/** The id of a group's region on the page ("set-group-team"): its own anchor too. */
export const groupId = (key: SettingsGroupKey) => `set-group-${key}`;

/** The id of a group's tab ("set-tab-team"): the panel's aria-labelledby. */
export const tabId = (key: SettingsGroupKey) => `set-tab-${key}`;

/** True for a known group key, so a value from the tabs or the address is checked before it is used. */
export const isSettingsGroup = (key: unknown): key is SettingsGroupKey => SETTINGS_GROUPS.some((g) => g.key === key);

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
