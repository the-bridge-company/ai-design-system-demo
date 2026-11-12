---
"@bridge-ds/docs-site": patch
---

Studio pages no longer paint one list and then another a second later. Explorations and Home wait for where each exploration stands (the developers' tasks, the reviews, the team's library reviews) before their first paint, so a card never starts in Ready to build and moves to Shipped. What the browser keeps (the team's settings, its design system, GitHub answers, the saved list) only stands in when the live read fails, with the quiet "could not be read" line, and a copy kept by an older version of Bridge is ignored and dropped. For the sample and public teams, Bridge answers a kept copy at once only when it is under a minute old; older, it waits for GitHub and falls back to the kept copy only when GitHub is busy, down or silent. An exploration asked before the two reviews now names both hats on the reviewer's Home row ("Sofia's screen: your design review and a library decision") and on its Explorations second line.
