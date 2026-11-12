---
"@bridge-ds/tokens": minor
"@bridge-ds/react": minor
"@bridge-ds/core": patch
"@bridge-ds/docs-site": patch
---

An app type scale. Page titles drop from 44 to 30px (`typography.h1`), section titles from 30 to 24px (`typography.h2`), card and dialog titles from 21 to 16px semibold (`typography.h3`), body keeps 16px on a 24px line. New: `typography.meta` (13/18, the secondary line under a name or title), with the primitives `font.size.150` (13px), `font.leading.18` and `font.leading.24`. Components set their text on the role line heights (20px for UI text, 18 for meta, 16 for captions) instead of 1.2, 1.35 and 1.5 ratios that landed off the 4px grid, descriptions and errors under fields read in meta (13px) instead of 12px with wide tracking, and a bold word inside a Banner title no longer jumps to black (900). In Bridge, the current nav entry keeps the medium weight of the others (color and plate say where you are), the "See it as" menu sets names in medium over a 13px muted line, and text that sets no line height inherits 1.5 of its size instead of 24px.
