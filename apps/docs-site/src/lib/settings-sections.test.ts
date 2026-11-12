import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS_GROUP, SETTINGS_GROUPS, groupForHash, groupId, hashNamesBand, isSettingsGroup, tabId } from './settings-sections';

describe('Team Settings in four groups', () => {
  it('has four short groups, each anchor in one group only', () => {
    expect(SETTINGS_GROUPS.map((g) => g.label)).toEqual(['Team', 'Reviews', 'Tools', 'You']);
    const all = SETTINGS_GROUPS.flatMap((g) => g.anchors);
    expect(new Set(all).size).toBe(all.length);
    for (const g of SETTINGS_GROUPS) expect(g.label).not.toMatch(/—/);
  });

  it('opens the group that holds an old anchor, so links and redirects keep landing', () => {
    expect(groupForHash('#roles')).toBe('reviews');
    expect(groupForHash('#approvals')).toBe('reviews');
    expect(groupForHash('#changes')).toBe('reviews');
    expect(groupForHash('#safety')).toBe('reviews');
    expect(groupForHash('#team')).toBe('team');
    expect(groupForHash('#members')).toBe('team');
    expect(groupForHash('#products')).toBe('team');
    expect(groupForHash('#figma')).toBe('tools');
    expect(groupForHash('#team-claude')).toBe('tools');
    expect(groupForHash('#appearance')).toBe('you');
    expect(groupForHash('#ai-tools')).toBe('you');
  });

  it('reads a group address, and falls back to the first group', () => {
    expect(groupForHash(`#${groupId('tools')}`)).toBe('tools');
    expect(groupForHash('')).toBe(DEFAULT_SETTINGS_GROUP);
    expect(groupForHash(null)).toBe('team');
    expect(groupForHash('#nowhere')).toBe('team');
  });

  it('scrolls only for a band, not for a group', () => {
    expect(hashNamesBand('#roles')).toBe(true);
    expect(hashNamesBand(`#${groupId('reviews')}`)).toBe(false);
    expect(hashNamesBand('')).toBe(false);
  });

  it('gives each group a tab id for its panel to name, and checks a tab value', () => {
    expect(tabId('tools')).toBe('set-tab-tools');
    expect(new Set(SETTINGS_GROUPS.map((g) => tabId(g.key))).size).toBe(SETTINGS_GROUPS.length);
    expect(isSettingsGroup('you')).toBe(true);
    expect(isSettingsGroup('roles')).toBe(false);
    expect(isSettingsGroup(null)).toBe(false);
  });
});
