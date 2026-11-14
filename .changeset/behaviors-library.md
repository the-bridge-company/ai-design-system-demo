---
"@bridge-ds/react": patch
"@bridge-ds/core": minor
"@bridge-ds/mcp": minor
"@bridge-ds/docs-site": minor
---

Behaviors, phase 1: a component's docs.json can list how it reacts, in designer words (`behaviors`: `{ id, family, text, try?, keys?, announces?, example? }`), with ids shared across components (`close-on-escape`) and family names shared too (Opening, Filtering, Moving, Picking, Closing, Focus, Feedback). Select lists 9 and Combobox 8, checked against the components and Base UI. Core types and validates the list (`validateBehaviors`, also run by `validateDocs`), reads it from any repo (`readBehaviors`), groups it (`behaviorGroups`) and gives the agent view (`agentBehaviors`). The Library component page shows a Behaviors section in Usage: one stage with the real component (Bridge's own page runs it, a team's Library plays its Storybook story), above the list on narrow pages and beside it, sticky, on wide ones; one list per family, each row a DS toggle Button with its keys in the DS Kbd and the expected screen reader announcement; the row picked says on the stage what to do (`try`, a stage-only line). The "On this page" rail lists the section. `bridge_get_component` returns `behaviors` and the `version` of the package that ships their ids, and /llms.txt lists them.
