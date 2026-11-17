---
'@bridge-ds/core': minor
'@bridge-ds/react': patch
---

A behavior's `keys` may hold the pointer gesture `click-outside` (`CLICK_OUTSIDE`), so Play both can compare mouse behaviors: `keyLabel` reads it "Click outside" in the Studio and Library keys, and the Storybook keys handler (`embed=bridge-keys`) clicks a spot outside the story and its popup instead of pressing a key.
