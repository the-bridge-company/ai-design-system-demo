---
'@bridge-ds/core': minor
'@bridge-ds/mcp': minor
'@bridge-ds/docs-site': patch
---

From a mockup: what the library is missing, in one line.

- Core: an exploration keeps the mockup's own name (`Exploration.mockupName`, only with a mockup; `withExplorationMockupName`, `mockupNameOf`). `mockupPiecesLine` says "From Contacts v3:" and "2 pieces the library doesn't have" from that name (else the Figma file's name, else "the mockup") and the recorded library check; nothing without a mockup, before the check, or with none missing.
- MCP: bridge_start_exploration takes an optional `mockup` link (the same check as Studio's field) and `mockupName`; bridge_save_exploration takes `mockupName` (alone it saves too, no commit). bridge_continue_exploration asks for the name and the recorded missing pieces while either is missing.
- Studio: the exploration page says "From Contacts v3: 2 pieces the library doesn't have" under "Started from". The count goes to the library section; where the page lists no pieces, it opens their names under the line.
