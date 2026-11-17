---
"@bridge-ds/react": patch
---

Play both gets an answer from the Storybook again: the keys handler no longer imports `storybook/test` dynamically (it failed in the built Storybook) and waits for the story to render before pressing keys.
