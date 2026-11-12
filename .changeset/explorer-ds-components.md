---
"@bridge-ds/react": minor
"@bridge-ds/docs-site": patch
---

`@bridge-ds/react/dom` gains `tagHtml()`, the exact markup of a static `<Tag>` for pages that build rows in plain scripts, and `badgeHtml()` takes an `icon` (the glyphs the DOM renderers draw, such as `check` and `x`), like `<Badge icon>`. `iconButtonHtml()` draws the `ellipsis` glyph (MoreHorizontal) and takes a `tabindex` in `attributes` in place of the default one, like `tabIndex` on the React IconButton (a roving grid cell). Parity tests compare all of them with the React components.

Studio Tokens and the token editor now use the design system's own components instead of hand-made copies: the type filter is a SegmentedControl with counts (a removable Tag when the table is scoped to a component), the row actions are a Menu, the editor's ramp is a SegmentedControl of swatches with DS tooltips (a RadioGroup of steps for sizes and durations), More families is a Menu, More options is a Button, the review is the DS Dialog, the draft count is a Badge, contrast results are Badges, aliases are Tags and the row actions button is the DS IconButton. The Library tree is the SidebarNav. Keyboard paths, deep links and the draft flow are unchanged; the hand-made styles are gone.
