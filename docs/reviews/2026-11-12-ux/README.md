# Bridge UX review, 2026-11-12

Senior product design review of the sample team on prod (https://bridgedesignsystem.com), before market demos.
Method: Playwright (Chrome), deviceScaleFactor 2, desktop 1440x900 and phone 390x844, fresh browser context per
persona, `?as=` switching. Screenshots are in `screenshots/` (`desktop-*` full page, `phone-*`).

Out of scope (already being fixed elsewhere): duplicate Admin badge, See-it-as alignment, review header
eyebrow/icon, status card title and step list (shared Stepper), compare ways to checkboxes, progress card
tracking decided, product page link row gap, counts in tags, timeline rail, type-scale overhaul, accessibility pass.
Comments on those fix directions are at the end.

Note: a deploy landed during the run (the See-it-as control changed from "Dana" to "Dana Design lead" between
captures). Screens before and after are both in the folder.

## P0: credibility-breaking

**P0-1. The demo hits GitHub rate limits and silently degrades.** All personas, any page.
`desktop-17-dana-product-crm.jpg` (first capture), `desktop-50-malik-home.jpg` (first capture), both replaced by a
clean recapture; reproduce by opening ~25 Studio pages in a few minutes.
What: after ~25 page loads the sample team returned 429s. Product pages showed "Bridge is busy right now. It is back
at 02:10." over skeletons that never resolved. Sofia's home said "Nothing needs you" and every product said
"Nothing in progress". Malik's home switched to another team ("Bridge demo ds", "Reviewer" badge, products "Admin
demo" and "Library") and told the developer "What do you want to explore?". It also said "GitHub is busy for your
account", although the banner says "nothing is sent". Worse, some screens degrade with no message at all:
the first desktop capture of the exploration (`desktop-13-dana-exploration-detail.jpg`) shows "Nothing noted yet"
in the handover notes and one activity event, while the phone capture a minute later (`phone-13-...`) shows real
notes, a next step and 4 activity events.
Why: a prospect clicking around for 3 minutes sees a broken product with wrong data. That is the worst
outcome for a demo, and silent empty states are worse than errors (honesty, system status visibility).
Fix: serve the sample team from a static snapshot (bundled JSON or edge cache) and never call GitHub live for
`acme-design-demo`. A demo should have zero runtime dependencies. Never fall back to another team's data. When live
data is partial, say so ("Some of this could not load") and never show "Nothing needs you" or "Nothing noted yet".

**P0-2. The same decision shows different numbers on two screens.** Dana, exploration vs. Library review.
`desktop-13-dana-exploration-detail.jpg`, `desktop-15-dana-review-compare-ways.jpg`
What: on the exploration, the library Card padding is "Default 16 px". Sofia's is "Comfortable 20 px, +4 px" and
Leo's is "Compact 12 px, -4 px". In Library review, the same Card shows "Today 20 px in the library" and
"Sofia's way 20 px, same as today". The framing changes too: "New option" on one screen, "2 ways" on the other.
The radio defaults to "Sofia's way" while the primary button says "Keep today's Card".
Why: this is Bridge's core promise (exact, trustworthy diffs). A DS lead will catch it in seconds and stop
trusting every other number.
Fix: one source for the baseline value, used by both views. Use one vocabulary for the case: "2 ways to pad Card".
Make the button label follow the selection ("Use Sofia's 20 px", "Use Leo's 12 px", "Keep both as sizes").

**P0-3. The founder's name leaks into the sample team.** Dana, Settings.
`desktop-20-dana-settings.jpg` (Review rules)
What: "Checks the look: Florian", "Checks the code: Florian", "Adds it to the library: Florian", "As the only owner,
Florian checks the look and the code in one review", "Exception: Florian". Everywhere else, Dana is the lead
who reviews.
Why: it breaks the fiction of the demo and contradicts "Dana decides here". It also suggests real
account data is mixed into a sample.
Fix: seed review rules with sample personas (Dana checks the look, Malik checks the code, Dana adds to the library).
Add a guard so the sample team never renders a real account name.

**P0-4. Waiting times and counts contradict each other across pages.** Dana, all personas.
`desktop-11-dana-home.jpg`, `desktop-12-dana-explorations.jpg`, `desktop-13-...`, `desktop-30-sofia-home.jpg`,
`desktop-40-leo-home.jpg` (text)
What:
- Order fulfilment timeline: "Waiting 4 days" (home), "Sofia sent it for review, 2 days ago" (explorations), and
  "started 4 days ago" on its page. The wait is measured from the start, not from when it was sent.
- Explorations: nav badge 2, "See all 10" on home, "7 explorations" on the list.
- Library: nav "12 waiting", Library product card "11 in review".
- Leo: "3 of your explorations are still being explored", but one of the 3 is "Waiting for lead". "1 of your
  library changes is in review", but the queue lists Leo on 6 pieces.
- Malik: "Nothing needs you", while 3 build requests wait to be picked up.
Why: counts are the first thing a viewer compares. Each mismatch makes the product look like a mock-up.
Fix: one selector per count (waiting since = sent date). Each "See all N" opens a list whose filter shows the same N.
Write a test that loads every persona and checks the counts match.

**P0-5. The phone header cuts the brand name.** Every Studio page on phone.
`phone-10-dana-home-firstvisit.jpg`, `phone-14-dana-review-queue.jpg`
What: the wordmark reads "Bridg", clipped by the search button. The sample banner plus "Get started" take about
45% of the first screen before any content.
Why: a clipped logo is the first thing anyone sees on a phone, for example when the link is shared in a DM.
Fix: under 600px, show the mark only (or wordmark without "Studio"), put search behind an icon, and collapse the
sample banner to one line ("Sample team · Dana") with Get started in the menu.

## P1: noticeable

**P1-1. One item, five status names.** All personas. `desktop-12`, `desktop-17`, `desktop-19`, `desktop-30`.
"Contact page summary" is "With developers" (explorations list), "In review" (Sofia home, product page, Being
built) and "Waiting for Sofia's check" (Being built). Order fulfilment is "Waiting for lead", "sent it for review"
and "1 is in review". Fix: one status ladder, written down and used everywhere: Exploring, Waiting for Dana,
Being built, Shipped. Render it with one Tag component and a fixed colour per status.

**P1-2. Tag colour has no meaning.** `desktop-11`, `desktop-19`, `desktop-30`, `desktop-17`.
The ochre (warning) tint is used for "Waiting 4 days", "Waiting", "Oldest", "In review", "Waiting to be picked up",
"2 ways" and "Unused". "Exploring" is blue, sometimes with a dot ("2 new pieces found" has the same dot).
"Waiting for lead" is blue without a dot. "Shipped" is green.
Why: status should be readable at a glance (DESIGN-LANGUAGE section 2.4). Ochre on normal states reads as "something
is late". Fix: neutral for normal states. Ochre only when something is over its target (for example waiting
more than 3 days). Teal for done. Findings like "2 new pieces found" are text, not status tags.

