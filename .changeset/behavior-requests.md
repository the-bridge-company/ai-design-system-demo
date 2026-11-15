---
"@bridge-ds/core": minor
"@bridge-ds/docs-site": minor
---

Behavior requests: a person asks to change how a component behaves, or a rule of an action pattern, and the design
system lead decides. Core gains the request kind `behavior` (label "Behavior change", `request: behavior`) with its ask
(`BehaviorAsk`: the component or pattern, the behavior id or the rule's place, today's sentence, the wanted one, where
it gets in the way), `behaviorRequestOf`, `behaviorAskOf`, `draftBehaviorText`, `makeBehaviorDefaultOnGitHub` (adds
`bridge-build`, so it becomes a build request) and `askRequesterOnGitHub`. An undecided behavior request stays out of
the build requests (`isUndecidedBehaviorRequest`).

In Studio, a team's Components drawer gets a fourth choice, "Change how it behaves": pick one of the component's own
behaviors (or something it does not do yet), say what it should do instead and, if you like, where it gets in the way.
A team's Library pattern page offers members "Suggest a change to this pattern" on an action pattern, with the same
form, and a component page's Behaviors section links members to the drawer. The request's page shows today's sentence
struck, an arrow and the wanted one, with who asked; the person who decides gets Make it the default, Not now (the
decline with its reason) and Ask with the requester's first name. Undecided behavior requests wait on the home of the
people who decide.

A design lead or an admin signed in by email decides too: Bridge's server (`POST /api/contribute`
`{ action: 'behavior-decision' }`) checks their member record and that the issue is an open behavior request of the
team's repository, then makes it the default, says not now with the reason, or asks the requester, naming them in the
comments. The send button and the sent line name the team's one design lead ("Send to Dana") when there is one.
"Something looks wrong" is now about not matching Figma only.
