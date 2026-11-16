---
"@bridge-ds/figma-plugin": minor
"@bridge-ds/docs-site": patch
---

The DS Bridge Figma plugin keeps one promise for the MVP: your tokens sync both ways, and Bridge tells you what is missing in your Figma and checks that it has caught up with the code. Pull says which components from the code the file is missing, counting the team's own components by name ("Forms/Select" is Select). Drawing components, component requests from Figma, "Ask Claude to fix it" and "Draft with Claude" are hidden behind one flag (`PLUGIN_MVP_SCOPE`). The plugin is named DS Bridge everywhere and only reaches api.github.com and bridgedesignsystem.com. The docs, security page and homepage say the same.
