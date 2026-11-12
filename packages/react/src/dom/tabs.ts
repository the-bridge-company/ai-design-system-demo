/**
 * Shows one linked panel of the DS Tabs and hides the others: the panels a `<TabsPanel tabId>` renders outside its
 * Tabs root (`data-tabs-panel` with their value), on a page whose tabs are one island and whose panels are not. Call it
 * from the tabs' `onValueChange` (and on load, for the value the address names). Only the panels inside `scope` move,
 * so two tab sets on one page stay apart. Returns the panel shown, or null when no panel has that value (then every
 * panel in scope is hidden).
 */
export function showTabsPanel(scope: ParentNode, value: string | number): HTMLElement | null {
  const want = String(value);
  let shown: HTMLElement | null = null;
  for (const panel of Array.from(scope.querySelectorAll<HTMLElement>('[data-tabs-panel]'))) {
    const on = panel.dataset.tabsPanel === want;
    panel.hidden = !on;
    if (on && !shown) shown = panel;
  }
  return shown;
}
