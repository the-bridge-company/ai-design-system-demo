---
"@bridge-ds/react": minor
---

AlertDialog: a typed confirmation for high impact actions. `confirmText` on AlertDialogContent (usually the name of what goes, "Marketing team") adds a DS Input under the description; the confirm button stays disabled until the typed text matches, outer spaces ignored and case-sensitive. Focus starts on the field, its label says what to type (default `Type "<confirmText>" to confirm`, or `confirmTextLabel`), its hint says the confirm button stays off until the text matches, and Enter in the field confirms only once it matches. The field starts empty each time the dialog opens. Without `confirmText` nothing changes: focus on Cancel, confirm on.
