---
"@bridge-ds/core": patch
"@bridge-ds/docs-site": patch
---

Design review follow-ups on the library impact and Changes.

- Before Done exploring, every piece of "What this changes in the library" reads Exploring, for the lead too: "Needs
  you" only once the exploration waits on the lead, the same moment Changes > Waiting on me counts it. Core
  `impactStatus` takes `asked` (left out: asked) and has an `exploring` status. The exploration page asks
  `viewerDecidesExplorations()` instead of its own copy of the rule.
- Home > Products > Library counts the library's own changes as Changes lists them under Library, in a product card's
  words ("1 exploring · 4 being built · 9 in review"), never "Nothing in progress" next to 14 library changes.
- One status tag mapping in Studio (lib/status-tag): Exploring and Being built read in Harbor on every surface, as on
  Home and the validated boards. The DS colours are unchanged.
- Plain words: a change behind the library reads "The library moved on since · Bring the latest in" (no update count);
  Quality links the contrast checks on GitHub only for a viewer signed in with GitHub, anyone else reads what they mean.
