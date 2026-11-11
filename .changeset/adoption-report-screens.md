---
'@bridge-ds/core': minor
'@bridge-ds/cli': minor
'@bridge-ds/docs-site': minor
---

The adoption report shows a real picture of where each group of pieces lives in the product. A product says which files make which screen in bridge.config.json (`products[].screens`: a route such as `/#/contacts` to file globs); without it Bridge reads the usual file routes (Next.js `app/` and `pages/`, React Router, Remix and TanStack `routes/`), never guessing a screen that needs a value in its address. `bridge snapshot` writes each audit's `screens` (route, name, files) into the report (core `productScreens`, `withScreens`, `screenForPlaces`). `scripts/preview-shots.mjs screens` opens each screen on the product's live address with the capture code of the exploration shots, keeps the pictures in the bridge-shots branch (`audits/<id>/<screen>.webp`, captured again for a new audited commit, a new address or after a day) and writes where they are into the reports before bridge-data is published. In Studio each group opens on the screen that holds most of it ("15 of the 102 are on the Contacts screen"), scaled to fit, with a click to see it bigger in a dialog; without one it says so in plain words.
