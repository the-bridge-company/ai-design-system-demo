---
"@bridge-ds/react": minor
---

`@bridge-ds/react/dom` renders AlertDialog for pages without React at runtime: `alertDialogHtml()` gives the exact
markup of `<AlertDialogContent>` (role alertdialog, Cancel and the confirm button), and it opens and closes with the
Dialog functions, so it stacks over an open static Dialog or Drawer. `alertDialogCancel()` is where focus starts, and
`dialogReturnValue()` reads `confirm` once the person confirmed. A parity test compares it with the React component.
