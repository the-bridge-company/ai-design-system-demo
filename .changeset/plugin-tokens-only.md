---
'@bridge-ds/figma-plugin': minor
---

The MVP plugin syncs tokens only (owner decision 2026-11-18). Pull no longer lists the components from the code missing in the file (matched by name, it could not see a team's library components, and nothing could be done with the list while drawing is hidden), and Compare with code is hidden (it compares the sets Bridge drew). The file is no longer read for component names in the MVP. Code kept behind `PLUGIN_MVP_SCOPE`. The Community listing, its cover and gallery 1, the plugin README and /docs/figma-plugin/ say "Your tokens sync both ways."
