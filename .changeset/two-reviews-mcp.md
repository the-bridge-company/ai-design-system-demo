---
"@bridge-ds/mcp": minor
---

`bridge_promote_exploration` asks the two reviews and returns `reviews`, `status` (`in-review` or `ready-to-build`, replacing `waiting-for-lead` and `done-exploring`) and `waitingFor`. `bridge_continue_exploration` returns `designReviewWords` and the library answer per piece (`leadWords` stays as a deprecated alias for 2 releases); list tools carry `waitingFor`, `bridge_what_needs_me` names each item's `hat`, and `bridge_get_settings` / `bridge_get_config` name both roles.
