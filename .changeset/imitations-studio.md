---
"@bridge-ds/react": minor
"@bridge-ds/docs-site": patch
---

Studio uses the design system's own components where it had hand-made copies. Library review: the designer's "who decides" note is a neutral Banner, decisions wait in a Toast with Undo, One by one on a phone moves with Pagination (compact), the Map's "5 of 12" is a Badge, and the eyebrow's dot is the shared separator. The exploration capture shows a Button look on hover and a Tag on touch. The adoption report shows values and token names with TokenValue. The token review table marks added and removed tokens with Badges, the visual impact filters are SegmentedControls and its Before and After labels Badges. The token history's demo switch is a Switch. The changelog's announcement shows the agent Avatar. Typed " · " separators go through lib/sep. Dead hand-made CSS (unused counts, avatars, chips, banners, the old GitHub dialog box) is gone.

`@bridge-ds/react/dom` gains two renderers for plain-script pages: `switchHtml` (with `bindSwitches`, `setSwitchChecked`) and `segmentedControlHtml` (with `bindSegmentedControls`, `selectSegment`), the same classes and static contract as `<Switch>` and `<SegmentedControl>`, guarded by parity tests.
