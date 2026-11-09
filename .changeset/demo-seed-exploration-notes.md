---
"@bridge-ds/core": minor
"@bridge-ds/mcp": minor
"@bridge-ds/docs-site": patch
---

The sample team's explorations can carry their "Where it stands" notes: a plan item of the admin-only `seed-demo-explorations` action may hold `notes` (context, decisions, edge cases, open questions, next step), saved as its member the way their Claude session saves them, right after its files or alone on an exploration already in its copy (nothing else of it changes, and notes that already say this write nothing). Core has the notes save Claude's `bridge_save_exploration` runs, `saveExplorationNotesOnGitHub` and `explorationNotesWithUpdate`, which the MCP library exports with `findExplorationOnGitHub`.
