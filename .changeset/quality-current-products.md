---
'@bridge-ds/docs-site': patch
---

Studio Quality for a team lists adoption only for the products in its bridge.config.json today. An audit of an app removed from the config (the sample team's Account app) no longer shows; each listed product without an audit says "Not measured yet", with how a developer measures it (a checkout of its repository and an `--audit` flag in the Bridge data workflow). A config that lists no products keeps every audit, as before.