**P1-3. Persona identity is inconsistent.** `desktop-11`, `desktop-12`, `desktop-14`, `desktop-19`, `desktop-52`.
In the home hero, Sofia and Leo have the same drawing (Leo has his own "ears" drawing in the explorations list).
Malik's drawing looks very close to Dana's. The review queue and list use grey letter circles ("S", "L", "D",
"Y You") and solid Deep Harbor product squares ("C", "P") instead of drawings. Roles disagree: Malik is "Developer"
(See it as), "Can edit" (sidebar), "Builds and changes the code" (Settings), and "Reviewer" in the degraded state.
Fix: one Avatar component with each person's drawing, everywhere, at every size. Show the job title
(Design lead, Designer, Developer, Product manager) in people UI and keep permissions inside Settings.
Product markers: a neutral outline chip with the product name, not solid blue letters. Deep Harbor is for action.

**P1-4. Home rows: three "waiting" signals and generic thumbnails.** Dana home, `desktop-11`.
Each row has a grey box with a branch icon, an avatar and an ochre "Waiting" tag, inside a hero that already says
"waiting on you" and "Oldest: 4 days". The explorations list right below shows real screen thumbnails for the same
items. The Claude row says "Waiting" with no duration.
Fix: reuse the exploration thumbnail in the home row and drop the icon box. Say "waiting" once (the hero line).
Rows only show age when it is over the target.

**P1-5. Two primary actions on the exploration, and an unclear checkbox.** Dana, `desktop-13`.
"Choose Card padding" (side card) and "Add Comfortable to Card" (inline) are both filled primary buttons.
The stepper says "1 of 2: Card padding, then Send to the developers", but "What this changes" lists 2 decisions
(Timeline and Card padding), and Timeline is pre-ticked, so it is decided silently. The helper text under
the ticked checkbox describes the unticked state ("Not ticked: it stays in Sofia's screen only").
"Your preview appears a few minutes after each change" is addressed to Dana, who is not the author.
Fix: one primary per view. The side card is the summary, its button scrolls and focuses the open decision.
The stepper counts every decision (Timeline, Card padding, Send). Write the checkbox as a choice: "Add Timeline
to the library" with "Or keep it in Sofia's screen only". Address the caption by role ("Sofia's preview updates a few
minutes after each change").

