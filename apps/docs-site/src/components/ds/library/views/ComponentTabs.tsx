// Library > Components > one component: the Usage, Tokens, Code and Changelog tabs. The DS Tabs (underline variant),
// so they look and behave like every DS tab list: signal indicator, arrow keys, Home and End, tablist and tab roles,
// the Changelog's release count in the tab's count tag. The panels are DS TabsPanels in ComponentView.tsx, outside
// this Tabs root (static on Bridge's own page): each tab points at its panel (aria-controls), each panel names its tab
// (tabId), and the page script shows the picked one with showTabsPanel (@bridge-ds/react/dom). The page script
// (scripts/component-page.ts) shows the panel, keeps the tab in the address and opens old anchors; the two talk
// through CP_TAB_PICK and CP_TAB_SHOWN (lib/library/component-page.ts).
import { useEffect, useState } from 'react';
import { Tab, Tabs, TabsList } from '@bridge-ds/react';
import { COMPONENT_TABS, CP_TAB_PICK, CP_TAB_SHOWN, componentTabButtonId, componentTabPanelId, isComponentTab, type ComponentTabId } from '../../../../lib/library/component-page';

export interface ComponentTabsProps {
  /** The component's name, for the tab list's label ("Button documentation"). */
  name: string;
  /** Release notes that name the component: the Changelog tab's count, none when 0. */
  changelogCount?: number;
}

const idOf = (e: Event) => (e as CustomEvent<{ id?: unknown }>).detail?.id;

export default function ComponentTabs({ name, changelogCount = 0 }: ComponentTabsProps) {
  const [value, setValue] = useState<ComponentTabId>(COMPONENT_TABS[0].id);
  useEffect(() => {
    // The script may have shown a panel before this island woke up (an address like #code): start on it.
    const shown = document.querySelector<HTMLElement>('.cp-page')?.dataset.cpTab;
    if (isComponentTab(shown)) setValue(shown);
    const onShown = (e: Event) => {
      const id = idOf(e);
      if (isComponentTab(id)) setValue(id);
    };
    document.addEventListener(CP_TAB_SHOWN, onShown);
    return () => document.removeEventListener(CP_TAB_SHOWN, onShown);
  }, []);
  const pick = (v: unknown) => {
    if (!isComponentTab(v)) return;
    setValue(v);
    document.dispatchEvent(new CustomEvent(CP_TAB_PICK, { detail: { id: v } }));
  };
  return (
    <Tabs value={value} onValueChange={pick} className="cp-tabs">
      <TabsList aria-label={`${name} documentation`} data-cp-tabs="">
        {COMPONENT_TABS.map((t) => (
          <Tab
            key={t.id}
            value={t.id}
            id={componentTabButtonId(t.id)}
            aria-controls={componentTabPanelId(t.id)}
            count={t.id === 'changelog' && changelogCount > 0 ? changelogCount : undefined}
          >
            {t.label}
          </Tab>
        ))}
      </TabsList>
    </Tabs>
  );
}
