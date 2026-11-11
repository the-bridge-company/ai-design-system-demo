---
'@bridge-ds/docs-site': patch
---

Being built: a library request for a component the library has now shows that component's real Library preview in List, Grid and Board (the same stage as Library > Components cards, now one shared component), instead of the generic component icon. A request's own before and after pictures still come first; an unknown component, or one without a preview, keeps the icon. Story frames load a few at a time once near the screen, and a component previews with the first story the published Storybook lists, so a card never shows Storybook's "Couldn't find story" error.
