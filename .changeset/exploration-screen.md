---
"@bridge-ds/core": minor
"@bridge-ds/mcp": minor
"@bridge-ds/docs-site": minor
---

An exploration remembers the screen it changed, and every preview link and capture opens there.

- core: `Exploration.screen` in the exploration block (a place inside the product's preview: path, query and hash, never
  a host), `explorationScreenOf`, `explorationScreenFrom` (reads a pasted preview address), `previewAtScreen` (the
  query before the hash route, Bridge's toolbar parameters kept), `withExplorationScreen` and
  `setExplorationScreenOnGitHub`. Explorations listed carry their screen.
- mcp: `bridge_save_exploration` takes `screen`, and its description asks Claude to pass the route of the screen it
  changed. A save may change only the screen.
- docs-site: Show this screen under the preview for whoever keeps the exploration. Open the preview, Open the build,
  See it in the product and Approved version open on the screen. The private capture opens there too and captures
  again when it changes. The sample team's seed sets each item's `screen` as its member.
