---
"@bridge-ds/react": minor
"@bridge-ds/docs-site": patch
---

`MenuContent` takes an `anchor`: the menu opens from an element, a ref, a virtual box (`{ getBoundingClientRect }`) or a point (`{ x, y }`) instead of its MenuTrigger. New types `MenuAnchor`, `MenuAnchorPoint`, `MenuAnchorRect` and `MenuVirtualAnchor`. `DrawerContent` takes `keepMounted`: the closed sheet stays in the DOM, hidden, so a script can bind its body and footer at load. In Bridge, the row actions menu of Studio Tokens is anchored to the row's own button, which now stays in place while the menu is open (no more swap for a DS trigger); a second click on it closes the menu. The token review is the DS Drawer again (StaticDrawer, which gains a footer slot) instead of a large Dialog.
