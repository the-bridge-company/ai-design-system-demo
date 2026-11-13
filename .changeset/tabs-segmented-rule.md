---
"@bridge-ds/react": minor
"@bridge-ds/docs-site": patch
---

One logic for tab-like controls. Tabs (underline) switch the sections of a page or object; SegmentedControl switches a view or a filter of the same content. Tabs: the selected tab is ink text over the underline, never a box; the focus ring shows on keyboard focus only, inside the tab a step off its edge, and a click draws none. SegmentedControl: the selected segment (and the current link in link mode) is the raised plate with a neutral hairline edge, no longer a Deep Harbor outline that read as focus; the Deep Harbor fill needs `appearance="strong"`, now only on the Library and Studio space switch (link mode no longer fills by itself). Count tags look the same selected or not in both. Tabs `variant="contained"` is deprecated and wears the same plate as SegmentedControl. In Bridge, the space switch asks for `strong` and the face parts in Settings use underline Tabs.
