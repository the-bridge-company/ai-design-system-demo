---
"@bridge-ds/docs-site": patch
"@bridge-ds/core": patch
---

Review all: every item of the queue reads the same (board Q1). A suggestion takes the branch review's layout (the title
in the display face, its status, who suggests it, What changes) instead of a card on a stack; explorations, guidance
drafts and the other rows show the same head. One bar for every item at the same place (comment, Ask for changes,
Approve, More actions) with one keyboard line: A approve, S ask for changes, J K next and previous. The list shows a
window of seven rows around the current one with a steady "and N more", and titles wrap to two lines. The motion
preview starts on the frame where the component shows, so it is never two empty boxes, and it no longer restarts when
the review repaints. Plain words for designers: what a token paints ("Emphasis border") instead of its path (kept in
Details), the motion sentence without the token name (under Details), "EmptyState usage guidance" instead of a mono
"EmptyState docs", and a docs suggestion's summary no longer names the tool that filed it.
