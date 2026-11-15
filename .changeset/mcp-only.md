---
"@bridge-ds/core": major
"@bridge-ds/mcp": minor
"@bridge-ds/cli": major
"@bridge-ds/docs-site": minor
---

Bridge is MCP only: it never runs Claude with an API key. Claude is always the person's own, through the Bridge MCP
server or connector.

- **CLI (breaking):** `bridge fix <component> --with-claude` no longer calls the Anthropic API with `ANTHROPIC_API_KEY`
  (and `--model` is gone). It prints the line to say to your own Claude with Bridge connected, "Fix <component> in
  Figma with Bridge" (`--json`: `{ status: "handoff", say }`), and exits 0. Your Claude does the rounds with the MCP
  tools (`bridge_get_gap_case`, `bridge_try_figma_fix`, `bridge_propose_figma_fixes`).
- **Docs drafts:** the "Docs drafts" GitHub workflow and `scripts/docs-draft.mjs` are removed. Library pages draft
  through the "My Claude" draft exchange only: the "Anthropic API key" field and the key kept in the browser are gone
  (a key saved by an earlier version is forgotten on the next visit), and the site no longer allows
  `api.anthropic.com` in its Content Security Policy.
- **Core (breaking):** removed `anthropicRequest`, `anthropicReplyText`, `DOCS_DRAFT_MODEL`, `ANTHROPIC_MESSAGES_URL`,
  `parseDocsReply`, `parseDocsTaskAnswer`, `mergeDocsDraft`, the fix loop runner (`startFixLoop`, `fixLoopRound`,
  `fixLoopOutcome`, `fixPrompt`, `parseFixReply`, `FIX_LOOP_MODEL`). The MCP library no longer re-exports them.
- **Figma plugin:** "Copy for your developer" after Ask Claude to fix it holds the line to say to Claude only, no CLI
  command with a key.
