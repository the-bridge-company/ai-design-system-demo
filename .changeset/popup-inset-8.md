---
"@bridge-ds/react": minor
"@bridge-ds/docs-site": patch
---

Popup lists breathe: Menu, Select and Combobox popups now keep an 8px inset (space.2) between their edge and their items, up from 4px. Items stay concentric with the popup (popup radius minus the inset: 12px on Bridge, the control radius, and 8px on Ocean), and separators keep the inset's 8px gap above and below while still running to the popup edge. In the docs site, the account menu's head and the "See it as" footer note drop their own padding and line up with the menu items (the note on the names, after the faces), the note now sits under a DS MenuSeparator, and the sample banner's "See it as" uses the same secondary Button, at the same size, as "Get started" next to it, so the warm banner has one button language.