**P1-6. Reviews: you act before you see.** Dana, phone, `phone-14-dana-review-queue.jpg`.
On the phone, Add to the library, Keep and Comment come before the before/after. The two preview tiles have
different heights and their labels are on different baselines. The colour-fix preview shows two grey labels, so
#A0AAB5 vs #C6CFD9 barely differ, and no contrast ratio is shown. The landing page promises "contrast checked".
Fix: on every viewport, put the evidence first and the action bar last (sticky at the bottom on the phone).
For colour fixes, show the ratio change ("3.9:1 → 6.1:1, now passes AA") as the headline.

**P1-7. Compare ways: colour-only legend and clipped labels.** Dana, `desktop-15`.
The overlay labels "20 Today, Sofia" and "12 Leo" overlap their boxes. The legend uses red and green dashes for
Sofia and Leo. Red reads as "wrong" and the meaning depends on colour alone. (The move to checkboxes is planned:
keep one preview per option next to its checkbox, so the comparison does not depend on reading a legend.)

**P1-8. The Library review filter shows items that do not match it.** Malik, `desktop-52-malik-review.jpg`.
With "Asked by: You", the first row is the colour fix asked by Sofia. The components row has an empty Group cell,
and "Who gets it: Measuring" has no explanation. Fix: apply the filter, or make the default "Your pieces and the
ones that affect yours" and label it that way.

**P1-9. Not actionable for the reader: Build requests and Library healthy on every home.** Sofia, Leo, Ann,
`desktop-30`, `desktop-40`, `desktop-60`.
Designers and the PM see "Build requests: 1 in progress, 4 in review, 3 waiting to be picked up". They cannot
act on it (rule: show a fact only to who can act on it). Malik, who can act, gets "Nothing needs you" plus
the same sentence. Fix: Malik gets "3 build requests wait to be picked up" as his main action and hero
CTA. Designers see only build requests from their own explorations ("Your Timeline is being built by Malik").

**P1-10. The PM's optional opinion reads as a blocking queue.** Ann, `desktop-60-ann-home.jpg`.
Settings says the PM view "is optional". Ann's home shows "Sofia and Leo are waiting on you", "Oldest: 4 days" and
ochre "Waiting 4 days" tags. Fix: "Sofia and Leo would like your view on 3 screens", without ages.

**P1-11. "The library is healthy" while 100 of 119 tokens are unused and CRM adoption is 13%.** Dana, Quality,
`desktop-23-dana-quality.jpg`.
A DS lead will push back on this headline. Fix: base the verdict on the three numbers, for example "Accessible and
documented. Acme CRM uses 13% of the components: start there" with "See Acme CRM" as the action. The home line
"Library healthy" follows the same verdict.

**P1-12. Being built shows checkerboard thumbnails.** `desktop-19-dana-building.jpg`.
6 of 8 rows show a transparency checkerboard. On a demo screen that reads as missing images. One row
(Contact page summary) has a different meta pattern with an absolute date ("Done exploring on Nov 8") and is
an exploration, not a build request. Fix: use the component's Storybook preview or the Field Guide icon for the
component, the same way the review queue does. Put explorations in their own group or keep them out of this list.

**P1-13. Admin-only warnings on the public Library.** Library, Button, `desktop-74-library-button.jpg`.
"Not linked to Figma yet. Add your Figma file in Settings first" and "Figma is ahead: 1 change being built (Malik)"
are shown to every reader of the public docs. Fix: show them only to signed-in admins or the lead. Readers can
get a calm "A new version is being built" note at most.

**P1-14. Settings is one 9-section scroll.** Dana, `desktop-20-dana-settings.jpg`.
General, Members, Library access, Claude, Figma, Products, How changes reach your code, Review rules, Safety, AI
tools, Appearance and Danger zone are all open at once, and GitHub is mentioned four times. Some copy contradicts
itself: "Only you see this choice" vs "an admin also sets the team default". "Nobody checks the code" reads as a
risk statement. The sample team shows an error ("Bridge could not check the measure right now").
Fix: left sub-nav or tabs (Team, People, Review, Connections, Personal). The summary sentence in each section is
enough; details go behind "For developers". Rewrite "Nobody checks the code" as "Token values ship once the look is
approved and automatic checks pass".

**P1-15. The landing page has no way into the demo.** `desktop-01-landing.jpg`.
The only hero CTA is "Get started" (sign-up). The demo is behind "Just looking? Open the demo" on the sign-in page.
The landing mocks use another world ("Admin demo", "Ann Leroy, Product designer") than the sample team (Acme CRM
and Prints, Ann is a PM). Fix: add a secondary hero CTA "See a sample team" that opens Dana's home with the tour.
Reuse the Acme names and personas in the landing illustrations.

