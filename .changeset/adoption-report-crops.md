---
'@bridge-ds/core': minor
'@bridge-ds/cli': patch
'@bridge-ds/docs-site': patch
---

Adoption report: each group shows the product's own pieces next to the library's, not a whole screen.

- Core: a report lists the close pictures it wants (`crops`: one per group of pieces, with the screen that holds most of it, `pieceCrops`, `cropSlug`, `MAX_CROPS`); `withScreens` writes them with the screens. New `AuditCrop` type and `crops` in the report schema.
- CLI: `bridge snapshot` writes each product report's `crops`.
- scripts/preview-shots.mjs `screens` crops a few real instances of each group from the live product (shadcn/ui `data-slot` first, ARIA roles, then plain HTML), opens dialogs, menus, side panels, popovers and tooltips with their own trigger or a button that sends nothing, closes them with Escape, and keeps the crops in bridge-shots (`audits/<id>/piece-<name>.webp`) with the same recapture rules as the screens.
- Studio: the "In <product>" side shows that crop in the same box and at the same size as the library's sample, with "See it on the Contacts screen" for the whole screen in a dialog, and says plainly when there is no crop.
