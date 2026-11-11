---
'@bridge-ds/core': minor
'@bridge-ds/cli': minor
---

Adoption report data for Studio. `adoptionPieces` reads an audit report as whole pieces (a menu with its items is one menu) grouped by the library component to use instead, with the pieces the library is missing; `adoptionValues` groups hardcoded values by the token to use and how close it is. Reports record where the audited code is (`target.repo`, `target.ref`, `target.root`) so code links stay right. `bridge snapshot` keeps each audit's trend across runs (`carryHistory`: one point per commit) and honours the "Not a problem" decisions taken in Studio (`audit-ignores.json` on the bridge-data branch, read like an allowlist and published again). Requests can come from an adoption report (`RequestOrigin` kind `audit`).
