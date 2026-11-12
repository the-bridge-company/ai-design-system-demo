---
"@bridge-ds/react": minor
"@bridge-ds/docs-site": patch
---

`TabsPanel` can live outside its `Tabs` root: give it `tabId` (the id of its Tab, which points back with
`aria-controls`) and it renders the same DS panel, a labelled tabpanel in the tab order, shown until the page picks
one. `showTabsPanel()` from `@bridge-ds/react/dom` shows the picked panel and hides the others. For pages whose tabs
are one island and whose panels are server-rendered or hold islands of their own.

The Team Settings groups and the four panels of a Library component page are now DS TabsPanels linked to their DS
Tabs, instead of hand-made tabpanels: the docs site has no imitation left.
