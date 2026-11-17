---
'@bridge-ds/react': patch
'@bridge-ds/docs-site': patch
---

Behaviors for the overlay and disclosure components: Dialog, AlertDialog, Drawer, Menu, Popover, Tooltip, Tabs, Accordion, RadioGroup and ChoiceCard now list what they do in their docs.json (opening from the button, Escape, a click outside, focus moving in, staying inside and coming back, page scroll paused, arrow keys, Home and End, typing to jump), each checked by a test that presses the keys. Shared ids make nine new interactions (close on a click outside, focus on open, focus stays inside, jump with Home and End, move with the arrow keys, open a list from its button, open from a button, page scroll paused, type to jump) and widen the three there were. Each overlay behavior carries the real component as its stage example, since the docs preview is only its button; the docs registry hands Tooltip its one trigger element so its example draws.
