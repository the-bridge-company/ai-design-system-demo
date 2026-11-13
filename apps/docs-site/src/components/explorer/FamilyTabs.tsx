// The token cell editor's palette families (scripts/explorer/inline-edit.ts): the DS Tabs, contained variant at the
// small size, so they look and behave like every DS tab list (raised plate, arrow keys, Home and End, tablist and tab
// roles). Arrow keys pick the family as they move, as before: the ramp under the tabs follows at once. The editor
// itself is vanilla and redraws on every pick, so it mounts this island once (mountFamilyTabs) and moves its node back
// into each redraw. "More" stays beside the list: it opens the DS Menu of the other families, it is not a tab.
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { ChevronDown } from 'lucide-react';
import { Button, Menu, MenuContent, MenuItem, MenuTrigger, Tab, Tabs, TabsList } from '@bridge-ds/react';

export interface FamilyTab {
  value: number;
  label: string;
}

export interface FamilyTabsProps {
  tabs: FamilyTab[];
  /** The other families, in the More menu. */
  more?: FamilyTab[];
  value: number;
  onPick: (value: number) => void;
  /** Bumped by the mount's remeasure(): draws the tabs again once the editor has its final width. */
  measure?: number;
}

export function FamilyTabs({ tabs, more = [], value, onPick, measure = 0 }: FamilyTabsProps) {
  return (
    <>
      {/* Keyed on the picked family: the raised plate (the DS Tabs indicator) is measured afresh under the family of
          the current value every time it changes, never left under a tab picked earlier or measured before the editor
          took its final width. The editor puts focus back on the picked tab after each redraw. */}
      <Tabs key={`${value}-${measure}`} variant="contained" size="sm" value={value} onValueChange={(v) => typeof v === 'number' && v !== value && onPick(v)} className="xe-family-tabs">
        <TabsList aria-label="Families" activateOnFocus>
          {tabs.map((t) => (
            <Tab key={t.value} value={t.value} data-xe-fam={t.value}>
              {t.label}
            </Tab>
          ))}
        </TabsList>
      </Tabs>
      {more.length > 0 && (
        <Menu>
          <MenuTrigger render={<Button variant="ghost" size="sm" iconEnd={ChevronDown} data-xe-family-menu>More</Button>} />
          <MenuContent align="end" className="xe-fam-menu" aria-label="More families">
            {more.map((t) => (
              <MenuItem key={t.value} data-xe-family={t.value} onClick={() => onPick(t.value)}>
                {t.label}
              </MenuItem>
            ))}
          </MenuContent>
        </Menu>
      )}
    </>
  );
}

export interface FamilyTabsMount {
  /** Draws the tabs (synchronously, so focus can move to a tab right after) into the slot of the editor's redraw. */
  render: (slot: Element | null, props: FamilyTabsProps) => void;
  /** Draws the last tabs again where they are (after the editor took its final width), keeping focus on the picked tab. */
  remeasure: () => void;
  unmount: () => void;
}

/** One React root for the life of an editor. Its node moves into each redraw's slot instead of being rebuilt. */
export function mountFamilyTabs(): FamilyTabsMount {
  const host = document.createElement('div');
  host.className = 'xe-family-host';
  const root = createRoot(host);
  let last: FamilyTabsProps | null = null;
  let measure = 0;
  const draw = () => last && flushSync(() => root.render(<FamilyTabs {...last!} measure={measure} />));
  return {
    render(slot, props) {
      if (!slot) return;
      slot.replaceWith(host);
      last = props;
      draw();
    },
    remeasure() {
      if (!last || !host.isConnected) return;
      const hadFocus = host.contains(document.activeElement);
      measure++;
      draw();
      if (hadFocus) host.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
    },
    unmount() {
      root.unmount();
    },
  };
}
