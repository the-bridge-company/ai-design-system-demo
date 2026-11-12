// Team Settings, the tabs over the four groups (lib/settings-sections.ts): the DS Tabs, underline variant, so they look
// and behave like every other DS tab list (signal indicator, arrow keys, Home and End, tablist and tab roles). The
// groups stay in the page (pages/team-shell/settings) as the tab panels, since they hold islands of their own: each
// tab points at its group (aria-controls), each group names its tab (aria-labelledby). scripts/settings-sections.ts
// shows one group at a time and keeps it in the address, so every old anchor (#roles, #figma) opens the right tab.
import { useEffect, useRef, useState } from 'react';
import { Tab, Tabs, TabsList } from '@bridge-ds/react';
import { DEFAULT_SETTINGS_GROUP, SETTINGS_GROUPS, groupId, isSettingsGroup, tabId, type SettingsGroupKey } from '../../../lib/settings-sections';
import { initSettingsSections, type SettingsSections } from '../../../scripts/settings-sections';

export default function SettingsTabs() {
  const [value, setValue] = useState<SettingsGroupKey>(DEFAULT_SETTINGS_GROUP);
  const sections = useRef<SettingsSections | null>(null);
  useEffect(() => {
    sections.current = initSettingsSections(setValue);
    return () => sections.current?.dispose();
  }, []);
  return (
    <Tabs value={value} onValueChange={(v) => isSettingsGroup(v) && (sections.current ? sections.current.select(v) : setValue(v))}>
      <TabsList aria-label="Settings sections">
        {SETTINGS_GROUPS.map((g) => (
          <Tab key={g.key} value={g.key} id={tabId(g.key)} aria-controls={groupId(g.key)}>
            {g.label}
          </Tab>
        ))}
      </TabsList>
    </Tabs>
  );
}
