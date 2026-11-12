---
"@bridge-ds/react": minor
"@bridge-ds/docs-site": patch
---

Badge takes `appearance="count"` for the number next to a group heading in a review list: ink figures (text.default, medium, tabular, caption 12/16) on the emphasis neutral fill, no border, at 7:1 or more in every brand and theme; inside the current or selected item it takes the stronger tone (surface.inverse). `tone` is ignored for counts. Nav and tab counts are unchanged (Tabs, SegmentedControl and SidebarNav keep their count slot).

Library review: the group and chapter counts (Foundations 5, Colors 4) use it. Before, they were muted text on the neutral status fill with a hairline border (5.08:1) and read as disabled on the tinted group cards.
