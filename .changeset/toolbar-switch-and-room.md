---
"@bridge-ds/toolbar": patch
---

The toolbar opens expanded by default: the whole bar, with Live product | This change, what changed on this screen, Changes and Back to Studio. Collapsing it to the pill is remembered in this browser (localStorage) until the person opens it again; blocked storage opens it.

The toolbar no longer hides the end of the page or a product's own bottom bar. Open or collapsed, the page gets room at its end for the bar (its height, its offset from the bottom edge with the phone's safe area, and a gap), in whatever scrolls under it: the document or an app shell's scrolling column. The page's own padding is kept and given back when the toolbar goes away. A product bar pinned to the bottom (a sticky Save changes) is a floor: the toolbar stays at its dock and stands on it, instead of moving next to it or covering it.
