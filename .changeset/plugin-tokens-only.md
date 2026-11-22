---
'@bridge-ds/figma-plugin': minor
---

The published DS Bridge plugin is a tokens-only MVP (owner decision 2026-11-19): Pull and Push of tokens, Sign in with Bridge, contrast checks. Pull no longer lists the components from the code missing in the file (matched by name, it could not see a team's library components, and nothing could be done with the list while drawing is hidden), Compare with code is hidden (it compares the sets Bridge drew), and so is the "Spec source" setting. In the MVP the pull reads no component at all, from the code or the Figma file, and "How updates work" says it reads the design system's tokens. The code is kept behind `PLUGIN_MVP_SCOPE` (`fullScope()` shows it again). The Community listing, its demo script and the plugin README say "Your tokens sync both ways between GitHub and Figma."
