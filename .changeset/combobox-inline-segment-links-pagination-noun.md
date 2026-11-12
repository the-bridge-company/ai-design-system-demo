---
"@bridge-ds/react": minor
"@bridge-ds/docs-site": patch
---

`Combobox` takes `inline`: the list sits under the input in the page flow, always open, the first result highlighted (a command palette, or a picker that fills a Dialog), with no Show options or Clear button; plus a `suffix` after the query, and `prefix` and `suffix` on each option (a kind glyph or swatch, a short kind word). `SegmentedControl` gets a link mode: give the items an `href` and the control is a `nav` of links, the current one `aria-current="page"`. `Pagination` takes `noun` ("Piece 3 of 12", "Next piece"). In Bridge, the Cmd+K search is the DS Combobox in inline mode (components/ds/SearchPalette.tsx), the Library and Studio switch is the DS SegmentedControl in link mode (two links, the space you are in the current page), and the phone One by one review pager says "Piece 3 of 12".
