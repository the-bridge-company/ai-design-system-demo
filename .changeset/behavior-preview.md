---
"@bridge-ds/core": minor
"@bridge-ds/docs-site": minor
---

Claude's preview of a behavior request. A workflow Bridge installs in the team's repository
(`templates/bridge-behavior-preview.yml`, core `behaviorPreviewWorkflowYaml`, Studio Settings, Claude, "Turn on Claude's
previews") runs Claude Code with the team's own `ANTHROPIC_API_KEY` secret when a `request: behavior` issue is opened,
edited or commented by its requester: on `agent/preview-<n>` it changes the component, its docs.json behaviors entry and
adds a key-press test, opens a draft "Preview for #n" (never closing the request), and keeps one comment Studio reads
(core `parsePreviewState`: preparing, ready, failed, no key). Without the secret it says so once.

On the request page, the lead who decides and the person who asked get "Play both": today's story and the preview's (the
team's per-branch Storybook, `previews.apps.storybook`) side by side, the same keys pressed in both (the stories answer
`embed=bridge-keys` from `.storybook/preview.tsx`, with Storybook's own userEvent), each side's result in one line, and
the behavior's "Expected announcement". The person who asked can change her words; the preview is made again and says
"Updated from your words". In Being built, a developer's "Check against the preview" plays every behavior with keys on
Claude's preview and on their pull request's preview, a row checking when both agree. `GitHubClient.updateIssue` takes a
title.
