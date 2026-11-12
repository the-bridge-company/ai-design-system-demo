---
"@bridge-ds/docs-site": patch
---

Being built lists only build work that comes from the design lead: an exploration the lead sent to developers, or a library change the lead approved (in Library review, in Figma, or a group of an adoption report the lead sent). Each card says where it comes from ("From Contact page summary", "Library change Dana approved", "Exploration Dana sent") instead of "Asked by Leo"; a request someone filed directly is not listed, and the page, the Studio home line and a developer's count follow. `scripts/build-origins-cleanup.mjs` (dry run by default) gives the sample team's items their origin and closes its leftovers.
