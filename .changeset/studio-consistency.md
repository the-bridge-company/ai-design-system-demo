---
"@bridge-ds/core": patch
"@bridge-ds/mcp": patch
"@bridge-ds/docs-site": patch
---

Studio consistency: one count, one verb, one meaning per tag colour.

- Build requests: the Studio home line and the Being built page header are one sentence over the same rows (build
  requests, Claude's fixes, explorations handed to developers), in the Being built tabs' words: "1 in progress, 4 in
  review, 3 waiting to be picked up." Core `buildSummaryLine` (also the MCP summary) counts In review on its own and
  adds requests waiting for more than a week.
- One action, one name: "Bring the latest in" on the exploration's product line, the product page and library rows
  (was "Bring it in" and "Get the latest").
- Status tags take their colour from what their state means, never from their words (lib/status-tag): blue is in
  progress, amber waits on someone (Needs review, In review, Check the build, Waiting for lead), green is done, red is
  blocked or two ways, grey is over. No Studio tag reads plum any more. Approved, waiting to ship is green.
- Quality on a phone: a finding's tag and action sit under its title instead of squeezing it.
- Home > Products: a folder with no screen of its own (the Library) shows its Field Guide drawing in the mosaic's place.
