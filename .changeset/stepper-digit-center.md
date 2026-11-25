---
'@bridge-ds/react': patch
---

Stepper: the number in a step's marker centres on its own height (`text-box: trim-both cap alphabetic`), not the font's ascent and descent, so it no longer sits a little high or low in some browsers. Browsers without `text-box` keep the line-height centring.
