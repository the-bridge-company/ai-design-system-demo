---
"@bridge-ds/react": patch
---

Field, Checkbox, Switch, CheckboxGroup and RadioGroup descriptions read in UI 14/20 in the muted color instead of meta 13/18: a description under a label introduces the control, it is not row metadata. Errors and item descriptions inside Select, Combobox and RadioGroup option lists stay meta.
