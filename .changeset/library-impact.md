---
"@bridge-ds/core": minor
"@bridge-ds/mcp": patch
"@bridge-ds/docs-site": minor
---

What an exploration changes in the library (boards LI1 to LI8). Every exploration page has the section "What this
changes in the library": one summary line, then one row per piece (new component or pattern, a new size or a change
to a component, a token change in plain words with its path under Details), before and after, and one status tag
(Needs the lead, Approved, Being built, Kept in this screen, Uses an existing piece, Changes asked, Two ways). Nothing
to change is celebrated with a Field Guide drawing and the pieces it uses.

- Looks right approves the screen and every library piece it needs; the lead answers one piece on its own from its ⋯
  menu (Approve only this one, Ask for changes on this one, Keep it in this screen only, Use an existing piece
  instead). The answers are kept in the exploration's Bridge block (`library.decisions`, backward compatible). A piece
  kept in the screen goes to the developers' task as a local piece.
- Two open explorations that change the same part of the same component differently are a conflict: Looks right waits
  until the lead keeps one way or both as two sizes; the choice is kept on both explorations and both designers are
  told (a comment, and a notification for designers who joined by email).
- A token that reaches every product says so; the lead's approval is enough.
- Library requests filed for an exploration carry `origin` ({ kind: "exploration", repo, number, product, name }) in
  their Bridge block, and the exploration records the requests it needs (`library.neededBy`). Being built shows
  "Waiting for the library: <piece>" until the library releases it.
- Review all shows one item per exploration with its library line under the title and the section inside.
- Bridge's library check also finds pieces a branch marks with `data-bridge-piece` (or `data-bridge-pattern`), token
  edits in a design copy's vendored library, and a new size on a component, and records the library components the
  branch uses. Claude is told to mark what it builds outside the library.
- The demo seed takes an `overlay` folder per item and `check: true` to run the library check as the member.
