---
"@bridge-ds/react": patch
"@bridge-ds/core": minor
"@bridge-ds/mcp": minor
"@bridge-ds/docs-site": minor
---

Behaviors, phase 1: a component's docs.json can list how it reacts, in designer words (`behaviors`: `{ id, family, text, keys?, announces? }`), with ids shared across components (`close-on-escape`) and family names shared too (Opening, Filtering, Moving, Picking, Closing, Focus, Feedback). Select lists 9 and Combobox 8, checked against the components and Base UI. Core types and validates the list (`validateBehaviors`, also run by `validateDocs`), reads it from any repo (`readBehaviors`), groups it (`behaviorGroups`) and gives the agent view (`agentBehaviors`). The Library component page shows a Behaviors section in Usage: the list by family, keys in the DS Kbd, the expected screen reader announcement, and one stage with the real component where Try it puts focus so the reader performs the behavior (Bridge's own page runs the component, a team's Library plays its Storybook story). `bridge_get_component` returns `behaviors` and the `version` of the package that ships their ids, and /llms.txt lists them.
