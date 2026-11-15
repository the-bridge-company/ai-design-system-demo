---
"@bridge-ds/core": minor
"@bridge-ds/mcp": minor
"@bridge-ds/docs-site": minor
---

Claude's preview of a behavior request, made by the person's own Claude through the Bridge connector: Bridge never runs
Claude. Two MCP tools: `bridge_make_behavior_preview` gives their Claude the request, the component's files, its
docs.json behaviors entry and the brief (core `behaviorPreviewBrief`: change the code and the entry, add a key-press test,
push `agent/preview-<n>`, open a draft "Preview for #n" that never closes the request); `bridge_report_behavior_preview`
records it on the request through Bridge (the hosted connector's server, `POST /api/contribute { action:
'behavior-preview' }`, checks the person is on the team and the issue is an open behavior request, and Bridge's app keeps
one record comment). Studio reads only Bridge's records (core `parsePreviewState`, `isBridgeAppComment`).

On the request page, the lead who decides and the person who asked get "Play both": with no preview yet, "Ask your Claude
to make the preview" and the line to say ("Make the Bridge preview for request #n", with Copy); then today's story and the
preview's (the team's per-branch Storybook, `previews.apps.storybook`) side by side, the same keys pressed in both (the
stories answer `embed=bridge-keys` from `.storybook/preview.tsx`, with Storybook's own userEvent), each side's result in
one line, and the behavior's "Expected announcement". The person who asked can change her words; the preview made from
the old ones asks to be updated, and the next one says "Updated from your words". In Being built, a developer reads the
same hand-off, then "Check against the preview": every behavior with keys played on Claude's preview and on their pull
request's preview, a row checking when both agree. `GitHubClient.updateIssue` takes a title.
