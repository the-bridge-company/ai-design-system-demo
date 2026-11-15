---
"@bridge-ds/docs-site": patch
---

Billing: a customer made with Stripe's test keys is ignored once the keys are live (and the other way round), so checkout makes a new customer instead of failing. Stripe errors log their code.
