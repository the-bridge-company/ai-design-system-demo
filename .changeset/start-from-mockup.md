---
'@bridge-ds/core': minor
'@bridge-ds/mcp': minor
'@bridge-ds/docs-site': minor
---

Start an exploration from a mockup.

- Core: `parseMockupLink` recognises a Figma frame link (figma.com/design or /file with a frame's node-id) or a Claude Design page (claude.ai/artifact/<id>, claude.ai/code/artifact/<id>) from its shape alone, nothing fetched; a whole Figma page or any other link gets a sentence that says how to fix it (`MOCKUP_PROBLEM`). An exploration keeps the link (`Exploration.mockup`, read back with `explorationMockupOf`) and its pull request says "Mockup. Starts from ...". `mockupBrief` tells Claude to rebuild it in the product with the library's pieces only, measure against the mockup and correct, never invent a token name (bridge_get_token, bridge_search_tokens), then list what the mockup uses that the library does not have. `startBrief` picks the mockup or the live page brief.
- MCP: bridge_continue_exploration returns the `mockup` and puts its brief in `next` while nothing is built yet.
- Studio: "Start from a mockup", a quiet link under the sentence in Start an exploration (products only), reveals the optional field. A recognised link becomes a card with what the link says and Remove; the line the designer pastes says in plain words to rebuild the mockup with the library's pieces only and tell what the library lacks (the measure and token rules stay in the MCP brief), Ready for Claude AI says what it starts from, and the exploration page says "Started from" with the link.
