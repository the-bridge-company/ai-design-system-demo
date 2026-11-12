---
"@bridge-ds/react": minor
"@bridge-ds/docs-site": patch
---

`@bridge-ds/react/dom` renders two more components for pages without React at runtime: `buttonHtml()`,
`buttonClassName()` and `iconButtonHtml()` give the exact markup of Button and IconButton, `drawerHtml()` gives the
markup of Drawer, which opens and closes with the Dialog functions (`openDialog`, `closeDialog`). Parity tests compare
each with its React component.

Bridge's Library, homepage and site use the real design system components instead of hand-made copies: the site
buttons are DS Buttons and IconButtons, the token detail drawer and the Studio component drawer are the DS Drawer,
the copy toast is the DS Toast, the homepage step tabs are the DS Tabs, the "Copy as" menu of every token row is one
DS SegmentedControl per page, the "Used by" chip is a DS Button that opens its list and "Unused" a DS Badge.
