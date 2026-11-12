---
"@bridge-ds/react": patch
---

`bindTooltips` (DS tooltips on markup a script builds): when keyboard focus moves to the next trigger, the tooltip that is fading out is removed at once, so it never sits over the control that now has focus (WCAG 2.4.11).
