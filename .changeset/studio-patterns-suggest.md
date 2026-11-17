---
'@bridge-ds/docs-site': minor
'@bridge-ds/core': minor
---

Studio > Patterns lets the team suggest. A member who can write gets "Suggest a pattern" in the header (in the empty state when there is no pattern yet): a drawer asks what to share, then shows the matching form, a new action (name, what it is for, its rules, at least two places where people do it today) or a behavior one component has, asked of a component that does not do it yet. Every row opens a drawer with the pattern, its Library page and one way to suggest ("Ask another component to do this", "Suggest a change", "Suggest a change to this pattern"). The design system lead sees what waits on a row in that drawer, with the decision, and the proposals that are not patterns yet in one quiet line under the table; the page sentence counts them. Everything files the existing `request: behavior`; a proposal never shows as a pattern until its file is merged. On the sample team, Send opens the sample-team dialog and the text stays in the browser. The rows of a shared-components group point to the group's cell for screen readers.

Core: a behavior ask may carry `places` (screen, label, optional link) and `rules` for a proposed action pattern (`isNewPatternAsk`); `behaviorAskOf` reads them and drops a bad shape, older asks read as before, and the developer brief says to write the pattern file from real code.
