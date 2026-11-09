---
"@bridge-ds/toolbar": patch
---

The toolbar no longer hides the end of the page. Open or collapsed, the page gets room at its end the height of the bar, its offset from the bottom edge (the phone's safe area included) and a gap, so the last row always scrolls clear of it. The room goes to whatever scrolls under the bar: the document, or an app shell's own scrolling column. The page's own padding is kept and given back when the toolbar goes away.

Live product and This change are one segmented control: one track, the side shown filled in Deep Harbor (the library's SegmentedControl, strong appearance), a radio group named Compare where the arrow keys move between the sides. B still flips sides from anywhere, and the control's tooltip says what the other side shows, or why it cannot be opened yet.
