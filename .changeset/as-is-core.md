---
"@bridge-ds/core": patch
"@bridge-ds/docs-site": patch
---

Looks right no longer files a library request for a piece that uses the library as is: a change to one part of a library component at a value the library already has (a Card at 12 px is Compact) has nothing to build. The library's known options and the rule (`usesLibraryAsIs`, `asIsOption`) now live in core, so Looks right and Studio's pages read one source.
