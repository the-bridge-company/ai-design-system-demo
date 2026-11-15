---
"@bridge-ds/core": minor
"@bridge-ds/docs-site": minor
---

Behavior requests in Being built: once the design system lead makes one the default, it is listed like any build
request ("The lead made it the default", today's sentence under its title) and reads Shipped when the change that
closes it merges. Its detail shows today's sentence struck, an arrow and the wanted one, where it gets in the way, who
asked and who made it the default (read from Bridge's comment, core `madeDefaultOf`). For a developer, "For developers"
adds the behavior id with its keys from the component's docs.json, the files to change (read from the repository: its
source, its docs.json, its tests), the Base UI primitive its source imports (core `basePrimitivesOf`) and "Copy the
request for Claude": core `behaviorBrief`, which `requestBrief` and `buildRequestBrief` now give for kind `behavior`
(change the code, update the docs.json entry and deprecate the old id when the meaning changes, a test that presses the
keys, a changeset, "Closes #n"). A designer following their request reads where it is in their words (Being built,
Done), without developer details.
