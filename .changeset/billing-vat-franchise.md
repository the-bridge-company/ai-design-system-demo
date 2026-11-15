---
"@bridge-ds/docs-site": patch
---

Billing: no VAT under the French VAT franchise (art. 293 B CGI). Checkout and the Organization script leave Stripe Tax off, still collect a VAT number, and every invoice carries "TVA non applicable, art. 293 B du CGI. VAT not applicable, art. 293 B of the French tax code." One constant, VAT_REGIME, switches to standard VAT later.
