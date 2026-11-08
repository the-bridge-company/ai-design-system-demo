---
"@bridge-ds/docs-site": patch
---

Components shows "Used in" for a product kept in its own repository when the adoption audit names it only by its
label ("Account app" or "Account app, main"), as the Quality page already does. `bridge snapshot` up to 0.18.0 records
the product key only for a checkout beside the design system repository, so a team auditing its product inside the
repository (or a copy of it) had adoption on Quality and no "Used in" column on Components.
