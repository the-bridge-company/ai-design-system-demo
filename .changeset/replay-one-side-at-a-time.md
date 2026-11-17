---
'@bridge-ds/docs-site': patch
'@bridge-ds/react': patch
---

Play both gives the same answer for the same component: the sides play one after another instead of at once (a page has one focus, so the frame that focused second took it from the first, which then read "the focus left it"), and the Storybook keys handler waits 100 ms between keys so a key pressed while a popup is still opening is no longer lost.
