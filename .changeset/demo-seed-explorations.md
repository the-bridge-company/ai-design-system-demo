---
"@bridge-ds/docs-site": patch
"@bridge-ds/mcp": minor
---

The sample team's explorations on its products can be made the real way: an admin-only `seed-demo-explorations` action (scripts/seed-demo-explorations.mjs, dry run by default, a plan of explorations read from local clones) starts each one as one of its members through the same path a member's own exploration takes in Studio (the Bridge GitHub App, a "Requested by <member> through Bridge." line, the member named in the exploration), saves its files, and asks a lead or has the lead say it looks right when the plan says so. An exploration already in its copy is left as it is. The MCP library also exports the exploration steps Studio runs (start, ask a lead, the lead's yes) and the GitHub client.
