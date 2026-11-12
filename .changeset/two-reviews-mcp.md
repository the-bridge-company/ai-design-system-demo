---
"@bridge-ds/mcp": major
---

`bridge_promote_exploration` asks the two reviews and returns `reviews`, `status` (`in-review` or `ready-to-build`, replacing `waiting-for-lead` and `done-exploring`) and `waitingFor`. `bridge_continue_exploration` returns `designReviewWords` and the library answer per piece (`leadWords` stays as a deprecated alias for 2 releases); list tools carry `waitingFor`, `bridge_what_needs_me` names each item's `hat`, and `bridge_get_settings` / `bridge_get_config` name both roles.

Major because `bridge_promote_exploration`'s `status` values changed: a client comparing `status` to `waiting-for-lead` or `done-exploring` breaks. For 2 releases the result also carries `legacyStatus` with the old value (and `leads` with the design owners on `in-review`), so such a client switches to `legacyStatus` without other changes. No tool takes an exploration status as input.
