---
'@bridge-ds/docs-site': patch
---

/studio/connect-figma/ (the browser step of "Sign in with Bridge" in the DS Bridge plugin) is a standalone page, like a sign-in or consent screen: the Bridge mark above one centered card, its top the page's one Harbor zone with the Field Guide drawing, then the title, one sentence, the team choice and one full-width primary action, with "Signed in as … Use another account" as a quiet line. No Studio top bar, nav, search or space switch (new `standalone` option of the layout). Connected says "Go back to Figma: DS Bridge now uses the <team> design system." with one quiet Open Studio link, instead of "You can close this tab". An expired or already used code gets its own end state that says to start again from the plugin. The flow, codes, expiry and team checks are unchanged.
