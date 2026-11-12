// The token cell editor's palette families (scripts/explorer/inline-edit.ts): the DS Tabs, contained variant at the
// small size, so they look and behave like every DS tab list (raised plate, arrow keys, Home and End, tablist and tab
// roles). Arrow keys pick the family as they move, as before: the ramp under the tabs follows at once. The editor
// itself is vanilla and redraws on every pick, so it mounts this island once (mountFamilyTabs) and moves its node back
// into each redraw. "More" stays beside the list: it opens a menu, it is not a tab.
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { Tab, Tabs, TabsList } from '@bridge-ds/react';

export interface FamilyTab {
  value: number;
  label: string;
}

export interface FamilyTabsProps {
  tabs: FamilyTab[];
  value: number;
  onPick: (value: number) => void;
}

export function FamilyTabs({ tabs, value, onPick }: FamilyTabsProps) {
  return (
    <Tabs variant="contained" size="sm" value={value} onValueChange={(v) => typeof v === 'number' && v !== value && onPick(v)} className="xe-family-tabs">
      <TabsList aria-label="Families" activateOnFocus>
        {tabs.map((t) => (
          <Tab key={t.value} value={t.value} data-xe-family-tab={t.value}>
            {t.label}
          </Tab>
        ))}
      </TabsList>
    </Tabs>
  );
}

export interface FamilyTabsMount {
  /** Draws the tabs (synchronously, so focus can move to a tab right after) into the slot of the editor's redraw. */
  render: (slot: Element | null, props: FamilyTabsProps) => void;
  unmount: () => void;
}

/** One React root for the life of an editor. Its node moves into each redraw's slot instead of being rebuilt. */
export function mountFamilyTabs(): FamilyTabsMount {
  const host = document.createElement('div');
  host.className = 'xe-family-host';
  const root = createRoot(host);
  return {
    render(slot, props) {
      if (!slot) return;
      slot.replaceWith(host);
      flushSync(() => root.render(<FamilyTabs {...props} />));
    },
    unmount() {
      root.unmount();
    },
  };
}