**P1-16. Rows with nothing on the right half.** `desktop-12`, `desktop-19`, `desktop-17`.
Exploration and build rows stretch 1530px wide with all content in the first 600px. On the explorations list,
the "Waiting on you" rows have no Review button, although home has one for the same items. Product page groups
hold 1 or 2 cards in a 4-column grid, so there are wide empty areas.
Fix: right-align the status and the action (Review) in the row (proximity), and cap list width (~960px) or add a
right-hand column. On product pages, use a board (Exploring, Waiting, Being built) or a single grid with status
tags.

## P2: polish

1. Tour popovers cover content (they hide "Library healthy" and "Recent explorations" on Dana's home; Sofia's tour
   covers the products heading). Anchor them to the side of the target. `desktop-10`, `desktop-60`.
2. The top-right Library/Studio switch shows an icon for the other space and a label for the current one. It
   reads as one button. Use a labelled segmented control ("Library | Studio"). All pages.
3. Sign-in drawing: the bridge has a gap in the middle on load. If it is the start of an animation, the start
   frame should already read as a bridge. If it is static, it reads as "broken". `desktop-02-signin.jpg`.
4. Library home says "386 tokens", All tokens says "119 semantic tokens", Studio Tokens says "119 tokens". Say what the
   bigger number counts or show only one. `desktop-70`, `desktop-71`, `desktop-22`.
5. Button docs: "When to use" has 10 bullets with code (`render={<a href="..." />}`, aria-pressed). Move code to the
   Code tab and keep Usage in designer words. Accessibility rows each have a border box, so the section looks
   heavy. `desktop-74`.
6. Quality says "304 color pairs". DESIGN-LANGUAGE.md says 296 checks. Align the doc or the count.
7. The Sofia home hero sentence has three inline links in a row ("2 of your explorations are still being explored
   and 1 is in review. 1 of your library changes is in review."). Use one sentence with one link. Put the rest as
   cards. `desktop-30`.
8. Malik's CTA "See what you build" sounds odd. Use "Pick up a build request" or "Open Being built". `desktop-50`.
9. Product page: "uses the library from 1.8.5. The latest is 1.8.6" is version jargon for designers. Use "1 library
   update not in Acme CRM yet · Send it to the developers". `desktop-17`.
10. Sidebar: Settings floats far below the nav with a large gap at 900px height. Pin it with the account block or
   keep it in the flow. All Studio pages.
11. The review rail scrolls inside a fixed-height card, so the last item is cut mid-word ("Tabs: when tabs are the
   wrong choi..."). Fade the bottom or let the page scroll. `desktop-14`, `desktop-15`.
12. Console: CSS `insertRule` errors on Library and review pages (`._attached_* > :focus-visible`). After a deploy,
   open tabs fail to hydrate (TeamChip, AccountMenu, BeingBuilt chunks 404). Add a chunk-load-error reload.
   This matters for a demo tab that stays open while a deploy ships.
13. No delight moment on decisions in what I walked. Deciding the Card padding or adding to the library should
   end with a Field Guide moment (the piece "hangs on the line" like on the landing), not a plain text update.

## Top 10 a demo viewer notices in the first 2 minutes

1. Clicking around for a minute leads to "Bridge is busy right now", empty homes and another team's data (P0-1).
2. "Waiting 4 days" on home vs "sent 2 days ago" one click later (P0-4).
3. Card padding is 16 px on one screen and 20 px on the next (P0-2).
4. "Florian" approves everything in Settings, while the story is that Dana is the lead (P0-3).
5. On a phone the logo reads "Bridg" and the banner fills half the screen (P0-5).
6. Sofia and Leo have the same face in the home hero, and grey letter circles appear elsewhere (P1-3).
7. Ochre "warning" tags on almost every row: everything looks late (P1-2).
8. Two blue primary buttons on the exploration page, with a stepper that counts 1 decision when there are 2 (P1-5).
9. Checkerboard thumbnails on Being built (P1-12).
10. "Library is healthy" next to 13% adoption and 100 unused tokens (P1-11).

## On the fixes already in progress

- Compare ways to checkboxes: right direction. Fix P0-2 (one baseline) first, or the checkboxes will compare wrong
  numbers. Keep "Both, as two sizes" as an explicit option, not as "tick both".
- Progress card tracking decided, not seen: right. Also count only the current filter. "1 of 12 seen" with the
  filter "Asked by You" (Malik) would be wrong.
- Shared Stepper: it must count every decision on the page (Timeline is missing today, P1-5). If it doesn't, the
  new component will keep the bug.
- Counts in tags: fine, but fix the count sources (P0-4) first. A nicer tag showing the wrong number does not help.
- Type-scale overhaul: also cover the review rail's "Foundations"/"Components" group titles. On Malik's list
  they are almost as big as the page H1 (`desktop-52`).
