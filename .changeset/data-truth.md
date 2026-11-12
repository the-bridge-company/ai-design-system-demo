---
'@bridge-ds/core': minor
'@bridge-ds/docs-site': patch
---

One source for every number and status word in Studio. Core adds the status ladder (`status-ladder.ts`: Exploring,
In review, Ready to build, Being built, Checking, Shipped; Not doing this and Archived off the ladder) with
`LATE_DAYS`, the one threshold behind every amber tag, and build request summaries speak its words. Studio maps every
surface to the ladder (who it waits on is the second line, never a status), keeps tags grey until a wait is late,
compares a component part against the library's own value everywhere (Card padding is 20 px, Leo's 12 px is the
library's Compact), counts "waiting" from when an exploration was sent for review, defines each count once (See all,
Library card, Leo's and Malik's Home, Asked by: You), counts every decision in the exploration stepper, and computes
the Quality verdict from the numbers it shows (adoption per product, unused tokens by kind against their totals).
