---
"@bridge-ds/docs-site": patch
---

Token explorer and editor fixes after the move to DS components. The editor's color ramp is a DS RadioGroup of tiles: a 32px swatch per step with its step number under it, the picked step in the DS checked ring, the value the token had marked "was" (the same dot leads "was neutral.0" in the pick row), no grey track; arrow keys pick as before. The editor opens on the family of the current value and the family plate follows it; every part sits on the footer's side padding, More keeps a DS gap from the tabs and the title's mode uses the shared separator. In the table, every value preview is one 24px box centred in its row (it no longer took the exploration page's padded stage style), easing curves and duration bars are drawn, shadows show on a card of the column's own surface, and values start on one column at rest and on hover. The explorer frame hugs short lists up to the viewport height and scrolls inside past it.
