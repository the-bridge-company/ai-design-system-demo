# @bridge-ds/docs-site

## 0.32.0

### Minor Changes

- f7c544f: Adoption report follow-ups. A lead or an admin signed in by email can now keep a group as "Not a problem": the decision goes through Bridge like "Send to developers" (the server lets a lead or an admin write `audit-ignores.json` on the bridge-data branch, nothing else there). Saving a decision is safe while the bridge-data workflow runs: `saveAuditIgnore` reads the file again and adds the decision when it changed meanwhile, and the workflow (and `templates/bridge-data.yml`) carries the branch's latest `audit-ignores.json` forward and only replaces the tip it read. Requests sent from a report say so on their rows: "From the Acme CRM adoption report", linked to the report, on Being built and on Changes (the request brief asks developers to keep the origin line in their pull request). The snapshot records each audit's biggest gain (`SnapshotAudit.topGain`), and the Quality adoption row says it in one line: "Buttons would take it from 13% to 24%."
- f86c634: The adoption report shows a real picture of where each group of pieces lives in the product. A product says which files make which screen in bridge.config.json (`products[].screens`: a route such as `/#/contacts` to file globs); without it Bridge reads the usual file routes (Next.js `app/` and `pages/`, React Router, Remix and TanStack `routes/`), never guessing a screen that needs a value in its address. `bridge snapshot` writes each audit's `screens` (route, name, files) into the report (core `productScreens`, `withScreens`, `screenForPlaces`). `scripts/preview-shots.mjs screens` opens each screen on the product's live address with the capture code of the exploration shots, keeps the pictures in the bridge-shots branch (`audits/<id>/<screen>.webp`, captured again for a new audited commit, a new address or after a day) and writes where they are into the reports before bridge-data is published. In Studio each group opens on the screen that holds most of it ("15 of the 102 are on the Contacts screen"), scaled to fit, with a click to see it bigger in a dialog; without one it says so in plain words.
- 149a6d2: Sample team: "See it as" on the banner lets a visitor see Studio as any of Acme Design's five people (Dana, Sofia, Leo, Malik, Ann), with their own home, gates and words. Picked in the menu or with `?as=sofia` in the address, kept in this browser; Dana by default. Only on the sample team, never a sign-in: the visitor's read-only session stays, and every write is still refused.

### Patch Changes

- 83fd426: Being built: a library request for a component the library has now shows that component's real Library preview in List, Grid and Board (the same stage as Library > Components cards, now one shared component), instead of the generic component icon. A request's own before and after pictures still come first; an unknown component, or one without a preview, keeps the icon. Story frames load a few at a time once near the screen, and a component previews with the first story the published Storybook lists, so a card never shows Storybook's "Couldn't find story" error.
- a744790: Exploration page leftovers. A design lead exploring themselves reads "Then you pick what the library keeps" and "Ready for the developers?" when no other lead decides, the other lead by name when one does (never themselves, never "your design lead"), and Done exploring offers "Add to the library" instead of "Propose to your DS lead". Check the build pictures (the two versions under a line, the check page's recap) show the whole crop scaled to fit on a quiet surface instead of cutting it. A new component's screen capture in the library block is a small picture beside its line that opens the whole capture in a dialog. The option cards' hatch is Harbor (the zone color on the pale selected surface) instead of grey, and the card content's corner is concentric with the card.
- 2f2e900: Library review: each family (Foundations, Components, Docs) is its own block in the side list, and a group title its only piece already says is dropped.
- 530962b: See it as, follow-up: the exploration page and Library review name the team's lead as Studio knows it (on the sample team, Dana, the email lead), never a GitHub design owner. The home says each person once ("Sofia, Leo and Claude AI are waiting on you"). On the sample team, the visitor's read-only session is now given as the person picked (`?as=`), so their own work and the build check's rights are theirs; every write is still refused, and real teams and real members are never affected.
- 648916e: Library review: click Today (or a way once decided) to see it on the compare picture. Looking is not choosing.
- Updated dependencies [f7c544f]
- Updated dependencies [f86c634]
- Updated dependencies [add7201]
  - @bridge-ds/core@0.33.0
  - @bridge-ds/react@1.8.6

## 0.31.0

### Minor Changes

- ebee01f: The adoption report inside Bridge: Studio > Quality > a product opens `/studio/<team>/quality/report/?product=<key>` (the whole Adoption row is the link; "Download JSON" moves to the report's header). A plain-words verdict with one "Send to developers", two score cards in words (trend from the second run on), and tabs: Pieces (whole pieces grouped by the library component to use, the one change that covers most of them, the library's own preview, the pieces the library is missing), Colors (swatch pairs with Same color, Very close, Close, check the meaning, or No library color yet) and Sizes and spacing. The developers' detail (fix at the source, the change to copy, file and line with Open in GitHub) waits behind one fold per group. Leads and admins send a group to developers (one request per group, linked back to the report) or keep it as "Not a problem" with a reason (audit-ignores.json on the bridge-data branch, honoured by the next audit); designers read. On the sample team the actions stay in this browser.
- 5540721: Check the build, region by region: a focused review mode (Explorations, `explorations/review/`) shows the developers'
  build beside the approved design at three sizes (laptop, small laptop, phone), each place where they differ outlined
  and numbered with one plain sentence and its measured facts. The designer, the product manager and a design lead say
  Fine as built or Fix this per difference, pin comments on the spot (posted on the developers' task with the picture)
  and send one answer: Needs changes posts the things to fix in one comment, the others stay approved in the next round.
  Bridge's capture workflow measures each build Studio opens (approved design and build on the same screen, through
  Bridge's private store). The exploration page shows the facts, a row of crops and Start the check.
- 09a4577: Studio and Library: the side nav collapses to a 64px column of icons. A toggle sits before the logo in the top bar
  ("Collapse sidebar", shortcut `[`), wide screens only; the phone keeps its menu. Collapsed, every item names itself in a
  tooltip on its right with its count, products show two letters, the team chip and the account show their face. The
  choice is kept in this browser and applied before first paint.
- e0a8a1f: Studio: on an exploration page, "What this changes in the library" shows a component several screens change
  differently as one card: today and each designer's way side by side as small cards, a ring on the way kept. The lead
  picks one way (or, with three ways or more, keeps several as sizes) and the button says the outcome; the designer reads
  the same block with their way marked "(yours)" and a Comment; once decided, two lines say what the library gets, who
  chose and who is told, with Undo for the lead. The choice is offered there only: the answer bar points to it and the
  Ready panel no longer asks it. Ten screens or more stay one line ("and 8 more").
- 1d58f2e: Studio: the exploration page, redesigned. One status tag in the header and one plain line under the title. The screen is the link to its preview (hover, focus and a touch chip), and in Check the build the approved version and the developers' build sit side by side, each opening its own, never two different screens. What this changes in the library sits under the screen; a new component shows as built, with the lead's choice in outcome words that Send to the developers applies. Activity is one timeline with the decisions, and a comment box naming who reads it. On the right, the "Your turn" zone only when the viewer acts now (one primary action, alternatives first), Before it ships with the people and their last word, a four-step bar naming the next step, and the handover notes. Developers get a Code popover (Terminal and Claude) once the work is theirs; the "For developers" section is gone and designers never see git.
- 353ed8b: Studio: Changes becomes Explorations (/studio/explorations/). Waiting on you is pinned first with "Your turn" and its
  reason; Status, Product and People checkbox filters replace the state tabs; a read-only Board joins List and Grid;
  statuses speak designer words only. Library changes, suggestions and docs drafts leave the page for Library review;
  the token draft line moves to Tokens. Old /studio/changes/ links keep working.
- b42e19a: Library review: a clearer hierarchy. The List reads as chapters (Foundations, Components, Docs) with their icon, a
  plain line and the products they reach named once, one card per family with each group's name in a sticky rail, a
  sentence-case column header and a State column for a conflict's ways or a result. Asked by is a face wearing the
  product's mark, then the exploration; "+N" tags replace every "+N more". A row's name opens the piece in One by one
  (?piece=) and a quiet link opens its page in the library. The tally at the end of the filters row says what waits,
  split by family. One by one: a conflict is a compare stage (Overlay at 150% or Side by side) and one radio list with a
  single primary that names the outcome; the side list uses the same families, a quiet check for seen pieces. The Map:
  "Show all" now shows every piece, one picked piece is its own row, and the picked box is kept in the address (?focus=).
- 7666280: Studio: Library review, the DS lead's one queue for library pieces (phase 1). A new page next to Changes lists every piece that would enter the library, whoever asked for it: library changes and the pieces explorations recorded, conflicts included. Two views, One by one (keys A add, K keep, the down arrow next) and List (a checkbox per row and per group, a bar that says what the selection touches before acting). Filters are checkbox lists: Status, Asked by, Product. The lead decides Add to the library, Keep in the designer's screen, or Use the existing piece when the check found a match; the decision is the exploration's own, shown on both pages. A designer reads it without buttons, on her own pieces first. The nav count moves from Changes to Library review and shows for whoever holds the review right only; Changes' Library group links to the new page.

  Core: `withoutPieceDecision` and `replyOnPieceOnGitHub`, so a designer can reply to the lead's "Use an existing piece instead" from the exploration page ("Reply to Dana"): the piece goes back to Library review with the reason.

- d119672: Studio: Library review phase 3. A read-only Map view (where each piece comes from, what changes in the library, who gets it; a click narrows the list, a conflict is two amber links; List on a phone). A "Who gets it" page per piece, opened from its reach link: the origin in one sentence, the screens Bridge knows per product (the asking explorations' preview captures) with Today, With this change and Side by side, and plain words when Bridge cannot list a product's screens. The old review queue (Home's Review all, /studio/review/) is now Library review: its ?pr= and ?item= links open the library change there, an exploration on Explorations, the other rows on Home, where they unfold in place. Library review reads ?suggestion=, ?origin= and ?group=. The List is grouped in blocks (Foundations, Components, Docs) under one sticky header, with checkboxes and Decide on row hover or focus; many explorations asking for one piece read on one line ("+11 more"). Decisions sit right under the piece on a phone.
- 804690e: Library review: Who gets it shows the real product screens a library change alters, measured by the capture robot on
  each product's live version (Today, With this change, Side by side of the same screen), with what changes on each
  ("2 buttons, links"). A product appears only when one of its screens changes; until a change is measured, Bridge says
  so. The List and One by one say the measured count ("11 screens", "Measuring", "No screen changes yet").

### Patch Changes

- fe03ca1: Library review: the Asked by filter lists people only (You, then each person), no longer explorations.
- 2a98ca8: Being built: the presentation of Explorations. The tabs give way to the Status, Product and People checkbox menus (default Not shipped yet, Shipped keeps the last 30 days), the count, then List, Grid or Board (one column per status, read only). One word per status everywhere (no more "Requested"), cards say who a change waits on ("Asked by Leo", "Malik builds it", "Shipped by Malik"), and a developers' version at Check the build reads "Waiting for Sofia's check".
- 413cdf3: Check the build: the exploration page shows a short list of where the build differs (one line each, the two versions under a line on hover or focus, the header primary following progress), the handover notes become a checklist whose ticks are saved, the check page walks the differences with a stepper and ends on a recap with one Send. A design lead can answer the check; the first answer between the designer and a lead stands, the other can still comment.
- 2304cf5: Check the build: once Bridge measured the build, the exploration page compares the two versions it measured on the
  same screen (the approved design and the build, laptop size) instead of an older capture of another screen, so it no
  longer says the sides show different screens above the count of differences. The crops under it are framed tighter
  around each difference, so each tile reads at its size.
- 2a32587: Studio exploration page: "What this changes in the library" no longer says "Your choice" or "Choose on the exploration's page" where the viewer cannot choose. Past the lead's answer, the lead reads "Needs you" and "Pick in Library review" (a link to this exploration's pieces there); anyone else reads "Dana picks in Library review". The read-only heading is now "Card, two ways" with one context line ("Leo's Deal pipeline cards (Acme CRM) makes it tighter; this screen makes it roomier.") and room above the plates. Check the build's design lead line says the piece waits on the lead in Library review instead of "Not needed: no library piece changed".
- fc4ee24: Exploration page: the journey and All steps name the design lead ("Dana picks what the library keeps", "Then you pick" for the lead herself), the handover notes are edited by their owner only (not by every lead), and their commits read "updated the handover notes" in Activity. Being built names a requester by their short name ("Asked by Ann").
- 4e6cfc8: Exploration page: the screen stage names the screen from its route ("Products") with one sentence of what the exploration does, never the last region it changed. Activity groups the same line in a row ("Leo saved 2 changes") and reads a commit that only repeats the exploration's name as "saved a change". A design lead on someone else's exploration while it is explored follows it: Done exploring and "Your exploration" are only the owner's.
- 3282fa1: Studio: Send to Figma is switched off on the exploration page for now (SEND_TO_FIGMA_IN_STUDIO); its code stays.
- 0c832ef: Exploration page, "What this changes in the library": each piece is one header line (kind tile, name, one tag, origin), a new component shows the piece as built with one "Add Timeline to the library" tick, and a change to a component part reads like the component's own options ("Padding: Comfortable", 20 px, +4 px) with the new values to tick, the ones already in the library under them, Rename, and a button that names the outcome. Decided pieces fold into one sentence with Change.
- 3023e3c: Library block: a new piece keeps Ask for changes and Use an existing piece behind its ⋯; Choose Card padding lands on the piece still waiting.
- 38f01ce: Library review List: a piece decided on its own (two ways, a removal) shows its checkbox off, with a tooltip saying why.
- c873a2d: Library review List: a piece's tag sits next to its name, and the name and its kind sit closer.
- 7bf9ce7: Studio: the account menu and other dropdown menus no longer make their button jump when they open.
- 72f815f: Collapsed side nav: products show CR and PR, not AC and AP. The word every listed product shares is dropped again.
- 214cfbb: Library review: the Who gets it cell in the List is always visible (Every screen, N screens or No screen yet).
- 8bc1708: Library review: keyboard hints use full-size keys; the side list no longer marks seen pieces with a check. Explorations: the People filter lists a person once even when rows name them by account and by name.
- 5ae3dde: Exploration page: the screen block no longer repeats the page title. When the screen's name only restates it, the block opens on its version line ("Sofia's version, changed 5 h ago, after you were asked").
- a0bf76c: Exploration page: All steps shows where it stands. Waiting for the lead, Exploring is done and the lead's step is current; the current step stands out.
- 955076e: Exploration page: when a library piece is still open, the lead's primary reads "Choose Card padding" and takes them to the choice, instead of a disabled Send to the developers.
- 8c04da5: Studio polish: the lead's zone asks the library question first (1 of 2); Library review says its count in words, drops the shortcut hints and the shared-decision line, and shows the list and the piece as two cards with each piece in its own card and a list that scrolls on its own; the home's Oldest tag and the folder tiles' Captured tag keep their size and edge.
- b6b5459: Exploration page: the More actions menu has icons, and Archive sits last, apart, in the danger tone.
- ae9119d: Studio: the lead's Your turn zone on an exploration says it once. One context line ("Sending also adds the Timeline to the library."), the change since the lead was asked on the screen's line, and what Send to the developers waits for right beside it ("Pick the Card way first", linked to the Card block).
- Updated dependencies [1fa649e]
- Updated dependencies [7666280]
  - @bridge-ds/core@0.32.0

## 0.30.0

### Minor Changes

- b2bf081: What an exploration changes in the library (boards LI1 to LI8). Every exploration page has the section "What this
  changes in the library": one summary line, then one row per piece (new component or pattern, a new size or a change
  to a component, a token change in plain words with its path under Details), before and after, and one status tag
  (Needs the lead, Approved, Being built, Kept in this screen, Uses an existing piece, Changes asked, Two ways). Nothing
  to change is celebrated with a Field Guide drawing and the pieces it uses.

  - Looks right approves the screen and every library piece it needs; the lead answers one piece on its own from its ⋯
    menu (Approve only this one, Ask for changes on this one, Keep it in this screen only, Use an existing piece
    instead). The answers are kept in the exploration's Bridge block (`library.decisions`, backward compatible). A piece
    kept in the screen goes to the developers' task as a local piece.
  - Two open explorations that change the same part of the same component differently are a conflict: Looks right waits
    until the lead keeps one way or both as two sizes; the choice is kept on both explorations and both designers are
    told (a comment, and a notification for designers who joined by email).
  - A token that reaches every product says so; the lead's approval is enough.
  - Library requests filed for an exploration carry `origin` ({ kind: "exploration", repo, number, product, name }) in
    their Bridge block, and the exploration records the requests it needs (`library.neededBy`). Being built shows
    "Waiting for the library: <piece>" until the library releases it.
  - Review all shows one item per exploration with its library line under the title and the section inside.
  - Bridge's library check also finds pieces a branch marks with `data-bridge-piece` (or `data-bridge-pattern`), token
    edits in a design copy's vendored library, and a new size on a component, and records the library components the
    branch uses. Claude is told to mark what it builds outside the library.
  - The demo seed takes an `overlay` folder per item and `check: true` to run the library check as the member.

- e8a55e0: Changes: the Library group stays for everyone and every library change says where it comes from (boards LI6, LI7).
  "Needed by Order fulfilment timeline · Acme Prints" links to the exploration; the rest reads "From the DS lead" with
  the reason Bridge can tell (accessibility fix, new brand, from the Figma UI kit, docs, rule for every product). The
  origin is read from an `origin` field in any Bridge block of the change (tolerant), else its "Needed by" block, else
  inferred. A filter narrows it (All, From explorations, From the DS lead, with counts, kept in the address), and the
  library rows wear the exploration section's tags (Needs Dana, Approved, Being built, Kept in this screen). The design
  lead groups the library by component or by exploration: a component two explorations ask for in different ways opens
  with Compare and pick, an exploration asking for what the lead already made opens with Approve, build once, the rest
  stays folded. Library changes no longer hide under their exploration's row.

### Patch Changes

- 6808d39: One rule for who leads a team's design (lib/design-lead): an admin or a member marked lead signed in by email reads
  the same Studio pages as an admin or design owner signed in with GitHub. The library's Explorations page now gives an
  email lead "Start an exploration" in the library instead of the designer's "ask the leads" view, and the same rule
  decides the library target of Start an exploration, the library update of a product, Settings > Products and the
  Figma file, the Figma link of components, Home (the lead's home and Needs you for the explorations waiting on a lead,
  an admin with GitHub included) and the empty Review all queue. On the sample team, every signed-out visitor reads as
  Dana, its lead, and now sees her pages; every write still opens the sample team's dialog.
- 8b596bd: Studio Quality for a team lists adoption only for the products in its bridge.config.json today. An audit of an app removed from the config (the sample team's Account app) no longer shows; each listed product without an audit says "Not measured yet", with how a developer measures it (a checkout of its repository and an `--audit` flag in the Bridge data workflow). A config that lists no products keeps every audit, as before.
- 3ef1aac: Studio Quality: Share sits at the end of the page header's title line, right-aligned, on a team's Quality page too (it was under the title). On a phone it keeps the title's line.
- 55ae983: Review all: every item of the queue reads the same (board Q1). A suggestion takes the branch review's layout (the title
  in the display face, its status, who suggests it, What changes) instead of a card on a stack; explorations, guidance
  drafts and the other rows show the same head. One bar for every item at the same place (comment, Ask for changes,
  Approve, More actions) with one keyboard line: A approve, S ask for changes, J K next and previous. The list shows a
  window of seven rows around the current one with a steady "and N more", and titles wrap to two lines. The motion
  preview starts on the frame where the component shows, so it is never two empty boxes, and it no longer restarts when
  the review repaints. Plain words for designers: what a token paints ("Emphasis border") instead of its path (kept in
  Details), the motion sentence without the token name (under Details), "EmptyState usage guidance" instead of a mono
  "EmptyState docs", and a docs suggestion's summary no longer names the tool that filed it.

  An exploration in the queue shows its captured screen (linked to that screen on its preview) and its next step from
  Where it stands; a guidance draft shows its first lines. The keyboard line lists only the keys that work on the item:
  Enter opens an item reviewed on its own page.

- 8845df2: Design review follow-ups on the library impact and Changes.

  - Before Done exploring, every piece of "What this changes in the library" reads Exploring, for the lead too: "Needs
    you" only once the exploration waits on the lead, the same moment Changes > Waiting on me counts it. Core
    `impactStatus` takes `asked` (left out: asked) and has an `exploring` status. The exploration page asks
    `viewerDecidesExplorations()` instead of its own copy of the rule.
  - Home > Products > Library counts the library's own changes as Changes lists them under Library, in a product card's
    words ("1 exploring · 4 being built · 9 in review"), never "Nothing in progress" next to 14 library changes.
  - One status tag mapping in Studio (lib/status-tag): Exploring and Being built read in Harbor on every surface, as on
    Home and the validated boards. The DS colours are unchanged.
  - Plain words: a change behind the library reads "The library moved on since · Bring the latest in" (no update count);
    Quality links the contrast checks on GitHub only for a viewer signed in with GitHub, anyone else reads what they mean.

- 9535e7c: Studio consistency: one count, one verb, one meaning per tag colour.

  - Build requests: the Studio home line and the Being built page header are one sentence over the same rows (build
    requests, Claude's fixes, explorations handed to developers), in the Being built tabs' words: "1 in progress, 4 in
    review, 3 waiting to be picked up." Core `buildSummaryLine` (also the MCP summary) counts In review on its own and
    adds requests waiting for more than a week.
  - One action, one name: "Bring the latest in" on the exploration's product line, the product page and library rows
    (was "Bring it in" and "Get the latest").
  - Status tags take their colour from what their state means, never from their words (lib/status-tag): blue is in
    progress, amber waits on someone (Needs review, In review, Check the build, Waiting for lead), green is done, red is
    blocked or two ways, grey is over. No Studio tag reads plum any more. Approved, waiting to ship is green.
  - Quality on a phone: a finding's tag and action sit under its title instead of squeezing it.
  - Home > Products: a folder with no screen of its own (the Library) shows its Field Guide drawing in the mosaic's place.

- Updated dependencies [b2bf081]
- Updated dependencies [55ae983]
- Updated dependencies [8845df2]
- Updated dependencies [9535e7c]
  - @bridge-ds/core@0.31.0

## 0.29.0

### Minor Changes

- 6ffaa56: An exploration remembers the screen it changed, and every preview link and capture opens there.

  - core: `Exploration.screen` in the exploration block (a place inside the product's preview: path, query and hash, never
    a host), `explorationScreenOf`, `explorationScreenFrom` (reads a pasted preview address), `previewAtScreen` (the
    query before the hash route, Bridge's toolbar parameters kept), `withExplorationScreen` and
    `setExplorationScreenOnGitHub`. Explorations listed carry their screen.
  - mcp: `bridge_save_exploration` takes `screen`, and its description asks Claude to pass the route of the screen it
    changed. A save may change only the screen.
  - docs-site: Show this screen under the preview for whoever keeps the exploration. Open the preview, Open the build,
    See it in the product and Approved version open on the screen. The private capture opens there too and captures
    again when it changes. The sample team's seed sets each item's `screen` as its member.

### Patch Changes

- 2295895: Being built no longer lists a request closed as a duplicate: another request carries the work.
- 680855d: The sample team shows Send to Figma to its visitor even without a Figma file, and its demo dialog says what each action does on a real team ("Send to Figma puts this screen in your team's Figma file...") before "Get started".
- 0ffd993: Bringing the sample team's explorations up to date no longer syncs a copy that already has everything its product has.
- 8a4033c: The sample team's developer, Malik, joins with GitHub only, as a real team's developer does: seeding the sample team removes his email member (and what Bridge kept for that address), so Settings > Members lists him once. Settings shows a GitHub account without a photo with its drawn face in Members and Review rules too.
- 29216eb: The sample team's requests and suggestions can be filed again the real way: an admin-only `refile-demo` action (scripts/refile-demo-items.mjs, dry run by default) files each open one an account opened again for a member, through the same server path an email member's own request takes (the Bridge GitHub App, a "Requested by <member> through Bridge." line), points a developer's pull request that closes it at the replacement, and closes the old one as not planned with a comment linking it. A member's GitHub write now runs through one function, `runAsMember`, for the browser proxy and this action alike.
- 29216eb: The sample team's people move to the reserved acme.example domain (acme.design is a real, registered domain): seeding moves their old records, what they own and drops the notification keys of the old addresses. Bridge never mails a reserved or test domain (.example, .test, .invalid, .localhost, example.com, .org, .net), whichever provider, and never mails anything about the sample team (notifications, summaries, sign-in links, invites, join requests). A new admin-only `update-demo-branches` action (scripts/refile-demo-items.mjs --update-branches, dry run by default) brings the sample team's explorations up to date from their product as their member, through the same "Bring it in" path an email member takes, so the activity names the member.
- c985137: The sample team's explorations can carry their "Where it stands" notes: a plan item of the admin-only `seed-demo-explorations` action may hold `notes` (context, decisions, edge cases, open questions, next step), saved as its member the way their Claude session saves them, right after its files or alone on an exploration already in its copy (nothing else of it changes, and notes that already say this write nothing). Core has the notes save Claude's `bridge_save_exploration` runs, `saveExplorationNotesOnGitHub` and `explorationNotesWithUpdate`, which the MCP library exports with `findExplorationOnGitHub`.
- 41eb789: The sample team's explorations on its products can be made the real way: an admin-only `seed-demo-explorations` action (scripts/seed-demo-explorations.mjs, dry run by default, a plan of explorations read from local clones) starts each one as one of its members through the same path a member's own exploration takes in Studio (the Bridge GitHub App, a "Requested by <member> through Bridge." line, the member named in the exploration), saves its files, and asks a lead or has the lead say it looks right when the plan says so. An exploration already in its copy is left as it is. The MCP library also exports the exploration steps Studio runs (start, ask a lead, the lead's yes) and the GitHub client.
- a458f5b: Studio Home no longer shows a wrong home for a second while it loads: it waits until it knows who is reading and has read what waits on them, their explorations and their products, holding their space meanwhile, so nothing says "Nothing in progress" or "no exploration" before it knows. The sample team (Acme Design) now reads the same for everyone: someone signed in with GitHub or with a Bridge account sees it exactly as a visitor does, as Dana with the sample data, from the first paint, never with their own name, changes or join requests. The review count remembered for the navigation stays with its own team.
- 7c837a7: A GitHub account without a photo of its own shows its drawn face, never GitHub's generated pattern.
- aa7ab0e: An exploration a design lead who joined by email said looks right names that lead ("Ann said done exploring", and in How it went), never Bridge's app account. The demo smoke test checks the sample team's two products, Acme Prints and Acme CRM.
- 602eddf: Settings > Members names GitHub people by their profile name, as every other Studio page does.
- 0113afb: Exploration page: the line under the preview about the screen it opens on is gone. Who keeps the exploration chooses
  that screen from the "..." menu (Choose the screen it opens on), in the same dialog, with Let Bridge pick once one is
  set. Open their version now opens on the screen like Open the build and Approved version, and so do the product
  previews in the explorations list, the preview a request carries after Done exploring, and the preview in the message
  for developers who work elsewhere.

  Waiting for lead: the lead answers in the bar at the bottom only, so the zone beside the preview no longer shows a
  second "I'll look" button when that bar is there. Send to Figma sits beside Open the preview when that place is free,
  instead of alone on a row under it.

- 64234e5: Sample team seed: an exploration already in its copy gets the plan's files that changed since, saved as its member in
  one commit (their Claude session's save). Files that already say this write nothing; a dry run says how many it updates.
- 605784f: Storage diet after the 2026-11-08 incident (Upstash free plan full, every `/api/contribute` call answered 503 "storage"). Screenshots of private explorations now keep their image in Bridge's private Vercel Blob store; Redis keeps only a small index (when, of which commit, the page). Readers and serving rules are unchanged: team readers and demo visitors, through the server, never a shared cache. A one-off migration moves the images already in Redis and deletes stored images no capture names (`node scripts/private-shots.mjs --migrate [--dry-run]`, run by the Private shots workflow with `migrate: dry-run|yes`). Team reads fetch every cached key with one `MGET` (a 100-blob batch went from 105 billed commands to 3), the GitHub quota meter writes at most every 2 minutes unless a tenth of the limit goes, file contents stay 24 hours in Redis instead of 7 days, and three keys that never expired now do. A storage failure now logs Upstash's own error and the command names (never the token).
- e8d1bd0: Components shows "Used in" for a product kept in its own repository when the adoption audit names it only by its
  label ("Account app" or "Account app, main"), as the Quality page already does. `bridge snapshot` up to 0.18.0 records
  the product key only for a checkout beside the design system repository, so a team auditing its product inside the
  repository (or a copy of it) had adoption on Quality and no "Used in" column on Components.
- Updated dependencies [c985137]
- Updated dependencies [6ffaa56]
  - @bridge-ds/core@0.30.0

## 0.28.0

### Minor Changes

- 566c350: Add a product, v3: one dialog, and the product is in the team at once. The dialog lists the products Bridge found on GitHub that the team does not have yet, one row each with Add, with "Not in the list? Find it on GitHub", "Give designers their own copy", Cancel and "Start a new product". When Bridge finds none it opens straight on the name and Create product, with "Its code is already on GitHub? Find it there". Add and Create product no longer wait for an approval nobody could give: Bridge checks on its server that the person is an admin or a lead of the team, validates the one new product, and writes it straight to the team's settings (`POST /api/ship` with `action: "add-product"`, the only code path that uses the Bridge app's bypass of the library's main ruleset, one file only). The dialog then closes and opens the product's page, already in the side nav, without waiting for a new build or a cache to turn. Anyone else reads why on the product's row. On a library where Bridge may not write directly (an older setup), it goes to review as before and the dialog says so plainly. Bridge's own designers' copies are never offered as products: the copies Bridge makes are now marked (a GitHub topic and their description), and copies listed in the team's settings or named after a product next to it are left out. The "Show its previews" step left the dialog; the product's page holds the way to its previews.
- 441e1d7: Add a product starts from one question, "Where does it start from?", with three equal cards: "Its code is on GitHub" (recommended), "Only its address" and "It's a new product". Details come only after a choice, and every next step has Back. Its code on GitHub keeps today's list with Add, and when Bridge sees nothing new it says so with Find it on GitHub as the one primary. Only its address is for a product whose code the design team cannot reach: its name and its address (a bare domain or an https link), then Bridge starts the design team's own code for it from the product starter with the library and keeps the address in the new optional `products[].address` (an https origin, checked by `productProblems`, the JSON schema and, strictly, by the server that adds products). Such a product never gets a designers' copy: its only code is already the design team's own, so the dialog does not offer one and the settings check and the server refuse `design` beside `address`. Start an exploration offers an optional "Start from a page" for such a product, limited to pages of its own site: the page is kept on the exploration (`startPage`) and the line handed to Claude says to open it in the browser, rebuild it with only the library's components and tokens, never the site's own styles or files, then explore the change. `bridge_continue_exploration` returns `startFrom` with the same brief. Done exploring on such a product sends the developers a task with the preview, the page as it is today and what changes, never code to take.
- c8192d0: A product added from its address keeps its developers' task in the design team's own code, where Being built follows it, but those developers usually work elsewhere. Once it is done exploring, team members get a quiet "Copy for your developers": on the exploration page right under the "Developers build it" step, which now says "Their developers work elsewhere: send them the message.", and on the same row in Being built. It copies one plain, self-contained message (what changes, the page today, the preview, the screenshot when Bridge kept one) with no tech words, then says "Message copied. Paste it where your developers work." Signed-out and sample visitors never see it, nor does a change that shipped, was declined or archived.
- 3993118: Leads approve Claude's fixes from the Figma plugin. In "Claude's fixes", a lead (a repository admin, a design approver who can write, or an email Admin through Studio) sees "Approve all N" and "Approve" on each ready row; one click approves and runs Check for updates, so the fixes come into the file. Everyone else reads "Waiting for approval". The Bridge site checks each fix again with its GitHub App (figma-fixes.json only, `bridge fixes check`, nothing changed underneath, no failing check) and lands them in one push: one merge for one fix, one merge commit holding their union for several, so GitHub marks each pull request merged. A fix Bridge refuses says why on its row.
- 117a39d: The designers' copy of a product is a one-time team setup, decided once in Add a product ("Give designers their own copy"). Nobody sees "Make my copy" any more. Right after Add or Create product with the copy ticked, the product's page makes the copy in the background with the sign-in of the admin or lead who added it: one quiet line, "Getting a copy ready for your designers…", then nothing. If it could not be made, that person reads a calm line with Try again; designers never see it. When only a tick on GitHub lets Bridge open the new copy, an admin gets the one more step under the way to start, before the previews step. For a product added before this, "Start an exploration" makes the copy first, in the same action, with one short wait line, then starts. "Get the latest" is unchanged. Settings, onboarding and the MCP server now say Bridge makes the copy, never to look for "Make my copy".
- 0d732f6: Being built gets the two filters of Changes: All products and Everyone (with You) on the line under the tabs, then the
  count, in the same ?product= and ?people= addresses. The tab counts follow them, a row is filtered by its product and by
  the people it shows, and a row with nobody on it stays under Everyone. Changes and Being built share the same filter
  code. On the sample team, a sample exploration's page names its sample person, not the repository's account, and a
  change without a before and after no longer talks about visual checks.
- 0535107: Design check on every pull request of a product's developers, from the GitHub webhook: "No design to check" when it names no explored design, else who is still waiting. The design must change moves the exploration back to its designer. Lists read the whole check, and the validating design lead hears it shipped.
- c29fa71: A change in review says where it comes from. The top of the review reads "From the exploration Profile page, Account
  app" with a link to it, for a library branch opened for an exploration and for a pull request that closes a request or
  a suggestion Done exploring filed; a suggestion's review says the same. Home and queue rows read "from Profile page ·
  Ann asks for your review". No origin known, no line. "Why it exists" now shows only when it asks the reviewer something
  the line does not say. One screen in "Where it shows" fills the width, with Before and After named. On the sample team,
  changes link to the exploration they serve and show their before and after on its screen, and the exploration page
  shows its capture and Open the preview opens the screen running.
- 6b22a44: Check the build: once the developers show their version of an exploration, its designer and the product manager of its product (the design lead when library pieces changed) compare it with what was approved and say Looks right or Needs changes (the build is off, or the design must change). Bridge keeps who approved which version and the Design check on it. The PM hears when a build is ready and when it shipped, and their Home lists what waits for their opinion.
- e0bd3e1: The Bridge Library in Claude Design, kept in sync. Each docs-site deploy serves the Library as a Claude Design System
  for its version (`/claude-design-system/manifest.json` and `/claude-design-system/<version>/project/...`, static files
  built by `scripts/claude-design-system/release.mjs` in `docs:build`). New MCP tools: `bridge_get_claude_design_system`
  gives the team's Claude the version, the manifest (path, size, sha256, url) and the steps (create the Design System
  artifact once, then republish only the changed files to the same artifact and re-run the install in the canvases), and
  `bridge_set_claude_design_system_url` remembers the team's artifact (admins and leads only, checked on the server).
  Settings > Your AI tools shows admins one quiet line, "Claude Design: Bridge Library 1.8.4 · Update available", with
  "Copy the request for Claude".
- 84d0c83: The component map: `bridge.components.json` at the design system repo root links each Library component to its Figma
  component (file, component or set key, node, property and value mapping) and its code import, reviewed like any change
  (docs/COMPONENT-MAP.md). Core adds the typed, versioned schema with a validator in plain words, the proposer (by name,
  then by variant properties; ties are reported, never guessed) and `figma.file` in `bridge.config.json` for the team's
  Figma file; the repo model reads the map. `bridge_list_components` and `bridge_get_component` add `figma` (the Figma
  component and link, or "not linked to Figma yet"); the new `bridge_propose_component_map` opens proposed links for
  review (a suggestion, or a draft pull request in direct mode), refused through the hosted connector to members who
  joined with their email. `bridge check` reports which components are linked; an invalid file fails it. Studio: Settings
  gets "Figma file" (leads and admins send it for review), and a component page shows "In Figma: <name>" with the link,
  or "Not linked to Figma yet" with the next step for leads and admins only.
- 71c3a7d: The sample team's static screens are gone: its explorations show their real capture or the plate, and open their real
  preview, like any team. A signed-out visitor of a demo team reads where Check the build stands (who is still waiting),
  as a member who views it does; only members answer.
- 1432db6: The sample team reads like any team. Acme Design moved to its own organization (acme-design-demo/bridge-demo-ds; the old
  address redirects), visitors read it through Bridge even though its repositories are private, and its explorations show
  their product's real preview and capture first, the static screens only while one has none (SAMPLE_STATIC_FALLBACK).
  One server gate refuses every write on a demo team by someone not on it, with the demo dialog's words; Studio opens the
  demo dialog on that refusal.
- 4a6d4ba: A design lead can sign in by email. An admin makes an email member a design lead in Settings, Members. They answer on explorations like any lead: Comment, Needs changes, Looks right, Not doing this, Take it back, and hand-over. The last review on the developers' code stays on GitHub. Through Bridge, only a lead can now write a lead's decision, their yes, Done exploring or the developers' task, on a team with design owners.
- 641406a: Put an exploration in Figma. Say so to Claude, or use Put in Figma on the exploration page (for people who can edit, when the team has a Figma file): the new `bridge_exploration_to_figma` tool gives Claude the team's file, the changed screens, the Library components with their Figma links, what has no link, the preview and the recipe, and Claude builds a new page with real instances through its own Figma connector. Bridge never writes to Figma. `bridge_save_exploration` keeps the page link (`notes.figmaPage`) so Studio links to it, and `bridge_propose_component_map` now asks for component keys.
- 2d03cb5: The decisions stay with the exploration. In a design copy Done exploring keeps the notes on the branch, the page keeps showing them after the hand-off, and Back to exploring brings back notes an earlier Done exploring removed, so the developers' task never loses its spec.
- 302df78: A design lead or an admin approves an exploration, and nobody else. Design lead is a role in the list, between Can edit and Admin, and an email member no longer sees Reviewer or the note about GitHub.
- af390e9: A design lead answers an exploration with the review bar at the bottom of its page: a comment, Comment (a question, no
  verdict), Needs changes, Looks right (its words go to the developers), Ask someone else to review, Not doing this and
  Copy link. After Looks right, Take it back asks for a reason; once a developer started, a word reaches them on their task.
  The designer reads the lead's words in the page's zone, answers and sends it back, and their Claude gets the words too.
  Everything said is kept by round and shows as Decisions, replacing the single last note. A lead can take an exploration
  over or hand it to someone, and says why when they archive someone else's. Not doing this ends it with its reason, and
  Reopen as a new exploration starts a new one from its work. Home: Needs you holds what is yours to answer now, and a
  quiet Waiting on others lists what you asked. Eleven new emails follow all of it, with one reminder to a lead after 3 days.
- da2f8ae: The design lead validates before the developers: where a team names a design lead, Done exploring now reads Waiting for
  lead and nothing reaches the developers until the lead says Looks right. Needs changes sends it back with their words.
  A lead saying it on someone else's exploration, or a team with nobody else to ask, goes straight to the developers.
- ea25a6e: Changes and Being built can be read as cards. At the end of the filters row, a switch between the rows and the Home's
  card: one card per change, its screen on top, its one status tag, who it belongs to. Changes offers it on every tab but
  Waiting on me, which is reviewed row by row and needs its checkboxes and Review all; switching to the cards lets go of
  what was picked for a shared preview. The suggestions listed under a team's changes follow the same choice, although
  they are painted on their own. The choice is remembered for each person, per page, in their browser.
- a3faca0: The Studio side nav has two groups. Products lists the team's products, the ones you explore in or opened lately first, five at most, then All products with the total when the team has more; the product you are on always shows. Design system holds Components, Tokens, Quality and Explorations (the library's own page, now titled "Library explorations"). Settings sits at the foot, and the phone menu shows the same groups. A team's /products/ address now opens All products: every product, yours first with a quiet "You explore here", the same status line as on Home, a "Find a product" filter and Show more for long lists, and Add a product for admins and leads. Local dev adds scenario S24, a team with fifteen products.
- a6a67c4: One GitHub App, for good: Bridge Direct signs everyone in on every page, and the `BRIDGE_ONE_APP` switch, the older second app (`bridge-ds`, `GITHUB_APP_SUGGEST_*`), its "Allow Bridge to save your changes" second OK and its install links are gone. Someone still holding an old `bridge-ds` sign-in sees "Bridge changed how it connects to GitHub. Sign in again once to keep working." once, in the browser; the token function now accepts Bridge Direct's client ID only. Coming back from GitHub no longer loses what you were doing: after Sign in again, or Add a product's Install on GitHub, the dialog reopens at the same step with what you typed, the primary button focused and one line such as "Back from GitHub. Create Atlas now?". Nothing is sent before you click. A save stopped by an expired sign-in now says to sign in again instead of "Ask an owner" or a generic refusal.
- 2e3a8b8: Screenshots for private products: Bridge's own workflow captures the explorations of the design copies Bridge watches,
  Bridge keeps them, and shows them only to the team's readers (members, and visitors of a demo team) on the cards and
  the exploration page. Public products keep their preview-shots workflow.
- 9f95e1a: "I'll look": a reviewer takes an exploration waiting for review (`takeLeadOnGitHub`, `withLeadTaken`, block fields `leadTakenAt`, `leadTakenBy`, `leadTakenByName`). The take goes with the ask: asked again, asked someone else, or answered, it is gone.
- f374378: The sign-in screen composes the whole viewport. The step sits on white paper, beside one Harbor zone where a bridge closes: a piece that does not fit passes by, the one that fits is laid in and kept, and every step of the entry flow (code, name, Welcome back, invites, teams by work domain, the team picker) keeps that page. "Open the demo" is now a secondary button under "Just looking?", on its own under a hairline, instead of a small link at the bottom; Send code stays the one primary action. The first step says what Bridge is, and that sentence leaves once the person has given their email. On a phone the step comes first and the zone closes the page, so Send code and the demo stay on the first screen. Sign-in logic is unchanged.
- c33cbfd: "Where it stands": handover notes for every exploration, so another designer or AI tool carries on. The note file keeps
  Context, Decisions, Edge cases (per component, covered or open), Open questions and Next step as readable text;
  `@bridge-ds/core` parses and merges them section by section without losing hand-written lines
  (`parseExplorationNotes`, `mergeExplorationNotes`, `notesSpec`). `bridge_save_exploration` takes `notes` in the same
  save, `bridge_continue_exploration` returns them and starts from the next step, and Done exploring hands the decisions
  and edge cases to developers as the design spec. Studio's exploration page shows them above the activity and lets
  whoever can edit change them in place.

### Patch Changes

- 5137d0d: Add a product: the GitHub step never opens GitHub's "Where do you want to install?" while the team's account is known. When Bridge finds no installation for the team, or GitHub did not answer, Find it on GitHub opens the app's install page for the team's account (its GitHub id, read from the library and kept in this browser), so the admin lands on that account's product list and Save. The team's installation is also found under an old name of its account or library (lib/team-path renames), and by the account's id. A failed read no longer sticks for the rest of the page: the empty step says Bridge could not get the products from GitHub, with Try again, and reopening the dialog reads again. An empty list says why (Bridge sees none yet, or every product it sees is already in the team). The owners' line now arrives with the step instead of a moment later. "It's a new product" says a missing name on the name field itself and puts the focus there.
- 94731a5: Add a product: someone who does not own the product's account on GitHub reads, before GitHub opens, that only its owners can give Bridge access and that GitHub sends them the request, with "Copy a message for the owners". Once GitHub closes with nothing new, the dialog says the request was sent and that Bridge adds the product as soon as they approve; this browser remembers it per team, so reopening the dialog says it again, and picks the product once it arrives.
- acd552f: Add a product opens on one question, "Which product does your team design for?", with two choice cards and their Field Guide drawings: "It's already built" (pick your product, or "Find it on GitHub" when Bridge sees none, with "Ask a developer" copying a ready message) and "It's a new product" (Bridge sets it up with your library). Back returns to the choice from every step. The GitHub window, the wait, the owners' request and the previews step keep working as before, in the new words.
- 0a716b8: Audit minors. A team's /products/ address now opens its Home, where the product folders are, instead of a missing page. On a phone, addresses wrap at their slashes and dots instead of mid-word, every Copy button of Settings fills its row, the Studio Tokens table keeps its border to the last token, and a row of tabs or type chips that scrolls fades its cut edge (DS Tabs does it for every tab list). Quality says how many components its adoption headline counts. Every "yesterday" and "N days ago" counts calendar days, so one moment reads the same on every screen, and each status keeps one tag color everywhere. An exploration keeps the name its designer typed on every screen, and its picture names the same screen on Home and its product page. Settings puts Add a product on the Products title line. A visitor who cannot open a private product sees one line asking to sign in.
- 2335f7a: Being built opened straight from its address on a team now reads the team's settings itself, so the explorations handed to a product's developers show without visiting another Studio page first. All products now counts with the same status as Home and the exploration cards: an exploration whose developers closed their task as done reads Shipped, not "waiting to be picked up". Its summary says the rows count the whole team's explorations ("1 product, with the whole team's explorations."), where Home's sentence counts only yours.
- 428adbb: Being built names a person known by name only ("Leo"), never "name:Leo".
- 3f6d803: Check the build names the designer who said Done exploring when the exploration names nobody else, and says "the developer" in lower case mid-sentence.
- 4dc5310: Check the build finds the task and the developers' version when their repository was renamed.
- 75ba102: Members: Can edit reads "Explores and changes the library", the same words as the role picker.
- cda1f6f: Cards read '3 h ago' in the footer, and the product chip stands off a white screen.
- ed6ae38: Exploration cards name their product in the screen's corner and say when the screen was captured under the status; the title holds one line (the whole title on hover), the status right under it.
- 82384af: Changes names the person who started an exploration, as its page does: the member its record names (Leo, Ann, Sofia), never the GitHub account that opened its pull request. Home cards, the product page, the reviews waiting on a product manager and Being built read the same rule (lib/home-model explorationPerson). A designer's "A developer is on it" pill wears the calm tone of Being built instead of the error red, which stays for the developer's "Blocked by tests". On a library branch, the checks line ("All 304 contrast checks pass · Details") sits in the decision bar, above the comment, so the sticky bar never covers it.
- 8ddfe2d: A linked exploration of a product asks for its build check as the page starts; Bridge keeps a build check's GitHub facts ten minutes and forgets them on a push or when the developers close their pull request.
- e857581: Check the build shows in a few seconds: the exploration page starts its read with the rest of the page, the task's
  reads run at once, and Bridge writes the Design check only when it changes. Private captures open the page the
  changed files name when no change marker shows one, and can be taken again by hand (force).
- e1edaf3: Check the build paints from its own read as soon as the page opens: its frame at once, then who checks it, the approved
  version and the developers' build (build-state returns their branch and who opened it), while the rest of the page
  reads. The server mints both tokens at once.
- fa74800: Check the build keeps the names Bridge knows when the rest of the page arrives, never "the developer" in their place.
- 7662f45: Claude's fixes say where each one really stands. In the Figma plugin the section opens with one sentence ("3 fixes in this file, 2 need drawing in Figma, 1 waiting.") and each row has one status: an approved fix brought in by Check for updates reads "Claude's fix is in this file", a closed one "Claude's fix was not kept", both folded under "N finished"; a component Claude cannot fix says why ("The indicator is missing in Figma: draw it in the component, then compare with code again."), one Bridge never measured says so instead of waiting, and "Claude went quiet" is only for an ask nothing came back from. The Bridge connector records a gap case it cannot read for want of a measure, and a read of parts missing in Figma followed by silence, as that reason; the gap case tells Claude to end such a component with a status fix.
- 9f9bd4b: Figma fixes the team closed leave Being built on the first read of the page too.
- 8dc86ec: Make my copy: when Bridge sees only the ticked products on the copy's account, GitHub does not tick the new copy, so Bridge could not open it. The product page and Start an exploration now go straight into one more step ("One more step: let Bridge open your copy. Tick <copy> on GitHub, then Save."), wait for it with the guided access window of Add a product, then carry on. Accounts where Bridge sees every product show nothing extra.
- 4b9af44: The demo's Home lists its product copies' explorations too, with the person each names and its own capture.
- 5e87583: Changes, a branch review and a suggestion run the real team path on the sample team: no demo seat, no invented "Waiting N days" pills or "Requested by" personas, no owners renamed to Dana, no fake Approve (Approve calls the server, whose write refusal answers), no static before and after (the real visual impact, or the set-up line), and no hard-coded "Needed by" on the branch page (the sample PRs carry real Needed by blocks). A suggestion asked by an email member shows their face, as a branch does.
- a9e842a: The sample team's exploration page, Being built, product page and product branch run the real team code path: no persona rewrite of commits or faces, no visitor hides (the Product manager zone, Decisions, the AI tool and Figma blocks show as on any team), no sample build requests (Being built reads the demo repositories, the Account app's task and its developers' pull request included), and the product branch runs its visual impact as on any team. An email member who said Done exploring is named from the exploration's record, whoever's account wrote the commit.
- d26f9a1: The sample team runs the code of any team on Home, the review queue, the product page, the Library and Settings: no separate demo home, persona Members or sample Settings. Its visitor (Dana, an email admin) gets the lead home and its tour, the real members, review rules, products, Danger zone and settings of the team, and every write is refused by the server in the demo dialog's words (403 `demo`), now on the invites and entry servers too. The team's name comes from its `bridge.config.json` like any team's.
- 700efda: The sample team names only its personas: the lead an exploration waits for is Dana, the developer of a product's code is Malik, and commit authors, Changes rows, product cards and the build check name the sample person, never the account behind the demo's repositories. Real teams keep their real names.
- a0e7eac: The sample team's people are real email members (Dana, Ann, Malik, Leo, Sofia, seeded with `node scripts/seed-demo-members.mjs`), and a signed-out visitor reads as Dana through a read-only member session: the same reads as any email member, every write refused by the demo gate. The Design check status on GitHub names the real people again, with no persona rewrite.
- 9b72a86: Design check is written with a token of its own, narrowed to Commit statuses write: the proxy's token never carried it.
- f0a5dfa: Claude starts product explorations for everyone who can edit. On the hosted connector, a member who joined with their
  email (Can edit or Admin) now starts an exploration in the design team's copy of a product, where Bridge writes for them
  on explore/ branches only, then saves prototype code there; a Reader still saves nothing. `productRepoAccess` returns
  the default branch with `read-only`. The component tools and the server instructions tell Claude to load the Library
  with `bridge_get_claude_design_system` in a claude.ai artifact instead of inventing token values. The team's Library in
  Claude Design is read under the team's old names too (a connection made before the rename), and saved under the
  current one.
- 643847a: An exploration link opens from its own read, without waiting for the whole Changes list.
- 5708ab7: One status for each exploration on every screen. Home cards, the Home greeting and product folders, the product page groups and summary, Changes, Being built and the exploration page now read the same status, so an exploration the developers shipped says Shipped everywhere, even while its design preview stays open. Its page also names who started it and when from what Bridge recorded, so the activity reads in the right order.
- 36f8ffc: Under an exploration's preview, Put in Figma joins the block of actions as wide as the frame, instead of floating beside it. Someone known by name only reads as their name, never with the internal prefix. "Why it exists" shows on a library review again as on the validated board, with or without a question.
- ba69d62: The "In Figma" line now reaches the people it is for. On Bridge's own Library, a signed-in admin (or anyone who writes
  to the repository) reads "Not linked to Figma yet" with the next step: the page reads the role from the maintainer
  check it already runs, instead of waiting on the Studio's GitHub session, which the Library never starts. Studio
  Components shows the same quiet line in the component drawer: the Figma link when the component is linked, else the
  next step for leads and admins only.
- 9c233e3: Can view is back in the invite role picker, first as on the board: "Sees everything in Studio and the library." A Can view invitee joins the team with their email (no GitHub account), is listed in Members as Can view, and gets the read-only Studio (the team chip and account say Can view, the home asks "What do you want to look at?", write actions are not shown). Every write path refuses them on the server: the contribute proxy (branches, commits, pull requests, issues, reviews), library updates, shipping, and the connector's edit actions (team-caller `need: 'edit'`). Admins move an email member to and from Can view; the invite email names the role and says no GitHub account is needed.
- 78b1af3: Invite collaborators, role picker (board I2): "They review as" now stacks its two cards, each one line with its drawing, name and what it reviews (Designer, How it looks and works; Developer, How it is built), in a slightly wider menu. As on the board, the cards show no radio dot (the radio stays for the keyboard and screen readers, with a focus ring on the card), the chosen card is white with the strong edge, and on a phone both cards put the help under the name. Role lines follow the board: Can edit "Also explores and changes the library.", Reviewer "Also approves changes before they ship." (the invite email uses the same words). Server role semantics are unchanged.
- 704396f: Fixes from the first real run of the lead's decisions. A lead whose question waits on the designer reads it as theirs and keeps their answers; a handed-off exploration never paints as running while it loads; a lead's word to the developers is no longer read as a question, on the page or by email; Not doing this shows its reason on an exploration with no change yet; Bridge bringing the notes back stays out of the activity; Take it back writes once and restores the notes and labels side by side.
- 3e8ec82: Design lead is a box under the roles in Settings, Members, where people look for it, not an item of the row's menu.
  The cards of Changes and Being built show the screen of an exploration, as on the Home. A member who goes to Can view stops being a design lead.
  A Figma fix the team closed without keeping it no longer shows on Being built.
- 0400b58: The designer stays named: on the lead's Home row a member who joined by email reads by their name, not as the Bridge app, and after Looks right the exploration page names the designer, not the lead.
- 4849ea8: An exploration waiting for the lead says so on its own page, with the lead's answer, even before its first change.
- 0fdd826: It's a new product: the account it lives in follows the accounts Bridge reads once they arrive, and the team's products' accounts, so the form never stops on "Pick where it lives" with nothing to pick.
- 0ffcf28: It's a new product: no Where field and no address line any more. A new product goes to the account where the team's products live, or the team's own account when it has no product yet.
- b252ddf: Bridge keeps working under the old names of a renamed repository. One map of old names (src/lib/team-path.ts
  canonicalRepo) is read wherever Bridge names a team or a repository: the read proxy and every API that takes a repo,
  task links in explorations (In review, Approved and the shipped review show again, and GitHub is called by the new
  name, without a redirect per read), webhook links, and Studio addresses (permanent redirects in vercel.json from
  /studio/peterbono/ai-design-system-demo/ and /studio/art-print-shop-co/). The demo list keeps current names only.
  A refusal of a toolbar read from another origin now carries its CORS headers, so the toolbar can read why.
- ebc7d10: Open the build in Check the build lands on the page Bridge captured the developers' build on.
- d771b77: Phones: the "..." More actions button stays at the end of the title's line instead of dropping onto a line of its own. On a product page the name wraps beside it and Start an exploration still moves under the summary; on an exploration page the title and the button share the first line and the status tag goes under the title. Desktop is unchanged.
- 877650b: Settings > Products: an empty product manager reads "No product manager".
- 82b2da1: Settings > Products: the product manager picker shows once the viewer is known to lead or administer the team.
- 8d5d6c9: The product manager's zone follows their answer at once, and the preview's main action never cuts its words on a narrow card.
- 05c09e1: A product page card names the person its exploration names, like the Home and the exploration page, not the account that opened it.
- 094dd3f: Product page, new and empty: "Nothing explored here yet." with the Start an exploration card (the library's empty state, the product preselected), and for admins only, while the product has no previews, "One step before the first preview". It names the host the team's other products already use (Cloudflare or Vercel, else the library's, else Vercel), opens that host's page in a new tab, offers the other host, and disappears once the previews exist. The previews step of Add a product moves here (words in `lib/new-product.ts`). Local scenario S22 shows it.
- 4b5e4a0: A team whose repository was renamed or moved to another owner now shows once, by its current name and with the higher role, in "Your teams" (the team menu), the "Use Bridge in Claude" and "Connect Figma" pickers, and the account's teams. Memberships, recent teams, names and roles this browser kept under the old name read as the current one, and a connection in Claude is always made for the current name; connections made before the rename keep working under it.
- 60da5ce: The PM gate holds on the server too, and the reminder after "I'll look" goes to whoever took it, then back to every reviewer once.
- 81ddc00: Studio right after sign-in: a team page waits for your sign-in before saying who you are, so an admin sees "Checking" and then "Admin", never "Guest", the read-only banner or a short members list. On the hosted site, /studio/ takes a member of the team it shows to the same page of their team, so the role and what waits on them match. Visitors who are not signed in no longer see the members list or "Make my copy", and their pages stop asking for things that need a sign-in.
- 8bf478b: The sample team keeps no code of its own beyond the write gate: the unused demo home helpers (lib/demo-home.ts, scripts/demo-home.ts), the tried Approve and its approvals store, the invented waiting line, the hard-coded "Needed by" origins, the sample explorations list, the persona layer that renamed real people (scripts/people.ts, lib/demo.ts samplePersonOf, personaOn, nameOn, sampleMembers, lib/invites.ts sampleTeam), the demo seat of "waiting on me" and the rule that hid the side nav's sign-in on the sample team are gone. The lead's home tour moves to lib/lead-tour.ts, the same for every team.
- 1322a8d: Send to Figma is a tertiary action on an exploration.
- a951bc3: An exploration's button reads Send to Figma, then Send to Figma again, instead of Put in Figma.
- d70ea98: A capture opens the page the strongest hint names (a changed page before a shared stylesheet).
- e077d9d: Faster Studio pages: lists of pull requests read through Bridge drop the repository objects and API links no page reads
  (bodies stay whole), so a list of 50 weighs a quarter of what it did and is kept on the server instead of asked of GitHub
  on every page. The browser keeps them and asks again with their ETag, so an unchanged list costs a 304.
- f5d186a: A build check read with nothing ready yet answers plainly instead of an error, and the demo smoke test times the first visit again (5 s).
- a7acf71: Add a product: "No code yet? Start a new product". Bridge starts the product's code on GitHub from the Bridge product starter with the admin's own sign-in (no "Give Bridge access" step), links it to the library, proposes it for review with the designers' copy on, then shows the way to its previews on Vercel or Cloudflare. Refusals in plain words (name taken, no permission in the account, with the ask-an-owner message). The starter's content is in `templates/product-starter`.
- 715bdf2: Studio tests run the same on every runner: each test waits for the work it started (a product being created, a read of GitHub, the linked GitHub role) before the next one begins, so nothing lands in another test. No change to the product.
- 9324fa4: "Open the preview" of a private product's exploration reads the change again. Studio now waits a moment for the member's read pass when the preview is opened before it arrived (it used to open without it, so the toolbar could not read the change), and asks again after a refusal instead of keeping it for the life of the page. A preview built with a toolbar older than 0.8.0, which would leave the pass in the address and show an empty page, opens without it and says to bring in the latest product. The toolbar tells the product's hash router when it takes the pass out of the address, so a router that read it first shows the real screen, never an empty page.
- 15a9245: Home tour: a step no longer sits on top of an open dialog (Search, Add a product, Start an exploration, Account). It waits while the dialog is open and comes back at the same step once it closes. On a phone the step stays in the page, under the dialog, as before.
- 417a5ce: `bridge_get_claude_design_system` no longer asks someone to create a second Library artifact. When Bridge has none on
  record for the team, an admin or lead gets `create` (with "if you already made one, update and save that one"), anyone
  else gets `ask` (ask an admin or lead to add it; load the Library from its base URL meanwhile). The local server, which
  keeps no team settings, answers `unknown` with `teamKnown: false` instead of `create`, and a failed read of the team
  setting is an error, never "none". `bridge_list_products` adds `access`, one plain sentence per person: a member Bridge
  writes for (Can edit or Admin) can start and save explorations in the design team's copy, shown `connected`, while the
  developers' code stays read only; a Reader is told to ask an admin for Can edit.
- a4719be: A team's product repositories are watched when a visitor reads its products too, so the demo's developers' pull
  requests get Design check.
- 00e24a4: Each time Bridge reads a team's products, their repositories are watched, so GitHub's webhook writes Design check on a
  developers' pull request even on a team where nobody joined by email yet.
- e4e50b7: Open the preview and See it in the product land on the page the capture found the change on. Check the build shows
  the developers' build as Bridge captured it. A signed-out visitor of the demo sees the preview only.
- 1eb7356: An exploration keeps one layout in every state: the preview, its action row in fixed places and the activity on the
  left, the state zone and Where it stands on the right. A shipped exploration opens with the Bridge toolbar. Captures
  find the changed page of a hash-routed product.
- Updated dependencies [441e1d7]
- Updated dependencies [0a716b8]
- Updated dependencies [9dfb5e9]
- Updated dependencies [84d0c83]
- Updated dependencies [deeb410]
- Updated dependencies [f0a5dfa]
- Updated dependencies [641406a]
- Updated dependencies [e1bc4b6]
- Updated dependencies [2d03cb5]
- Updated dependencies [704396f]
- Updated dependencies [af390e9]
- Updated dependencies [da2f8ae]
- Updated dependencies [014e784]
- Updated dependencies [0cf2d87]
- Updated dependencies [caf7cdf]
- Updated dependencies [686834c]
- Updated dependencies [2cda80a]
- Updated dependencies [9f95e1a]
- Updated dependencies [3ce0cd9]
- Updated dependencies [c33cbfd]
  - @bridge-ds/core@0.29.0
  - @bridge-ds/react@1.8.5
  - @bridge-ds/tokens@1.8.5

## 0.27.2

### Patch Changes

- 133451a: Add a product: when a product is not in the list, "Give Bridge access" opens GitHub in a small window on the page where the admin ticks which products Bridge sees. The dialog waits, finds the new product on its own and comes back with it picked and named. The list is never a dead end, and a new return page (/studio/auth/access/) lets GitHub hand back at once.
- de71095: Studio Components: "Used in" lists only the team's products from bridge.config.json, by their Bridge names, each from its latest audit. Runs before the move to the design system, audits of apps that are not a listed product and the Library itself never show; with no audit of a product the column is left out. The team drawer says where the component is used.
- Updated dependencies [de71095]
  - @bridge-ds/core@0.28.0

## 0.27.1

### Patch Changes

- a3886c2: Add a product: when every product Bridge can open is already listed, say so and what to do to add another one.
- 9970737: Read passes for private products: a member's Studio puts a signed, 8-hour read pass on the product preview links it opens, and Bridge's read proxy lets the toolbar there read the product repositories the pass names (read only, the visitor's allow-list, origins the config names). Cloudflare Pages preview templates (`https://{branch}.<project>.pages.dev`) now count as product origins.
- fa14849: Product actions in Studio. In Start an exploration, the Where list ends with "Add a product" after a separator, a plus in the link color, for the people who may add one (an admin signed in with GitHub, never the demo). It opens the same Add a product dialog as Settings > Products, then brings the person back to their exploration as they left it. The Library page has no rename any more: the library keeps its name (Settings > Products no longer offers Rename for it either). A product page no longer shows a pencil by its title: one "More actions" button at the end of the title's line holds Rename (the same rename in place) and Remove from Bridge. Removing asks for the product's name, typed exactly, says in plain words that Bridge deletes nothing on GitHub, and sends a review of the Bridge settings that drops only that product, the same path as a rename. Viewers who may not edit see no menu.

## 0.27.0

### Minor Changes

- d93f23c: Products get library updates through Bridge. A product page says which library version the product uses and the latest one ("Art print shop uses the library from 1.8.3. The latest is 1.8.4."). A lead or an admin sends the update to the developers: Bridge opens one "Update the Bridge library" pull request in the product's own repository (package.json and package-lock.json only, the lockfile patched only when the dependency tree is unchanged, never merged), and updates it in place when a newer version lands.
- e7e5e50: Designers who joined by email now hear about their own work: an email right away when a developer asks them a question, when the developers' version is ready for their look, or when a lead asks for changes on their library suggestion, and a daily summary at 9:00 in their time zone for what moved (declined, shipped, suggestion closed). Account settings has a new Email row to choose right away, daily or never, and every email has a one-click unsubscribe. Sent through Brevo (`BREVO_API_KEY`, `NOTIFY_FROM`); without the key nothing is sent.

### Patch Changes

- f97c4ca: Exploration activity: a commit GitHub returns without an account (made with an address the account has not verified) now shows that person's GitHub photo, matched by their GitHub private address or by the one account with the same git name on the branch, instead of a drawn name-only face. Email members' saves, bots and Claude keep their faces.
- 81afb2d: Team Settings get a Danger zone for admins: "Delete this team" for a team made in Bridge, "Disconnect this team from Bridge" for a repository's team. Confirmed by typing the team's name. The server (api/entry `delete-team`, admins only, idempotent, capped per day) removes members, invites, join requests, connections in Claude, the name, discovery, the library access setting, the notifications registry and the team record, and never writes to GitHub. The browser forgets the team and goes to the person's next team. The security page and docs/HOSTED.md say what goes and what ages out.
- ab1e81e: A design task in the developers' repository now speaks to the designer. A question the developers post on it shows on the exploration page ("Developers asked a question", their words, a reply box) and in Home's Needs you and the nav badge until the designer answers; a `needs-design` label asks too. A task they close without building it reads "Not planned" with their last word and Back to exploring, and stays in Being built and Changes instead of disappearing. After "looks right" the tag and rows read "Approved, waiting to ship", and once shipped the Reviewed step keeps who said it looks right.
- 78104ba: Designers write only to their own explorations in a product's design copy, also after the copy is made again: a pull request belongs to whoever owns its branch (never to an owner kept by its number, which a recreated copy reuses), and an exploration re-opened by a lead stays its designer's when its exploration block names them. A new pull request's block always names who opened it.
- 35cfd87: One Bridge account per Gmail mailbox: emails are keyed by their canonical spelling (lower case; for gmail.com and googlemail.com without dots or a "+tag"), so either spelling signs in to the same account. Accounts made under two spellings before are merged safely on the next sign-in or account read: the older identity and its GitHub link stay, memberships, invites, join requests, notifications and connections in Claude move, and two different GitHub accounts are never merged.
- 42e0fe1: Studio Home, when nothing needs you: the harbor scene is back behind "What do you want to explore?", with the Start card still the one action under it. The sentence says what waits and on whom ("1 of your explorations waits for a developer to pick it up."), each clause opens Changes on your own work at that stage, and it counts only your open explorations: no longer one a member asked for that Bridge opened with your account, nor one already shipped.
- a2531f1: Studio Home, nothing needs you: the zone is one window onto the harbor. The sentence and "What do you want to explore?" each hold one line on a desktop (the text keeps left of the harbor only in a window narrower than 720px), and "Start an exploration" is a primary button right under the headline, in place of the Start card. One Start per state: the quiet Home has it in the zone, a busy Home keeps the first card of the explorations row, now a quiet dashed slot in the link color.
- 8640d46: Studio product page, nothing explored yet: one Harbor zone with the Home's choice cards. A designer on the library reads what the page is for in its lead and gets two equal, whole-card links (ask for a component change, suggest a token change) with a Field Guide drawing and a chevron; a lead gets the Home's "Start an exploration" card. The zone and cards use the Home hero's own classes and values, no empty column.
- ec0d509: Studio: a Bridge account signed in by email whose linked GitHub account is admin or editor of a team's repository now shows its real role (the server reads it with the Bridge app, matched by GitHub id), lists that team under Your teams, and never gets the read-only visitor strip on Bridge's own team. Without the GitHub sign-in in this browser, one calm banner asks to reconnect GitHub to make changes. The demo banner's "Back to your workspace" never leads back to the page it is on.
- 3710dad: Studio names who asked a question on a design task ("Florian, design lead, asked a question") instead of assuming the developers, on the exploration page, the Home row and the email, and the reply words say where the answer goes in neutral words. The product page shows the library version line only to the leads and admins who can send the update, and "changed since your copy" only with its Get the latest action, now offered to email designers too (Bridge syncs the copy for them). An exploration's plate names a screen it changed, never a component or a translation file.
- bdaed90: A notification email the provider refused no longer uses up its hour: the next event tries again right away.
- 5173296: The GitHub webhook answer says what became of each notification (sent, kept or why it was skipped), never an address.
- fcfbec6: A notification that could not be sent says why in the webhook answer and the logs (the provider status and code, never an address).
- 9cf83b9: Studio page headers lose the "How it works" fold (Being built, Tokens): the title and its one summary sentence are enough. The fold, its `how` slot and prop, and its styles are gone.
- 562f76d: Team Settings gets a Products band for leads and admins (each product, where it is explored, Rename, Add a product); designers do not see it. Make my copy is the same choice card as Start an exploration in the empty product slot. An archived exploration no longer offers Open in Claude Code, Continue or Bring it in. The GitHub is busy moment keeps the zone padding, the page gutter on a phone.
- 1b7d133: A GitHub admin signed in with Bridge (suggest) shows Admin on their team again, never "Can view" or the read-only strip: the repository's own read (its permissions are the viewer's) goes to GitHub with their token instead of Bridge's shared read, access kept from older reads is read again, and the role shown is the stronger of the GitHub sign-in and the account's linked GitHub role.
- 38c3e75: The GitHub usage row also shows in a team's Studio Settings, not only on the site's own Settings page.
- afb5572: Visual QA of emails, Account > Email, Settings and the Claude consent page. Every Bridge email (notifications,
  sign-in code, invites, join requests, library sign-in) shares one shell: the Bridge name, a preheader, layout tables,
  a bulletproof 44px button (full width on a phone), the token palette and dark mail apps. Notification emails name
  the person by their GitHub profile name when they have no Bridge account, show titles as Studio does ("Add a toast
  alert"), and quote the start of a question or a lead's review note (never kept for the summary). The unsubscribe page
  gets the Bridge name, a title per state, dark mode and a way back to Bridge. Account > Email lays its two choices out
  in equal columns, one column on a phone, with Rename and Change kept on their line. The invite dialog keeps addresses
  on one line on a phone, puts Resend on the person's line as in Settings, and shows a row's notice by the list. The
  GitHub usage meter turns warning-toned when GitHub asked Bridge to slow down. The Claude consent page shows the drawn
  face, never initials, and no longer says "signed in with GitHub" before GitHub has asked. Welcome back has one
  action, "Continue", with the person named once in an information-only identity line (no border, no tile). In Start
  an exploration, an admin whose product Bridge cannot open is told to set it up ("Set up Bridge on <product>"), never
  to ask an admin.
- e7e82da: Visual QA of the hand-off screens. On an exploration page, a question that waits on you now comes first in "What happens next": who asked, then their words, then your answer. "Send to <name>" is the page's one primary action, and "Open the preview" becomes secondary. A tall hand-off zone no longer leaves an empty grey column beside the preview. On the product page, a failed "Send the update to the developers" shows in the danger color, and every action on the facts line is at least 24px tall. The Changes summary now counts "Approved, waiting to ship" as in review and names "Not planned", so it adds up to the rows listed.

  The review step, when the developers' version waits for your eyes, makes "Open their version" the primary action. On the exploration page of a product, the state now reads as a tag and a sentence. "Nothing is missing" is said once. A missing preview says why next to "Try it in the product", and the screen shows the Field Guide plate instead of an empty page. A busy GitHub on team-wide reads uses the same calm busy notice as every other page (a quiet line under Home's greeting). On the demo, Changes > Waiting on me says the same count and words as the Home ("16 changes and 1 documentation draft need your review."), and a usage guidance draft always carries its status tag.

- 4b4d52f: Visual QA of the team setup, Ask to join, Add a product, exploration pages and team switcher, checked on real screenshots (1440 and 390, light and dark). The setup on a team's address greets the lead by their first name, never their GitHub login, and no longer says "Almost there. Choose how changes reach your code." once that step is done. The Storybook field keeps its spacing on a team's home (its styles load with it). The team Home opens on the Harbor zone: the line with the commit it was read at moves under the home. On a phone, the product page's rename pencil stays on the title's line, and an exploration that is running or archived shows its preview at full width instead of a sliver squeezed into a second column. Add a product with nothing to pick shows one sentence and "Give Bridge access on GitHub" as its one action, not an empty form. The Ask to join banner stops asking once the request is sent. The team switcher keeps the role tag and the check on the team's line. In Start an exploration, while the picked product is blocked (no copy yet, Bridge cannot open it, or the designer cannot explore it yet), the warning's action (Make my copy, Set up Bridge on the product, Ask an admin) is the one primary and "Start with Claude AI" is disabled, pointing to the warning as its reason; picking another place clears it.

## 0.26.17

### Patch Changes

- 44e23f8: Team reads through Bridge scale to large teams: the team budget (`READ_MAX_TEAM`, now 500 per 10 minutes) counts GitHub calls instead of requests, so cached answers never make a reader wait (55 people: no "Bridge is busy", was all 55); requests are limited per member only, against abuse (3,000 per 10 minutes). Kept answers keep their ETag a day and are revalidated for free; every function shares one sealed read token per repository, so kept ETags stay valid whichever function asks; concurrent misses of one answer make one GitHub call, with at most 20 in flight per function; Home and the nav badge send the status batch once. Measured in docs/QUOTA-LOADTEST.md.

## 0.26.16

### Patch Changes

- 32c3264: GitHub busy for the viewer's account is now a calm wait, never "Product not found", "Make my copy", an empty list or a role stuck on "Checking". One classification (lib/github-busy) reads 403 or 429 answers with no reads left, or in GitHub's limit words, as busy with the reset time. Team pages keep the team as last read in this browser, product pages keep the explorations as last read with one line ("GitHub is busy for your account. Bridge is back at 13:52."), Being built and team load errors say the same, and each reads again once on its own just after the reset (or on Try again). The team chip shows the last known role, else "Signed in". Core no longer reads a worded limit 403 as a missing design copy or a missing installation.
- 4306da2: Settings shows a team's admins how much of GitHub's hourly limit Bridge used for their team, and says calmly when it gets close. The server records the GitHub limit of each Bridge app installation from every answer (throttled writes), logs one warning per installation and hour under 20% left, and counts GitHub's slow-down answers.
- b2602fd: Team reads through Bridge follow GitHub's webhooks: `/api/github-webhook` (signed with `GITHUB_WEBHOOK_SECRET`, each delivery done once) marks only the changed topic of a repository (code, pulls, issues, checks, deployments, releases) to be checked again, and while deliveries arrive cached answers stay fresh 10 minutes instead of 30 seconds, falling back to 30 seconds on their own when the webhook goes quiet. GitHub calls now grow with activity, not with viewers.
- Updated dependencies [32c3264]
  - @bridge-ds/core@0.27.3

## 0.26.15

### Patch Changes

- 94c6db7: Demo: the home line, Changes > Waiting on me and the Changes badge now count the same things in the lead's seat (one function, `leadWaitingCount`). An exploration promoted to review counts as in review on the home too, the badge shows on the demo, and its link reads "Changes, 17 waiting for a review", never the clause without its number.
- 60ae2e3: Studio no longer spends each viewer's own GitHub limit. Anyone on the team signed in with GitHub (leads, admins, designers) now reads the team's library, its products and people's profiles through Bridge with the app's token and the team's shared cache (30 s for lists and statuses, ETag checks that GitHub does not count, a day for answers by commit sha). Membership is checked on the server, the read allow-list holds (now with releases), and a read right after a write on GitHub asks Bridge for a fresh answer. Each reader may cost the app at most 300 GitHub calls per 10 minutes (`READ_MAX_UPSTREAM`), so one viewer cannot use up the team's limit. Writes keep their routes.
- cfe3f74: Private products read for everyone on the team. Studio reads a product's code repository and its design copy through Bridge with the app's token for anyone signed in with GitHub (leads and admins too), not only email members and designers, so a private copy shows its explorations instead of "Make my copy". Writes keep their routes.
- 6d29674: Branch status sentences now say what the viewer does next: the only design owner who wrote a change reads that they add it to the library with a reason, an owner who can approve reads "Then you approve it". The Invite collaborators dialog can now cancel a pending invite from its "More" menu, as the Settings table does.
- Updated dependencies [80d6bf4]
  - @bridge-ds/react@1.8.4

## 0.26.14

### Patch Changes

- 3def0c3: Continue as names the team and role for a lead signed in with GitHub.
- cd51b1c: The ticket tracker integration is hidden for the MVP behind one flag in lib/studio-flags: no screen, landing copy or search entry shows it, and the code stays.

## 0.26.13

### Patch Changes

- 5b7b15f: Journey fixes: the site reads "Open Studio" for a GitHub sign-in too; "Welcome back" names the person, their team and role; Bring it in reads "brought in the latest product" in the activity; the invite dialog says Done once invites went out; Add a product links admins to give Bridge access and reads the list again on return; Settings > Members waits for the session instead of painting a stand-in list.
- Updated dependencies [5b7b15f]
  - @bridge-ds/core@0.27.2

## 0.26.12

### Patch Changes

- 84223a5: Someone who joined by email goes to their own team's Studio: the Library <-> Studio switch, the Library's Studio links and /studio itself lead there, never to the read-only showcase. Someone already signed in who opens the site's Sign in or Get started sees Open Studio, and /signin shows Continue as them with Use another account (the last email typed on this browser is remembered for next time).

## 0.26.11

### Patch Changes

- 5a783a2: Cloudflare Pages previews: read the HTML table Cloudflare really posts in its check run (`<strong>Preview URL:</strong>` with an `<a href>` link, and `Branch Preview URL:` on preview branches), not only Markdown rows.
- Updated dependencies [5a783a2]
  - @bridge-ds/core@0.27.1

## 0.26.10

### Patch Changes

- aa2b67e: Previews on any host, not only Vercel. Core reads a branch's preview from GitHub deployments of any host, commit statuses (Vercel, Netlify) and Cloudflare Pages check runs (`parseCloudflareCheck`, `isCloudflareCheck`), matches links to an app by its template's host (`appForUrl`), and fills `{branch}` with each host's alias rule (`previewHostOf`, `cloudflareBranchAlias`). Studio reads check runs for non-Vercel products, Add a product detects Netlify and Cloudflare Pages, the developers' version link falls back to Cloudflare's check run, and the toolbar treats a page whose host matches the preview template as a preview when the build sets no deploy environment.
- 7768ba0: Work Bridge's app opened for someone (an email member, a designer writing through Bridge) shows that person, never "bridge-design-studio[bot]": the exploration headline's "started by", Done exploring's face, Changes and Being built rows. A person known by name only keeps their drawn face, never a GitHub photo of that name.
- Updated dependencies [aa2b67e]
  - @bridge-ds/core@0.27.0

## 0.26.9

### Patch Changes

- ba2e6cf: An exploration Bridge starts or hands off for a member who joined by email names them by a stable member reference and their name in its block, never their email; Home still finds it as theirs (older blocks with the email still match).
- Updated dependencies [ba2e6cf]
  - @bridge-ds/core@0.26.5

## 0.26.8

### Patch Changes

- 69b26e4: A member's email never goes into GitHub: the developers' task says "From Dino, through Bridge.", the "Requested by" line names them without their email, and their commits carry Bridge's stand-in address on private repositories too. The library check of an exploration runs on its own for members who joined by email (Bridge's server runs it with their Bridge session), so "Check in Claude" is only a fallback.
- 884ab6a: A designer's exploration opened by Bridge's app (email members, and designers who write through Bridge) shows on the Home again: in "Your explorations" with its task stage, in the greeting's count, and in the product card's count.
- a847b51: One face per email member everywhere: the account menu, the header, Members, the invite dialog, exploration cards and rows, the review page and an exploration's activity all draw the face of the member's name (`~name`), never their email, a row index, the Bridge app's avatar or a GitHub account that happens to share their name.

  Home product folders: each screen of the mosaic shows who explores it (that same face, top-left, ringed), the screens are tiles concentric with the card, "Captured 1 h ago" is a compact chip in the bottom-left corner, and narrow tiles no longer show a truncated caption ("I.. A.").

- Updated dependencies [69b26e4]
  - @bridge-ds/core@0.26.4

## 0.26.7

### Patch Changes

- e07e9ed: Who Claude acts as is never a guess. The connector's consent page says it first, with the avatar: "You're connecting Claude as Dino (Can edit, signed in with email)." (the GitHub account GitHub will confirm on the GitHub path), with Use another account beside it. New MCP tool bridge_whoami ("Who am I in Bridge"): the person's name, role in the team, how they signed in (GitHub login, or email member with the address masked), the team, and what a save means for them; the server instructions say to call it when asked which account Bridge uses, or before a first save when unsure.

## 0.26.6

### Patch Changes

- 9fe6037: "Mine" finds a designer's product explorations: Bridge keeps what its app made for a member under each product repository (the design copy, the developers' tasks), so Home ("Your explorations"), Changes and the connector's bridge_list_explorations mine:true now list them too, for email members and designers signed in with GitHub alike.

## 0.26.5

### Patch Changes

- c298323: Every designer writes in the products through Bridge: a designer signed in with GitHub (push on the team, not an admin or a lead) now starts, saves, hands off and archives explorations in the design team's copy through Bridge's app, like an email designer, under the same policy (only their own explorations, never the default branch or a merge). They need no access to the copy on GitHub; leads and admins keep GitHub. The connector routes their product calls the same way, and Settings tells admins once.

## 0.26.4

### Patch Changes

- c20847a: Claude handoff knows whether the viewer connected Bridge in Claude: until then, the start flow's last step and the exploration page show the connect steps first with one primary, Connect Bridge to Claude, and the line second; coming back from Claude reads the connection again and switches to Continue in Claude. The Claude app line for a design copy exploration names only the exploration (admin-app#4), no repository or branch.
- Updated dependencies [b126080]
  - @bridge-ds/core@0.26.3

## 0.26.3

### Patch Changes

- 7fe13e3: Email designers explore with Claude: the Bridge connector signs them in with their Bridge account (no GitHub) and acts through the email contributors' proxy; on their own exploration branches in the design team's copy they may save prototype code (never CI, hosting settings or node_modules); the exploration page and the start dialog show them the Claude app only.
- e1a5bc7: People who joined with their email explore products too: Bridge opens, moves and hands off their explorations in the design team's copy (and files the developers' task) on their behalf, under a narrow deny-by-default policy. The start dialog says upfront when a product is out of their reach, without sending a designer to the library.
- f144824: Library page for a designer of the team: two cards, Ask for a component change (Components) and Suggest a token change (Tokens), instead of a line with no action.

## 0.26.2

### Patch Changes

- a8b9799: Home: the whole Start an exploration card opens the start flow, and its title and line read as one block beside the drawing.

## 0.26.1

### Patch Changes

- 8e59c62: The developers' version opens their own preview (from their repository, or the deployment GitHub lists), no longer a missing page of the design team's copy. Its link sits under the steps so each step reads on one line. Home, Changes and the product page say what the developers' task says (Waiting to be picked up, Being built, In review, Shipped), and Being built shows the designer's answer. A running exploration of the copy that misses product changes offers "Bring it in". A library exploration links to the Library as it is today.

## 0.26.0

### Minor Changes

- 49dc082: Add a product from Bridge: in Settings > Products and the onboarding Products step, an admin picks the product's code among what Bridge can see on GitHub, names it, and keeps the designers' copy. Bridge reads its previews from Vercel when they exist and sends the new product for review. The Components drawer counts a request as soon as it is sent, and the read-only banner no longer says "repository".
- b73954d: Review step for explorations from the design team's copy: once the developers open their pull request on the task, the exploration reads In review, "Open their version" opens its preview, and the designer answers Looks right or Needs changes. Bridge posts the answer on the developers' pull request and shows it in the activity.

## 0.25.1

### Patch Changes

- 754a4d6: An archived exploration keeps its page: the preview and activity, an Archived tag, one line and Unarchive, with no GitHub links. Archive from the page's menu no longer leaves the detail blank until a reload.
- 59b1406: More fixes from the journey tests. Starting an exploration in a design team's copy hands Claude the copy and the branch, never the developers' repository, and "Open the exploration" opens it in its product. An exploration that cannot be read says so in designer words. Being built reads the pull request of an older Claude fix, so a merged one reads Shipped. A merged change shows no approval rows, and the only owner who made a change is pointed to the owner override. An exploration handed to developers reads "Waiting to be picked up" everywhere, the same words as the Being built tab.
- 8787292: Third round of fixes from the journey tests. Back to exploring on an exploration from a design team's copy closes the developers' task as not planned, with a word for them, and Done exploring said again reopens that same task instead of filing a second one. The activity reads Bridge's own Done exploring commit as "said done exploring" and shows "took it back to exploring", never a commit subject. Archiving an exploration of a product shows its archived state with Unarchive, not a blank page. Roles say that only leads change the library: Can edit explores products and asks for library changes. The component drawer puts "Open in the Library" and "Open on GitHub" apart, and an email member never sees the GitHub link. A change closed without merging shows no endless "Reading the before and after". Admins can rename a product on their team's own Studio too, not only on a team shell.
- a7600d2: Fixes from the A-to-Z journey tests. A design copy exploration handed to developers follows their task: waiting to be picked up until someone is assigned, then being built, shipped once the task is closed as done (a Get the latest in the copy no longer reads as developers building). The task links the copy's real preview. Activity rows read commit subjects as sentences ("made a change: ...", Get the latest reads "brought in the latest product"). Settings review rules never show doc links or decision numbers. The empty Library page tells a designer of the team that the leads change the library.
- Updated dependencies [59b1406]
- Updated dependencies [8787292]
- Updated dependencies [a7600d2]
- Updated dependencies [56a4023]
  - @bridge-ds/core@0.26.2

## 0.25.0

### Minor Changes

- 64c548a: Studio: "Ask to join the team" on a team's address sends a join request inside Bridge, for any work domain. Admins see it with the other join requests (Home, Settings > Members) and approve it there. When Bridge cannot send it, the ready message is copied instead and the page says so.

### Patch Changes

- 41c1479: Start an exploration: "The library" is a lead's choice (a reviewer or an admin), described as "Change a token, a component or its guidance in the design system." A designer of the team sees only the products, and no Where at all when there is one; the library's own page offers them no start.
- ae1c7b2: Toolbar: a change that lives in the design team's copy of a product stays readable on This change and on Live product. Studio's link names the copy (`bridge-repo`), the toolbar keeps it for the session and across the switch, and the host can pass it as the new `repo` prop. The "Nothing changed in view" note is gone.
- Updated dependencies [ae1c7b2]
  - @bridge-ds/core@0.26.1

## 0.24.0

### Minor Changes

- b131960: The design team's copy of a product: `products[].design` (`{ "repo", "preview"? }`) names a fork of the product's repository that the design team owns. Explorations of that product start in the copy, never in the developers' repository, and "Done exploring" sends the developers a task there instead of a branch: an issue labeled `from-design` with the preview, the files the prototype changes, the library pieces it needed, and how to fetch the prototype code from the copy. Studio's product page offers "Make my copy" while there is none (a fork in the copy's organization, every branch) and "Get the latest" when the product moved on (GitHub's Sync fork); an exploration in the copy opens in Claude Code on the web with the copy selected and the branch named. New core exports: `designCopyOf`, `productCodeRepoOf`, `productOfDesignCopy`, `designCopyStateOnGitHub`, `makeDesignCopyOnGitHub`, `waitForDesignCopy`, `getLatestDesignCopyOnGitHub`, `designTaskBody`, `designTaskTitle`, `designCopyTakeCommands`, `DESIGN_COPY_STARTING_POINT`, `FROM_DESIGN_LABEL`; `GitHubClient` gains `forRepo`, `createFork`, `mergeUpstream` and `ensureLabel`; the exploration block gains `task`. The toolbar takes a `repo` override (the deploy's own repository): on a deploy of the copy it reads the copy's explorations and previews. Art print shop moved to `art-print-shop-co/art-print-shop`, explored in `art-print-shop-co/art-print-shop-design`.
- 97ba656: One lifecycle, the same states and words on every Studio page: Exploring, Waiting for code, Being built, In review, Shipped (a library change reads In the next release until the library version is published), Archived. A shared review reading (`lib/review-state.ts`: who is asked, each reviewer's last say, changes requested wins) feeds the exploration page, Being built, Changes and the home. Being built gets an In review tab whose rows say who must review ("Waiting for Florian's review", "Changes requested by Lee"), and its release card counts only library changes ("Library update ready: 3 changes. Publish so your products can update.", with the products that receive it; Bridge tool updates alone show no card). Changes shows every lifecycle tab with its count, even at 0, and Waiting on me lists the explorations whose review is asked of you. The home adds a "Review <exploration>" Needs you row that opens the exploration. Reviews are read only for open explorations sent for review (a few, at once, cached for 5 minutes).
- 079d66e: Studio Quality tells one story first: a verdict next to a lighthouse drawing whose weather follows it (clear, haze, fog), with an action only when something needs you. Accessibility, adoption and documentation follow as three identical cards with a meter, then adoption shows the latest run per product with its trend, earlier runs collapsed. Share and the checks file are quiet secondary links; unused tokens are a calm note that opens Tokens filtered to them.
- 21d6d90: Studio page headers: one pattern on every Studio page (Changes, Being built, Components, Tokens, Quality, Settings, on the team pages and the self-hosted ones). The Fraunces title carries the page's primary action on its line, then one live summary sentence about the state of the page ("2 explorations running, 1 waiting for a developer.", "53 components in 8 families, each with usage guidance.", "119 tokens, light and dark.", what waits and what ships on Being built; Quality keeps its verdict in its lighthouse zone). The team name no longer repeats under every title, and generic explanations sit behind a quiet "How it works" fold. On the end side, each section has its own Field Guide scene that breathes slowly (branching paths, a little crane on scaffolding, stacked blocks, a swatch fan, a ship's wheel; Quality's lighthouse stays in its verdict zone), built on the Home's QuietScene and still under reduced motion; phones show the words only. Every header has the same height, so moving between sections never makes the content jump.
- 65150fe: Studio gets a product level, like projects in Figma: one page per product bridge.config.json lists (/studio/products/<key>/, and on a team /studio/<owner>/<repo>/products/<key>/), with the shared header and a live summary ("2 exploring, 1 waiting for code."), the product's facts on one quiet line (where it is live, its repository or "In the library repository", whether Bridge reaches it), its explorations grouped by where they stand (Running, In review, Waiting for code, Being built, Shipped, Archived folded) and "Start an exploration" preselected with the product. A calm Field Guide moment stands in when nothing is explored yet. The side nav lists the products under the main nav, the Home renames its section "Recent explorations" and adds a row of product folder cards (a mosaic of their latest screens and what is in progress), Changes' product headings open the product page, and the "7 of 8 connected" chip moves out of the greeting to the status line next to the library's health.

### Patch Changes

- db18bf4: Library Accessibility: "How we check" ends the status sentence it explains; Copy for Confluence stays alone as the page action.
- ff5d30f: Being built lists explorations handed to developers next to build requests: waiting for code reads Waiting to be picked up, developers pushing reads In progress, merged this week reads Shipped this week. Each row carries an Exploration tag, the product, who said Done exploring and when, and opens the exploration. Done exploring now records who said it in the exploration block (`doneBy`). Explorations in product repositories come from the one read Changes and the home already make.
- ae41982: Being built: no "Exploration" tag on rows (every change starts as an exploration); the row's line already says where it comes from.
- d4f4929: Art print shop: the design team's copy has its own branch previews.
- 87e4794: Done exploring stands even when the `exploration` label could not be removed: the exploration reads as waiting for code, not running. Studio no longer shows designers GitHub housekeeping warnings after Done exploring (they go to the console for developers).
- 6247af7: Studio Components drawer: the story preview sizes to the story (Bridge's Storybook posts its height when embedded) instead of a 1200px frame with its own scrollbar; other Storybooks rest at a sensible height.
- d1d97bb: Exploration page "..." menu: Rename (the pull request title and the exploration's name in its body, the branch and preview link unchanged) and Back to exploring (undoes Done exploring while no developer has pushed since: the developer section and the done marker leave the body, the `exploration` label comes back, `ready-for-devs` goes; a refused label write still succeeds through the body). New core exports: `renameExplorationOnGitHub`, `reopenExplorationOnGitHub`, `withExplorationName`, `withoutDoneExploring`, `renamedExplorationTitle`; the exploration block gains `reopenedAt`.
- c780de1: Exploration page after Done exploring: a Review step between "Developers build it" and "Shipped". It reads the pull request's reviews (one call, once the developers have started) and its draft state: waiting while they build, then who is asked to review (the requested reviewers, else the design approvers), "Your review" with a link to compare with the exploration, changes requested by whom, or approved by whom.
- 05f694c: Studio: page headers drop their drawing, so the primary action sits at the end of the title line again and the header stays compact; Field Guide drawings show at once, with no draw-in.
- 442a926: Studio Home: an exploration handed to developers reads "Waiting for code" on its card even when its exploration label could not be removed.
- b7663ee: Studio Home: an exploration card's preview runs edge to edge under the card's border, so its top edges no longer look twice as thick.
- 296f63d: Studio Home: Start an exploration is the one way to start. Editing tokens, asking for a component change and writing guidance stay on their own pages.
- 04f9d1b: Studio Home, nothing waiting: the Harbor zone becomes a window onto the harbor instead of a small drawing in its corner. The water runs across the whole zone along its bottom (one unbroken horizon, two rows of ripples, clipped by the rounded corners); the bridge stands on it in the right third and runs out of frame; the sailboat with the fisherman rides in the foreground left of it; gulls, the sun and a cloud fill the sky. The greeting sits above the water with its baseline on the top of the arch. A narrow zone lets the gulls go, a phone keeps only the water. `QuietScene` gains `layout="window"` (the inline drawing stays the default).
- 1065df6: Studio Home: when nothing waits on you, the Harbor zone is no longer an empty box. A Field Guide harbor scene (the bridge with its flag, a moored sailboat with someone fishing, a cloud passing the sun, two gulls) draws itself in once, then breathes in slow, staggered loops built on the slowest motion token; with reduced motion it stays a still drawing. The line under the greeting reads "Nothing needs you. The harbor is calm." The scene is a reusable QuietScene component with a `scene` prop, for other calm states later.
- b737f7c: Studio setup: "Invite your team" now invites people by email with a role (the Invite collaborators dialog) instead of sharing a link. The team link in Settings is the team's own address, never Bridge's showcase at /studio/.
- d68c7ea: Library: "Edit in Studio" and the other maintainer tools no longer blink when Studio renews the GitHub sign-in or GitHub is rate limited.
- 1e216a1: Studio setup: every step's main button does the step (Send for review, I installed it, Create the team); a done step says where it goes next; Do this later is the only skip. Products and Your AI tools mention the design team's copy. The team chip says Checking, not Guest, until the session answers.
- 0b8965c: Studio setup: the title uses your first name, never the GitHub login; "Every step after sign-in can wait" leaves once every step is done; the Products line no longer asks to make a copy that may exist.
- db2bcdf: One admin product: Bridge's config lists Product admin (its own repository, peterbono/bridge-product-admin) and the library only. The Admin demo (apps/admin) stays in this repository as the migration demo and the visual check's app, but is no longer a target of Start an exploration, Home, Changes or Being built; an old exploration labeled "product: admin" lands on the library instead of failing. Studio and Try it in the product pick a product's preview app by its key from bridge.config.json, no longer by a fixed "admin".
- 58198a9: Studio: after Bridge checks an exploration against the library, Done exploring reads the result from GitHub, not a copy from before the check, and a clean check is enough to go on.
- 4967d1f: Open the preview works when Vercel built the branch but Bridge has no Vercel comment to read: a finished Vercel commit status now gives the branch alias Vercel serves (core `vercelBranchAlias`, the shortened `-git-...-<hash>-` form included), and an exploration started for a product of the design system repository falls back to that product's own preview template when the page lists no preview apps (a team page).
- 959ee85: Team Home: the explorations of a product's own repository show again. The read of product repositories made before the team's settings arrived (no product repository known yet) no longer stands for the team's own, so the Home lists them under Recent explorations and the product folders count them.
- b47da1a: Quality: the adoption gain next to the number says where it counts from, as its sentence does ("since the first audit" on a team's Quality page, "since Bridge" where the before run is the move to Bridge).
- 1a32a57: Studio polish: actions first, quieter pages, a product filter. Tokens: New token sits on the page title line. Quality: the pillar cards show a tile per brand and theme, a share per product and a dot per component instead of three full bars, with the points gained since Bridge. Home and product exploration cards are shorter: the status, then the person and the product on one line. A product page offers only Open the live product, and names the connection only when it is broken. Changes keeps the designer tabs (All, Waiting on me, Exploring, Shipped) alone on their row, and filters by product and person on a quieter row under them (?product=, old ?kind= links keep working). The admin product is named Art print shop in bridge.config.json.
- 55f6d8c: Studio: an admin renames a product from its page (sent for review as a settings change, the title keeps the current name until it merges). The exploration hand-off says where the work went: "Sent to the <product> developers." and "In their task list. You see here when one picks it up."
- a0fcc6b: Studio: in a team's workspace, an exploration in the design system repository opens on its exploration page instead of a blank page.
- 61ddbfd: Studio: the team Home shows your explorations and products.

  - Exploration cards keep more room between their tag and their person line.
  - Team Home: when nothing needs you, the ways to start stay on top, then "Recent explorations" (the four newest, "See all" on Changes when there are more) and the product folders. The Home now waits for the team's settings before it reads products, so an exploration in a product's own repository is no longer missing.
  - The greeting tells the truth: "Nothing needs you. 1 waiting for code." when your own work is open, "and you have nothing in progress" only when nothing is.
  - Product folders count every open state (exploring, waiting for code, being built, in review) and show no empty grey block without a capture.
  - Product page: archived explorations are one quiet line, "1 archived. See archived", to Changes' Archived tab, instead of a fold of cards. An archived exploration is tagged "Archived", never "Exploring".
  - Start an exploration from a product page shows "Where" as a read-only line with that product, no dropdown.
  - Quality: the four contrast tiles share one height; the Home's harbor scene moves enough to be seen.

- 42812c8: Studio: the Tokens table fills its width again. The exploration page's layout classes no longer share names with the token explorer's.
- Updated dependencies [ff5d30f]
- Updated dependencies [b131960]
- Updated dependencies [87e4794]
- Updated dependencies [d1d97bb]
- Updated dependencies [194c7a1]
- Updated dependencies [4967d1f]
- Updated dependencies [8890c22]
  - @bridge-ds/core@0.26.0
  - @bridge-ds/react@1.8.3

## 0.23.0

### Minor Changes

- b66bd3d: Studio Changes: History is gone from Changes. What shipped has its own tab, Shipped (before Archived): every change
  and exploration that shipped, newest first, grouped by month, with its preview, product, person and "Shipped Oct 30".
  It replaces the "added to the library this month" line. The next release and its Review and publish moved to the top
  of Being built, shown only to whoever may publish it, and the token and guidance changes by release (with their
  Filter) moved to the Library changelog, read only. Old History links land on Shipped, Being built or the changelog.
- 46b2c20: Studio Changes: the tabs say where the work stands (All, Waiting on me, Not started, Exploring, Draft, In review,
  Waiting for code, Archived, each with its count; empty state tabs hide). The people select is the only people
  filter: Everyone, You, then each designer by display name. Old ?who=mine links open on You. Rows show one display
  name per person, the login only when no name is known.
- 2e286d2: Library docs in Confluence: every component and token page has Copy for Confluence in its header (clean HTML that
  pastes as headings, tables, code blocks and color swatches, with a Markdown fallback and a footer naming Bridge as the
  source), and the Library home has Export the docs (a zip of every page as Markdown with an index.md, built with the
  site). One generator renders both. New docs page: Docs in Confluence.
- 9985e11: Studio: "Start an exploration" replaces "Start a change" on the Changes header, with the same one-step flow as the
  home. A change to the library is an exploration whose target is the library: the Where menu lists each product,
  then The library (Tokens, variants, new components). The old two-step type dialog is gone. "Something looks wrong?
  Report it" stays in the dialog footer; the token editor stays on Tokens and the home's Edit tokens. Old
  ?view=explorations&start=new links open the new dialog with the library picked. The MCP Jira hint names the new button.

### Patch Changes

- ae61b82: Being built: the filters are DS Tabs (underline) with a count on each, like Changes.
- 59c0cca: Studio Changes and the home leave out pull requests that only change Bridge itself. bridge.config.json takes an
  optional `tooling` key: the folders that are the tool around the design system (`paths`, with `!` to keep a file as
  design system) and the pull request title scopes that mean tooling (`scopes`, the guess until the changed files are
  read). Core `isToolingPull` decides: the changed files once read, the title's scopes before; explorations, bridge/
  branches and changes Bridge opened for someone are never left out. Without the key (a team's design system
  repository) nothing changes. Bridge's own repository lists Studio, the core, the CLI, the MCP server and the toolbar,
  so Shipped shows design system work only. The side nav's account row shows the GitHub profile name, the @login
  staying in its menu.
- 323c54c: Studio Changes: the state filter is DS Tabs (underline) instead of a segmented control, since it holds up to eight
  states with counts. The kind and people selects sit at the end of the same line.
- a024d84: Exploration page: Continue in Claude and Check in Claude first check that the viewer has connected Bridge in their own
  Claude (one read of the team's connections per session). Not connected yet: a short dialog with the two connector
  steps, the address to copy, a link to Claude's connectors and "I've connected it, continue". A failed read, a
  signed-out visitor or the sample team open Claude directly as before. The Terminal tab of a product exploration names
  the one `bridge connect` command its folder needs. An email member's own connection now reads as theirs.
- 854a1db: Exploration page: Continue in Claude and Check in Claude open a new Claude conversation (claude.ai/new) with the
  line already in the message box, and still copy it. With Terminal picked, the button copies the line.
- 06b3a4c: Explorations show a real screenshot of their preview on their page, on the Studio home cards and in the Changes rows,
  with "Captured 2 h ago" where it fits. A new workflow (Preview shots) captures the preview of every open exploration,
  in this repository and in each public product repository, into the `bridge-shots` branch; Studio reads it without
  GitHub API calls and keeps the plate when there is none. The plate now picks a different Field Guide drawing per
  exploration, the home cards line up their tag, product and person, and the exploration page ends both columns on one
  line (the activity moves under the preview after Done exploring).
- b2a836d: After Done exploring, an exploration keeps the page it had while it ran: the status tag (Waiting for code, Being
  built, Shipped), who said done and when, the preview, what happens next in three steps, what the library gets from
  it, and the activity. Bridge checks a product exploration against the library by itself (on the page, and in the
  Done exploring dialog) instead of sending the designer to Claude. A preview Bridge has no capture of shows a plate
  naming the changed screen and the product, and the Studio home cards use the same status tags and people's names.
- 1fda823: Studio, signed in: reads keep the token. An expired sign-in is renewed before a read, a 401 is renewed and read again
  with the fresh token (never anonymously), and clients made before a refresh send the current token. When GitHub's
  hourly limit for the account is reached, Studio says so and when it resets, never "anonymous reads" nor "Sign in".
  The exploration page names its author with the display name this browser knows, the login only when none is known.
- 61b4f83: Your AI tools: each person picks the AI tools they use (Claude app, Claude Code in a terminal, GitHub Copilot in VS
  Code) once in onboarding, then in Settings; kept with their Bridge account (else in this browser), and an admin sets
  the team default new members start from. The exploration page's Continue panel and Start an exploration show only
  those tools: one tool, no tabs; several, tabs limited to them, the last one used open. Never answered: the Claude
  app when the viewer's Claude has Bridge, else the team default, else Claude app and Terminal, with a quiet "Use
  another AI tool?". The VS Code (Copilot) tab has the same line, "Copy for Copilot" and the one command the repository
  needs; Start says "Start in Copilot" and copies the line. The connect gate stays on the Claude app path only.
- Updated dependencies [59c0cca]
- Updated dependencies [61b4f83]
- Updated dependencies [faf78be]
  - @bridge-ds/core@0.25.0

## 0.22.4

### Patch Changes

- 4264fa0: An exploration no longer reads as having a problem. Its guard check, "Exploration not merged as is", fails by design
  while it is an exploration, so the one check summary (core `summarizeCi` with `exploration`, `GitHubClient.getChecks`
  with `exploration`) leaves it out for a pull request that is one (new `isGuardedExploration`: the `exploration` label,
  or a running `explore/*` draft whose label is missing). Studio statuses, Home, the review queue, the branch page, the
  MCP branch facts and review, and the Done exploring note use it; any other pull request with that check failing
  still counts it. Exploration rows on Changes and Home cards now carry the state their page shows, as the one status
  tag: "Not started" while only the Bridge note changed, "Exploring", "Archived", or where it stands after Done
  exploring (new core `explorationStateLabel`), and Changes rows say when the exploration last moved.
- 5cd2462: The signed-out (read-only) Studio home now says what a running exploration's page says on its card, "Not started"
  or "Exploring", like the signed-in home, instead of always "Exploring".
- Updated dependencies [4264fa0]
  - @bridge-ds/core@0.24.0

## 0.22.3

### Patch Changes

- a367cfe: Being built: a request closed as not planned stays in All for 7 days after it was closed (`BUILD_DECLINED_DAYS`), then leaves the list, its counts, the page sentence and the empty state; a library branch from Figma closed without building is dated by its close. Each row's thumbnail shows the request's own In code now and In Figma pictures, labelled with its component (the component placeholder otherwise), and each of Claude's fixes is its own row, hovered as "Button: Claude's fix from Figma".
- 1a147ba: Exploration page: one "Open the preview" button (it opens the preview with the Bridge toolbar, Before and After, when the product supports it) beside "Continue in Claude", as one row on desktop and stacked on phones. "Try it in the product" is gone from this page.
- f8a1085: Every way into an exploration opens its exploration page. A link that names it as a change (Home, notifications, search, an old `?pr=` address) now lands on the exploration page instead of the change review, so designers never see the review footer or developer checks there. A running exploration whose `exploration` label is missing (an open draft on `explore/*` or with the Bridge block) still counts as running everywhere (core `isUnlabeledExploration`, used by `explorationStatus` and `isHeldExploration`), and Studio puts the label back when someone who can write opens it. Starting one labels it more reliably: `exploration` goes on by itself with retries, a product label GitHub refuses no longer takes it down too, and what is still missing is reported (`labelsMissing`). The feature sentence is no longer copied into the purpose when it is the name.
- 7af0bfc: The Bridge toolbar reads GitHub through Bridge's read proxy (new `proxy` prop, default production Bridge) instead of anonymous browser calls, so Before and After keep working past GitHub's 60 reads an hour per visitor. It reads GitHub directly when Bridge refuses or cannot be reached. Bridge's read proxy answers GET reads of public demo teams to the product origins their bridge.config.json names (CORS, no credentials).
- Updated dependencies [a367cfe]
- Updated dependencies [f8a1085]
  - @bridge-ds/core@0.23.0

## 0.22.2

### Patch Changes

- 0b4bba9: The exploration page puts "Try it in the product" back next to "Open the preview": it opens the exploration's preview
  with the Bridge toolbar, so Live product and This change flip on the same screen. It shows for a product whose
  production Bridge knows (`products[].production`, or `previews.production` for the Admin demo), in the design system
  repository or in the product's own. "Open the preview" now opens the preview as it is, without the toolbar. "See the
  product today" uses the product's own `production` URL when it has one.
- Updated dependencies [8f73c2d]
  - @bridge-ds/core@0.22.0

## 0.22.1

### Patch Changes

- 2dbb61f: Being built: Claude's fixes are rows of the one list, with the same tags and filters, asked by a name, and where each one stands comes from its pull request (a merged fix reads Shipped). The separate "Claude's fixes" section is gone.
- dc3fec0: Exploration fixes from dogfooding. The draft pull request title keeps the name as typed and never doubles the prefix ("Exploration: Exploration page, pick up where you left off"). Branch slugs go up to 60 characters, cut on a word boundary, so a valid name is kept whole. A person's commit with Claude's co-author trailer is credited to the person ("Florian with Claude"); Claude alone only when no person authored it (`isClaudeAssisted`, `humanAuthorOf`, `actorName`). The pull request body lists every configured preview app and points to the Vercel comment when the branch is too long for a predictable link, instead of saying previews are not set up. In Studio, signed-out visitors read display names from the commits and the author's public profile, and visitors without write access no longer see the Done exploring card; while the preview builds, the button reads "Preview is building" with a spinner at full contrast. `npm run build -w @bridge-ds/cli` builds @bridge-ds/mcp first when its dist is missing or stale, so the CLI no longer crashes in a fresh worktree.
- 949b731: "Done exploring" replaces "Promote to review" for explorations: the pieces the designer ticks go to the DS lead as requests with a link to the preview, the `exploration` label gives way to `ready-for-devs`, and developers take the branch as a starting point (`git fetch origin`, `git checkout explore/<name>`). Nothing is closed or merged, so the preview link stays alive; statuses read Waiting for code, Being built, Shipped. "Archive" (the `archived` label) hides an exploration from the lists without closing it, with an Archived filter in Changes. New: `doneExploringOnGitHub`, `archiveExplorationOnGitHub`, `proposePiecesOnGitHub`, `pieceRequest`, `bridge explore done|archive|unarchive`, `bridge_archive_exploration`; `bridge_promote_exploration` and `bridge explore promote` keep their names and now do Done exploring.
- 1df6116: The line Studio gives to say to Claude AI after starting an exploration now only opens the exploration with the Bridge library and hands control back ("I'll tell you what to explore."). It no longer asks what the library is missing up front: that report stays with bridge_missing_pieces when the designer finishes.
- dc3fec0: The exploration page picks up where you left off. While an exploration runs, Studio shows one of two states. Not started (nothing on the branch beyond the Bridge note): "Not started", who started it, "Nothing built yet" with the line to paste in Claude (Claude app or Terminal), "Continue in Claude" that copies it, "See the product today" and an empty "Your preview" frame. Exploring: who changed what and when in words (files mapped to screens and components, else the commit subject), the preview with "Open the preview" and "Continue in Claude", the "Happy with it?" card with Done exploring, and the last 3 events. The breadcrumb items sit on one baseline. Core adds the shared words (`explorationStage`, `continueLines`, `explorationActivity`, `lastActivity`, `whereItStands`) and `GitHubClient.listPullRequestCommits`. Claude resolves "Continue Bridge exploration #12" (or shop#12) with the new `bridge_continue_exploration` tool (`bridge explore continue` in the CLI): it switches a clean checkout to the branch and starts by saying where it stands. At the start of a session the server instructions have Claude offer, once, to continue the person's running explorations (`bridge_list_explorations` takes `mine`).
- 32948b0: Explorations created in a product's own repository (`products[].repo`) are no longer invisible after creation. Studio (Changes, home, Being built), `bridge explore list` and `bridge_list_explorations` read each product repository once (through the GitHub sign-in or Bridge's read proxy) and list its explorations under their product; a repository Bridge cannot read is skipped silently in lists and shown as not connected in Settings, `bridge products` and `bridge_list_products`. They open at `changes/?exploration=<n>&product=<key>` and are named `shop#12` by the CLI and Claude. Missing pieces, Done exploring, Archive and the developer section run against the product pull request; the requests from ticked pieces are filed in the design system repository with a link back (`owner/name#12`) and the product preview. Status follows the product pull request. New in core: `listProductExplorationsOnGitHub`, `parseExplorationRef`, `explorationRefLabel`, `productRepos`, `productOfRepo`, and a `library` client option on `doneExploringOnGitHub`, `proposePiecesOnGitHub`, `openLibraryBranchOnGitHub` and `productBranchViewOnGitHub`.
- 51da8b4: Explorations for a product with its own repository (`products[].repo`) are now created in that product repository by default: the `explore/<name>` branch and its draft pull request live where developers already work, and the library arrives as the npm package. Studio's "Create branch", `bridge_start_exploration` and `bridge explore start` share the rule (`productRepoOf`, `productRepoAccess`). When Bridge cannot reach the product repository, Studio says so in one line with "Ask an admin to connect <product>" and starts it in the library only if the person picks "Start in the library instead"; Claude gets the same message and asks before using `where: "library"`, the CLI takes `--in-library`. The purpose of an exploration is now optional everywhere: nobody is asked for a brief, and Claude starts one as soon as a designer says they want to explore.
- d91b46a: Publishing Claude's usage guidance from the docs editor now counts as its review: the drafts still pending go out kept (credited to Claude, `needsReview` false) instead of marked for a review nobody is asked for, and the send step says so. On the Studio home, a guidance draft someone already sent no longer waits on you: published, it reads "On its way to the library"; sent for review, "In review", and it opens the change. VisuallyHidden's guidance, published in #610, is marked reviewed.
- 2fb731d: Studio: an exploration of a product with its own repository that cannot be read links to its pull request in that repository, and tells a signed-out visitor to sign in (Bridge shows explorations of private products only to people who are signed in), instead of only "it cannot be read right now".
- 4ffd06f: "Try it in the product" never opens a canceled deployment. When Vercel's Ignored Build Step skipped a branch's build (an exploration that only has its note file), the branch alias opened "Deployment was cancelled". Core now marks such a preview `skipped` (from the Vercel commit status description or its comment), `productPreview` and `previewLinksOf` leave it out, and `CommitStatusLike` carries the status `description`. In Studio, a product branch with no build of its own opens the product as it is today (its production URL, else its preview pattern on the default branch) with "Same as the product today. Your preview appears after the first change." next to the button; a build in progress says "Preview is building" and a failed one "Preview not available yet", with the details under For developers. While exploring, the page no longer asks the designer to check what is missing from the library: the sentence and the "Missing from the library" zone show once the pieces were checked or after Done exploring.
- Updated dependencies [c8ebeda]
- Updated dependencies [dc3fec0]
- Updated dependencies [949b731]
- Updated dependencies [dc3fec0]
- Updated dependencies [32948b0]
- Updated dependencies [51da8b4]
- Updated dependencies [fedd0c0]
- Updated dependencies [d91b46a]
- Updated dependencies [54a8c8c]
- Updated dependencies [6a44454]
- Updated dependencies [e8a6e7b]
- Updated dependencies [4ffd06f]
  - @bridge-ds/react@1.8.2
  - @bridge-ds/core@0.21.0

## 0.22.0

### Minor Changes

- d13ef5d: Sign in with Bridge in the Figma plugin. Designers connect with the Bridge account they already use: the plugin opens Studio with a one-time code (`/studio/connect-figma/`), they pick their team, and the plugin receives the team's repository and the GitHub sign-in Studio holds, with no token to paste and no secret on screen. The new `POST /api/plugin-link` keeps codes in Redis for 5 minutes, single use, and checks with GitHub that the sign-in can open the chosen team's repository. When the sign-in expires, the plugin says "Sign in again". A pasted token stays available under "For developers: connect with a token".

### Patch Changes

- 537952e: Explain the one 400 that opens every Claude session on the hosted connector: Claude probes the stateless MCP 2026-07-28 revision first and falls back to initialize when Bridge (2025-11-25 and earlier) answers 400 without a modern error, as the spec's era detection says. A test replays the handshake (probe 400, initialize 200, initialized 202, tools/list 200).
- b447dc4: The Bridge connector shows as Bridge with the Bridge mark: the MCP server's initialize answer carries `title: "Bridge"`, `websiteUrl` and `icons` (MCP 2025-11-25 Implementation, PNG 192 and 512 plus the SVG), and the site serves `favicon.ico` (16, 32, 48), `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` and a `site.webmanifest` named Bridge, linked from every page head.
- 163315e: Hardening: deleting a Bridge account ends its connections in Claude and deletes the GitHub tokens Bridge kept sealed for them; the Figma plugin hand-off keeps the GitHub token sealed while it waits, bound to its own link; the hosted connector never merges (`bridge_merge_branch` is neither listed nor run there, a person merges from Studio or GitHub). `createServer` and `handleHttp` take `{ exclude }` to leave tools out; the local CLI and MCP server keep every tool.
- ff3aea1: Ship: Bridge checks who asks and where a change comes from before it ships a push from Figma by itself. The author, with write access, records the push right after the plugin opens it (`POST /api/ship` with `mark: "figma"`), and Bridge ships it only while the head is the one it recorded, from a branch of the repository itself, with no change requested. Anything else follows the design approval rule. The plugin records each push before it asks Bridge to ship it.
- Updated dependencies [17f2849]
- Updated dependencies [acff80f]
- Updated dependencies [009a5ee]
- Updated dependencies [579f4a2]
- Updated dependencies [00cdee5]
- Updated dependencies [40b45ea]
- Updated dependencies [8a83d88]
- Updated dependencies [8cef447]
- Updated dependencies [6842370]
  - @bridge-ds/core@0.20.0
  - @bridge-ds/react@1.8.1

## 0.21.0

### Minor Changes

- b372de6: The demo for visitors, as the approved boards show it (D1, D1b, D2). A "Demo workspace" banner over every Studio page says the data is read-only sample data, with "See it on GitHub" and "Use your own repo" (it opens "Create a new team"). Studio home is the signed-in home from the DS lead's seat: "Good evening, Dana.", "8 changes need your review. Ann and Claude AI are waiting on Dana, who leads this design system.", the Needs you rows with their Review buttons, the grouped row with "Review all (N)", the library health line and "Explorations and branches". A three-step tour runs on the first visit. Every action that would change the demo (Create branch, New brand, Send suggestion, Approve, Start an exploration...) opens "Sign in with GitHub to do this for real." The demo is one list (lib/demo.ts DEMO_REPOS), and its activity is read through one function (scripts/demo-home.ts readDemoActivity) so a published activity snapshot can replace the GitHub reads. Owners with write access keep the normal Studio. The Studio side nav's ground now runs the full height of long pages.
- 080008c: Invite collaborators: a dialog from the team menu and Settings that takes several work emails, a role picker (Can view, Can edit, Reviewer as Designer or Developer, Admin) and lists who has access with Resend. Settings > Members lists the team with a role and a More menu per person for admins (Make admin, Remove from team with a confirm step), and as read only text for everyone else. The sample team shows its sample people and opens the demo dialog on every change; a site without invites set up says so and sends nothing. New page /studio/invite/ where the invitation email leads.
- c399625: Invites, hardened. Only the invited person can accept: the GitHub account must have the invited email, verified (the GitHub Apps need the account permission "Email addresses: Read-only"; people signed in before sign in again). Otherwise nothing is granted, the invite stays valid, and the invite page says which address it was sent to, masked ("m•••@acme.design"), and how to fix it. Daily caps per admin (20), per team (40) and for the whole site (80), overridable with INVITES_MAX_PER_ADMIN_DAY, INVITES_MAX_PER_TEAM_DAY and INVITES_MAX_SITE_DAY, plus a 10 minute pause and 3 resends a day per invite: over a cap the server answers 429 and Studio says "You reached today's invite limit. Try again tomorrow." Each invite record now expires in Redis with the invite and is deleted on accept and cancel.
- 81ef880: Invites by email, the server side: `/api/invites` keeps pending invites (email, role, team, who invited, expiry, only a hash of the link token) in an Upstash Redis store, emails a one-time link through Resend, and once the invitee signs in with GitHub gives their account access with the role's permission (Can view: read, Can edit: write, Reviewer: write plus a pull request listing them as design or tech owner, Admin: admin) using the Bridge Direct app's installation token. Admins change roles, remove people, resend and cancel invites; every call re-checks the caller on GitHub. Without storage, email or the app configured, it answers "Invites are not available yet on this site." Setup in docs/HOSTED.md.
- 0d1d8bb: Library access, server: /api/library-access stores who reads each team's Library (Anyone with the link, Anyone with a work email at listed domains, Only the team; admins only, checked on GitHub), emails readers a one-time sign-in link (15 minutes, only its hash kept, exact domain match, consumer domains refused), and opens a signed httpOnly session cookie for that team's Library (30 days, ended at once when the setting changes). Private Libraries are served from their published snapshot with a read-only app token after the session check; public ones keep 0 GitHub API calls. Daily caps per email, network, team and site. New env: LIBRARY_SESSION_SECRET (docs/HOSTED.md). Invites now offer contributor roles only: the server refuses Can view for new invites and role changes; existing ones keep it.
- 92f35f8: Library access, Studio and Library: Settings has a Library access band (who reads the library: Anyone with the link, Anyone with a work email at your domains, Only the team; admins change it, everyone else reads it) with Copy library link to share it with the company. A team Library that asks for a work email shows a calm gate: enter your email, Check your inbox, a wrong domain said on the field ("This library is open to @acme.design emails. Ask your design system team for access."), an expired link, or not available yet on this site; Only the team asks to sign in from Studio. Private Libraries open from the snapshot this site serves after the check. The sample team shows "Anyone with a work email at acme.design" and Save opens the demo dialog, with no call. Invites and Members offer contributor roles only (Can edit, Reviewer, Admin); someone who already has Can view still shows it and can be moved to a contributor role.

### Patch Changes

- 3bf221d: How Bridge compares: three marks (does it, does part of it, does not) instead of two, with the reason for each half mark in a tooltip and on /compare/. Cells re-checked against public docs (October 2026): Figma Make, Figma branch review, Tokens Studio branch reviews and more now get the credit they are due. The homepage table and /compare/ share one data source.
- 0b415fd: MCP server: the README lists every tool, generated from the server (`npm run readme:tools -w @bridge-ds/mcp`), and a test fails when they disagree. `bridge_plan_revert` lists 50 edits, conflicts and changes at a time with the totals (`limit`, `offset`) and cuts a very long PR body; `bridge_draft_docs` returns its prompt in pages (`page`) with a summary first. The docs draft lists only the contrast pairs the component takes part in (both sides among the tokens it reads, aliases followed), not every pair that shares a surface with it. `/llms.txt` no longer links the missing `/foundations/` page and links `/tokens.css` and each component's `/docs-ai/<component>.json`.
- Updated dependencies [fbf7f55]
- Updated dependencies [7eb8a27]
- Updated dependencies [aaac948]
- Updated dependencies [29162d9]
- Updated dependencies [401cdcc]
- Updated dependencies [efb3281]
- Updated dependencies [3364ee9]
- Updated dependencies [d89f7b7]
- Updated dependencies [57b8d89]
- Updated dependencies [3ed1ee5]
- Updated dependencies [afd9ba2]
- Updated dependencies [4fd6e15]
- Updated dependencies [e52619d]
- Updated dependencies [64d3e8b]
- Updated dependencies [9044d1a]
- Updated dependencies [48ee872]
- Updated dependencies [af6e3e9]
- Updated dependencies [ea27992]
- Updated dependencies [e65d3ee]
- Updated dependencies [4fb54b4]
- Updated dependencies [e1d05e0]
- Updated dependencies [e806350]
- Updated dependencies [f5cfbf0]
- Updated dependencies [02d38ad]
- Updated dependencies [8919183]
- Updated dependencies [7b9e2c2]
- Updated dependencies [7c52639]
- Updated dependencies [afa59e8]
- Updated dependencies [eb4ace6]
- Updated dependencies [0ed940f]
- Updated dependencies [9be32eb]
- Updated dependencies [e075f3b]
- Updated dependencies [fe906a6]
- Updated dependencies [a83618b]
- Updated dependencies [788b3f8]
- Updated dependencies [7f6064b]
- Updated dependencies [f7751a1]
- Updated dependencies [60388db]
- Updated dependencies [4f3102a]
- Updated dependencies [e9fd0c7]
- Updated dependencies [0b3aa07]
- Updated dependencies [dd97e25]
- Updated dependencies [9d0dc16]
- Updated dependencies [a9cbbab]
- Updated dependencies [1635400]
- Updated dependencies [57f26bf]
- Updated dependencies [30e8c14]
- Updated dependencies [4c8a5dc]
- Updated dependencies [43b6e31]
- Updated dependencies [d37207a]
- Updated dependencies [db8e449]
- Updated dependencies [4dc69ae]
- Updated dependencies [e4c34ee]
- Updated dependencies [ce6a8c7]
- Updated dependencies [fd0191c]
- Updated dependencies [4d61987]
- Updated dependencies [1c4e347]
- Updated dependencies [44f49ff]
- Updated dependencies [07380d7]
- Updated dependencies [ff50cd9]
- Updated dependencies [1c5563b]
- Updated dependencies [b822435]
- Updated dependencies [c0731d6]
- Updated dependencies [8fa49c7]
- Updated dependencies [d54ace8]
- Updated dependencies [d199eb5]
- Updated dependencies [96acdf2]
- Updated dependencies [d157472]
- Updated dependencies [eb4d6ce]
- Updated dependencies [8403d3d]
- Updated dependencies [f198e92]
- Updated dependencies [2b01116]
- Updated dependencies [27dff7f]
- Updated dependencies [c46846d]
- Updated dependencies [efa01d6]
- Updated dependencies [d8848ff]
- Updated dependencies [7f9930c]
- Updated dependencies [9ec466a]
- Updated dependencies [d8c7494]
- Updated dependencies [fb3815b]
- Updated dependencies [306774c]
- Updated dependencies [5309e2e]
- Updated dependencies [4aa0cd7]
- Updated dependencies [80ee954]
- Updated dependencies [df92fcf]
- Updated dependencies [d8e5e84]
- Updated dependencies [fe5fb1b]
- Updated dependencies [2d89e58]
- Updated dependencies [625a692]
  - @bridge-ds/core@0.19.0
  - @bridge-ds/react@1.8.0

## 0.20.1

### Patch Changes

- 037b56b: Hosted Studio for guests: signed out, a team's pages read its published `activity.json` (no GitHub API request), with "Updated 5 min ago" in the guest banner. History works for guests. What the activity did not record is read live, and a read GitHub refuses for the hourly limit falls back to it. Without it, identical anonymous reads go out once and are reused for two minutes in the tab. Every Branches row gets its status when the activity covers it, and the list never ends on an older paint.
- Updated dependencies [037b56b]
  - @bridge-ds/core@0.18.0

## 0.20.0

### Minor Changes

- 782dc75: Library and Studio headers: one switch replaces the "Open Studio" and "Library" buttons. A white pill names the space you are in, on a Deep Harbor track, with the other space as a drawn icon (pen and notes, open book). It carries the page's item across (Button in the Library opens Button in Studio, and back), keeps the team on team shells and team Libraries, and stays in the header on phones.

### Patch Changes

- 9dc3421: Homepage closing: the profile card the walkers carry is now a DS Card with a DS Avatar and a full-width "Connect on LinkedIn" button. Real padding and rhythm, about 20% larger, and the whole card is one link with the Card's hover lift and focus ring.
- be7d93d: Homepage, design system lead section: Dana's avatar stroke is Deep Harbor.
- 8bc361a: Homepage, design system lead section: Dana's avatar has a white stroke instead of a drop shadow.
- 9f111af: Studio team chip: it now describes the design system you are looking at, never your account. On the demo it shows the Bridge mark and "Bridge demo" (the repository in the tooltip) with "Explore freely" for visitors without an account, and its menu offers "Create a new team" and "Sign in with GitHub". On a team page a visitor without an account reads "Guest". Signed in, the chip keeps Admin, Can edit, Can suggest and Read only. Being signed out is said once, in the account block at the bottom of the nav.
- 3cf7e57: Homepage hero: back to Explore with AI. / Keep what works / in your design system., with an 80px protection space between the headline and the drawing.
- 4774fa4: Homepage hero: "design system." sits on its own line (Explore with AI. / Keep what works in your / design system.).
- 4b86d9e: Homepage: the step illustration panels lose their border and shadow, so the drawings sit straight on the page.
- 12e363f: Homepage: the step sections' drawing panels sit on a white card (the raised surface, neutral 800 in dark) with the emphasis hairline and the card elevation, instead of a grey fill.
- 5ec4a47: One status per branch, everywhere. `reviewStatusKind` is the single derivation for the Branches list, the branch page, the home cards, `bridge_what_needs_me`, `bridge_branch_status` and `bridge branch status`. A repo with no automated checks is a calm state of its own ("No automated checks", `CI_STATE_LABEL`) and the status comes from the approvals, as for any branch. While GitHub computes whether a branch merges cleanly, a missing approval still shows; "Checking for conflicts" only holds back "Ready to merge". The words live in core (`REVIEW_STATUS_LABEL`), and the branch page header now shows the same pill as its row ("Owner override needed", "Design owner to approve") instead of a plain "In review".
- e849e5c: Studio team chip, Recent teams: a team joins the list only after its page read the repository (public, read, write, admin or outside contributor), never because someone typed it in the launcher or the Create a new team dialog, and a team GitHub answers 404 for leaves it. Placeholders such as owner/repo or owner/design and invalid names are cleaned out of the stored list when it is read. Each entry now has a "Remove from recent teams" action, a sibling menu item on the same row, reachable with the arrow keys, that updates the list in place.
- 5ec4a47: Suggestions, visual checks and titles. A suggestion whose change no longer applies to main (main moved and the value it changes is not the one it was suggested from) reads Outdated in Studio, `bridge_list_suggestions` and `bridge_get_suggestion`, through one core rule (`suggestionStalenessOnGitHub`, over `planSuggestionApply`). An applied and closed suggestion keeps only its final label ("suggestion: applied"; "suggestion: declined" when declined): `bridge_apply_suggestion`, `bridge_link_suggestion`, `bridge apply` and a merge from Bridge (`markSuggestionsAppliedOnGitHub`) remove "needs review" and "applying". The visual-check label and "the visual comparison runs again" are offered only when the repo has the visual impact workflow (`hasVisualWorkflow`, `visualOffer`); otherwise the branch page shows a quiet "Set up visual checks" link. Request and suggestion titles are never prefixed twice ("Select: select: ...") and keep component names as written ("EmptyState"), through `subjectTitle`.
- Updated dependencies [5ec4a47]
- Updated dependencies [5ec4a47]
  - @bridge-ds/core@0.17.0

## 0.19.0

### Minor Changes

- 66374cd: Studio: "Create a new team" in the team chip menu now opens a dialog over the page instead of leaving for the launcher on Studio home, so you keep your place. Paste owner/repo or a GitHub address; after a short pause a calm line says what you will find there (Ready, Read only, Bridge is not installed yet with "Install Bridge" for admins, Not found or private, or Sign in to check). The dialog and the Studio home launcher share one parser, the same error words and the same team address (lib/team-open.ts).

### Patch Changes

- a1825f7: Homepage hero: one call to action. Get started stands alone, with "Or explore the demo, no account needed." under it.
- 09f9912: Homepage hero: the drag slider is replaced by the approved illustration. Dana unpins the Profile header sketch from her AI exploration board and drops it in the Bridge machine; the known pieces go back to their twins in the design system, the new one is clipped into it, then code and the Figma kit follow (a 9.6 s loop, the final frame under reduced motion). The drawing column is wider (up to 680 px) and the headline stays about 57 px at 1440.

## 0.18.0

### Minor Changes

- da3e4ea: Team pages: History, component change requests and "Start an exploration" now work for the team in the address
  instead of the demo. History reads the team's merged token changes from GitHub (signed in, the 20 latest, with each
  change's token diff read when it opens), and the token drawer's "See the whole history" lands there. A request opens in
  place from the team's request issues. An exploration starts against the team's repository: in direct mode the first
  write asks for Bridge Direct's OK; in suggest mode Studio says why it does not start one, since an exploration is a
  branch.

  Core: the repo model reads the global stylesheets a library ships (new optional `components.styles` globs in
  `bridge.config.json`, default every .css file under `styles/` and `theme/` next to the components folder) and counts
  their `var(--token)` reads as usage, so team Quality and the team token explorer no longer flag tokens only base styles
  read as unused. Snapshots record the globs they read; a snapshot from before reads those files from the repository.

### Patch Changes

- Updated dependencies [da3e4ea]
  - @bridge-ds/core@0.16.0

## 0.17.0

### Minor Changes

- a448574: Review and New brand are real on team pages. Review lists what waits on you in the team's repository (its branches, suggestions, guidance drafts and contrast failures) and opens each one in place, with the same queue as the self-hosted Studio. New brand runs the four-step flow on the team's own tokens, brands and contrast pairs, and sends the brand the way the team's `changes` mode says: a suggestion, or a draft branch. In direct mode the first branch asks for Bridge Direct's OK before anything is sent. Drafts are kept per team in the browser.

## 0.16.1

### Patch Changes

- 6ca43c0: The Content-Security-Policy is enforced (`Content-Security-Policy` instead of `Content-Security-Policy-Report-Only`). Violations are still reported to `/api/csp-report`. The site has its own not-found page, replacing Vercel's platform 404 page, whose inline scripts the policy blocks.
- 4c76db7: Team Libraries are noindex on the server: every `/library/<owner>/<repo>/` address answers `X-Robots-Tag: noindex`, except the teams in the committed allow-list `hosted/public-libraries.json`. The build fails when `vercel.json` falls behind the list and prints the rules to paste.
- ff21200: The bridge-data workflow template pins @bridge-ds/cli ^0.11.0, the first published version with bridge snapshot.

## 0.16.0

### Minor Changes

- 9b0b653: Hosted Library per team (multi-team PR 4a). `/library/<owner>/<repo>/` serves a team's published design system:
  Home, Foundations (generic token specimens), Components (cards by family; one component with a live Storybook story
  and its `docs.json` guidance) and Tokens (every token with its value per theme). Each page is built once at
  `/library-shell/...` and reached through two new `vercel.json` rewrites; the build fails on a missing shell or on any
  file that would take a team's Library address. Signed out, a Library reads the team's `bridge-data` snapshot from the
  raw host with no GitHub API call; signed in, it reads like Studio. Pages are `noindex` unless `bridge.config.json` sets
  the new `library.public: true` (core `libraryIsPublic`, schema). `bridge snapshot` now also writes `llms.txt` (core
  `snapshotLlmsTxt`), which the Library links for AI agents. On a team's Studio, the header's Library button opens the
  team's Library. `scripts/hosted-smoke.mjs` covers the Library routes.

### Patch Changes

- Updated dependencies [9b0b653]
  - @bridge-ds/core@0.15.0

## 0.15.0

### Minor Changes

- 440f717: Team pages always sign in with the read-only Bridge app. When a team in direct mode saves code for the first time
  (start a branch, save to it, ship, review), Studio explains why in "Allow Bridge to save to branches" and asks for
  Bridge Direct's OK once, then lands back on the same page. Its token lives in its own slot next to Bridge's;
  suggestions and comments keep going out with Bridge. When Bridge Direct is not on the team's repository, admins get
  "Install Bridge Direct" and everyone else "Ask your lead". New optional `GITHUB_APP_DIRECT_SLUG`. The self-hosted
  Studio is unchanged. Core: a `fetch` that throws its own `GitHubError` keeps it instead of turning into "Could not
  reach GitHub".
- 79650d3: A team's Bridge says who gets in: one screen per GitHub access state (sign in first, no access with "Ask your lead for access", Bridge not set up with the install link for admins only, read only outside the team), a team chip at the top of the Studio side nav with your access, and "Invite your team" (the team link, "Who can do what", Manage access on GitHub for admins) as an onboarding step and in Settings. Onboarding is remembered per repository, and step 2 shows the hosted states.
- bad4f0a: Studio team context in the browser (multi-team PR 2b). `scripts/repo-context.ts` names the repository a page works on
  (the team address `/studio/<owner>/<repo>/` on a team shell, else `#bridge-repo` as before) and its settings
  (`siteConfig`), and loads a team's repo model from GitHub with core `loadRepoModel` and `gitHubSource`, cached in
  IndexedDB by repository and head sha (`scripts/repo-cache.ts`). Access is now read per repository with core
  `resolveRepoAccess` and its eight states (`resolveAccess`, `lib/access.ts`); a read-only outside contributor is no
  longer told that Bridge is not installed. Sign-out removes cached private repositories. Signing in with one GitHub App
  no longer removes the other App's sign-in, and `pickSignInApp` signs in for identity with the read-only app first,
  with Bridge Direct only to write in direct mode. The self-hosted site behaves as before.
- 0986099: Show how far Bridge has gone reading a design system, and open Branches for teams.

  - Core: `loadRepoModel` takes `onProgress` and reads in three phases (tokens, components, docs) with an exact file
    total from the first report; `readRepoTexts` takes an `onProgress(done, total)` callback; `gitHubSource` takes
    `onProgress` (the tree once read, then each body and whether it came from the blob cache).
  - Team pages (Home, Components, Quality, Tokens) replace the loading skeleton with a calm progress view: "Finding your
    design system", then "Using the saved snapshot" or "Reading N files" with a bar filled from real file counts
    ("Reading tokens 12 of 48", then components, then docs), then "Ready". Unknown totals stay indeterminate, a cache
    hit shows nothing. The Storybook quick start shows "Reading your Storybook" and the component count it found.
  - Team Branches lists the team's open branches (the same list as the demo) and its open suggestions, each reviewed
    in place. Review and New brand keep one calm line and "See it on the demo"; "View on GitHub" is gone.

- 55a0992: Team pages for the hosted Studio (multi-team PR 3b). Home, Components, Quality and Tokens on
  /studio/<owner>/<repo>/ now render in the browser from the team's repository: this browser's cache for the default
  branch head first, then the team's Bridge snapshot when it was computed from that head, else a live read from GitHub.
  Components lists the team's components with one Storybook preview in the drawer, or token specimens without a
  Storybook. Quality shows the contrast gate, token findings, docs completeness and adoption audits from the snapshot
  (or how to publish them). Tokens starts the same explorer and token editor from the team's files, with history read
  through GitHub when signed in. Loading skeletons, calm empty states and errors with Try again (rate limit, repository
  not found, too large to read).
- 6b95bfb: Team addresses for the hosted Studio (multi-team PR 3a). Every Studio page is also built as an empty team shell at
  `/team-shell/...` (`<html data-hosted data-shell>`, `noindex`), and `vercel.json` rewrites `/studio/<owner>/<repo>/...`
  and the escape form `/studio/~/<owner>/<repo>/...` to it, two rules per form with the trailing slash one first. Static
  files still win, so every existing `/studio/` page and deep link is unchanged. On a shell, the build-time Studio links
  follow the team (`scripts/team-links.ts`), and the page says team pages open there soon, with the same page on the
  demo. The build writes the paths a team can never take, read from the built Studio folder, to
  `/team-shell/reserved.json`, and fails on a missing or malformed shell or on a link to a Studio path no file serves.
  Team addresses and shells answer `X-Robots-Tag: noindex`. With `BRIDGE_HOSTED=1`, Studio home shows "Open your team's
  Bridge": a field that takes `owner/repo` or a GitHub address. `scripts/hosted-smoke.mjs` checks a deployment.

### Patch Changes

- 1c7c87d: The Install Bridge Direct link on team pages points to the real app, bridge-design-studio, by default.
- 9d40c77: Harden every HTML sink against repo and GitHub content, and ship a report-only Content-Security-Policy. Markdown links allow only http, https, mailto and relative targets, JSON embedded in pages can no longer close its script element, PR, preview, Figma, Jira and image URLs go through one URL allow-list, token values in inline styles drop `url()` and declaration breakouts, and docs.json example props lose raw HTML, handlers and unsafe URLs. A test lists every file that writes HTML with what makes it safe. `tryInProductUrl` returns an empty string for a preview that is not http or https. The docs site sends `Content-Security-Policy-Report-Only` (inline scripts allowed by hash, checked at build time), `X-Content-Type-Options` and `Referrer-Policy`, and collects violations on `/api/csp-report`.
- 662fb55: The docs site builds from the repo model: `loadRepoModel(fsSource(root))` runs once per build (`lib/model.ts`) and
  the token, component, contrast, explorer, history, Figma coverage, config and sign-in libs read it instead of their
  own parsers and hardcoded paths. `bridge.config.json` is parsed once; the site's settings come from core
  `siteRepoFromConfig`. A model problem (invalid config, unresolved alias, contrast pair on a missing token, docs.json
  that does not parse) fails the build, as before. Core fix: a component's description is the JSDoc right before the
  component, no longer everything from the first JSDoc of the file (a documented props interface leaked into it). The
  `href` option of `loadRepoModel` also receives the token path.
- 24b0db5: Every Studio link, redirect and Studio file fetch goes through `studioHref(path)` (`lib/team-path.ts`, also exported
  from `lib/nav.ts`), multi-team PR 2d. In self-hosted mode and at build time it returns `/studio/<path>` unchanged; on a
  team shell (`<html data-hosted>`) it keeps the team, `/studio/<owner>/<repo>/<path>` (or the `/studio/~/` escape form).
  The address parsing (`repoFromPath`, `isHosted`) moved there from `scripts/repo-context.ts`, which re-exports it. The
  explorer's token link helper is now `tokenFocusHref`. A new test, `no-studio-literals`, fails on any new literal
  `/studio/` path outside `team-path.ts`, `nav.ts` and `redirects.ts`; the three fixed exceptions (the OAuth callback in
  the sign-in lib and the token API, and an inline script on the Library tokens page) are listed with their reason. The
  built site is unchanged apart from chunk hashes and one new shared chunk.
- Updated dependencies [1a560aa]
- Updated dependencies [440f717]
- Updated dependencies [a797699]
- Updated dependencies [9d40c77]
- Updated dependencies [4fb3153]
- Updated dependencies [662fb55]
- Updated dependencies [0986099]
  - @bridge-ds/core@0.14.0

## 0.14.0

### Minor Changes

- b6f1e68: Opt-in `governance.soloOwnerCanApproveBoth` for a design system run by one person. When it is true and the owners
  resolve to exactly one person holding both roles, that person's approval counts as the design and the tech approval,
  so Tier 2 and Tier 3 pull requests and suggestions can reach approved. Default false: one person still never covers
  both approvals alone. The author of a change still never approves it. Core adds `soloApprover`, `soloOwnerOf`,
  `soloOwnerSentence` and an optional rules argument to `summarizeApprovals`; `summarizeSuggestionApprovals` reads the
  flag from its governance. Studio Settings shows an "Only owner" line when the rule is active, the suggestion and pull
  request reviews say "As the only owner, your approval covers design and code." with one Approve, and
  `bridge settings`, `bridge branch status`, `bridge suggestions show` and the MCP tools say the same.

### Patch Changes

- Updated dependencies [b6f1e68]
  - @bridge-ds/core@0.13.0

## 0.13.0

### Minor Changes

- 832ef94: Studio reads a published Storybook without the repository. Onboarding step 2 takes a Storybook URL: "Add Storybook"
  reads its index, keeps the address in this browser and says how many components it found. Studio > Components from
  Storybook (`/studio/components/storybook/`) lists them by family, with search, and opens a drawer per component with a
  live preview of each story or docs page, or a link to Storybook when the host does not allow embedding. Tokens,
  contrast checks and suggestions say in one line that they need the repository connected. A new `/api/storybook`
  function reads the index server side when the host sends no CORS header and reports whether previews may be framed,
  behind SSRF guards: https only, public addresses only after DNS, fixed paths, 3 redirects, 5 s, 5 MB.

### Patch Changes

- Updated dependencies [87cfb75]
  - @bridge-ds/core@0.12.0

## 0.12.0

### Minor Changes

- 7d5c34c: Studio reviews suggestions. A suggestion that waits on you shows on Home and in the review queue next to branches, and counts in the Branches badge (one list for all three). It opens on its own card, in the queue or from Branches (`?suggestion=N`, and from a product branch's missing pieces): who suggests it, Before and After, three proof chips (design system checks, contrast in light and dark, where it is used, re-run on today's main), a big Approve with Suggest changes next to it, Decline in More actions, and the next items stacked behind. A suggestion approved for an older version, or one main moved under, says so first. Approve and Suggest changes show only to owners; everyone else reads why. Once approved, the card shows how a developer applies it. How review works has a Suggestions section.

## 0.11.0

### Minor Changes

- d278a6c: A new homepage at "/", ported from the validated test page: drag the bridge to keep what your exploration added; "Start it in Bridge", "Ship it everywhere at once" and "One system everyone can trust", each step drawn as an animated Field Guide illustration; "Decide in seconds" for the design system lead; "How Bridge compares" (a short table, every feature on demand); the questions teams ask; and the Horizon closing. A new site header (Product, Resources, About, Sign in; one sheet on phones) and footer on every product page, an About page, and first versions of the docs at /docs/ (Getting started with Bridge) and /docs/figma-plugin/ (DS Bridge Figma plugin). Light and dark themes; under reduced motion the drawings rest.
- 5f370ba: Studio: how changes reach your code, and the setup steps. Settings has a new band, How changes reach your code: the mode in force (suggestions your developers apply, or pull requests Bridge opens, from `changes` in `bridge.config.json`, suggestions when the key is absent), what Bridge's GitHub App may do on the repo when you signed in with it, and Change, which sends the switch for review as a pull request on `bridge.config.json` like the other settings. In suggest mode it says plainly that Bridge's GitHub App can still write code on the repo: suggest mode is a Bridge rule until the read-only app ships. "See what your developers get" shows how a developer applies a suggestion: `bridge apply <issue number>`, or "Apply Bridge suggestion" in Claude Code with the Bridge MCP, with the one-time install command for this repo.

  The Studio home has the setup steps: sign in, your design system, products, how changes reach your code, the Figma plugin and Claude AI. While `bridge.config.json` does not say how changes reach the code, a signed-in viewer lands on that step first, with every other step a click away and "Do this later" back to the home. After that, "4 of 6 connected" by the greeting opens what is left (Finish connecting), until the viewer hides it. The Storybook quick start shows as coming soon: this Studio reads the repository it is built for.

- 77710b5: Studio sends follow how changes reach the code (`"changes"` in bridge.config.json). In suggest mode (the default when the key is absent) the token editor, the docs editor, the new brand flow, the undo and restore planner and a product branch's missing pieces send a suggestion through @bridge-ds/core: "Send suggestion", "Suggest docs change", "Suggest to the library", then "Suggestion #42 sent to your DS lead. A developer applies it once it is approved." with one link to it. The token editor turns its draft into core token edits, so a developer re-applies the exact edits on the tokens of the day. Until the read-only GitHub App ships, suggest mode is enforced in Studio: adding to an open branch, saving docs to a branch, switching a product branch or using a preview, sending it for review and closing it refuse with a plain sentence before any GitHub call. Direct mode keeps today's branches and pull requests (this repo sets `"changes": "direct"`), and Studio's token, brand and revert pull requests now use the `tier: N` label like the rest of Bridge.
- 877b928: Studio signs in through two GitHub Apps: "Bridge" (read only on code, Issues write) by default, and "Bridge Direct"
  when bridge.config.json has `"changes": "direct"`. The token function picks the app from an allow-list of the two
  configured client IDs, tokens are stored per app, and a sign-in made with the other app is removed with a prompt to
  sign in again. Sites with one app keep signing in as before.

### Patch Changes

- c96cdc2: Page filter bars use one control size, md, like the Library tokens page. Studio Components (search and family
  Select), the Show filter of change requests and explorations, the History filters and the branch filter on Studio
  home moved from sm to md, so the search, Select and SegmentedControl in a bar share one height. The Input, Select and
  SegmentedControl guidance now says md for a page's filter bar and keeps sm for dense toolbars, menus and panels.
- 8b2ff82: Homepage, "One system everyone can trust", third tab: a new drawing for adoption quality. A magnifier sweeps a page of the Docs site and flags three off-system pieces (a one-off card, a raw hex colour, an odd button); each snaps into its Harbor system version and the components and tokens in use go from 81.7%, before the audit, to 100%. It replaces the jar drawing. Light and dark from tokens; under reduced motion it rests on the audited page.
- a265dbd: Settings, How changes reach your code: the interim sentence "Bridge's GitHub App can still write code on this repo..."
  now shows only when suggest mode runs on the Direct app (the only one configured). With both apps, suggest mode says
  Studio signs in with Bridge's read-only GitHub App instead. The mode switch pull request body follows the same rule.
- 9e6c14e: Homepage: "Decide in seconds." shows Ann and Dana with the design system's own illustrated avatars again (Notionists faces, seeds `ann` and `dana`, drawn at build time on the Harbor circle), and the Before and After panes stay still while the stack and the Approve pulse keep moving. "How Bridge compares." reads "What each tool covers, from their public pages." on one line, and its table matches the validated test page: one card holding the short table, the legend and "Compare every feature" centred, with the test page's type sizes, row heights and column widths. Copy for designers: "Your DS lead approves just the change" (tokens, components and docs, before they reach the library), "A change that breaks contrast cannot go in", "Tokens in the W3C standard format", "Two-way sync between Figma variables and code", "Works with AI agents, through MCP", and the FAQ setup answer no longer says DTCG or repo.
- Updated dependencies [d1e0bc5]
- Updated dependencies [c96cdc2]
  - @bridge-ds/react@1.7.0

## 0.10.0

### Minor Changes

- e89cf36: A product landing at "/": explore with AI, keep what works in your design system. The trip of one change down a line, from an exploration to the library branch you open in one click, the review in the product, and the design system, all built with real Bridge components. A comparison page at /compare/ (as of October 2026, from public pages, with what Figma Code Connect does and does not do). The Library home moves to /library/; every other link keeps working. The Bridge agent account (bridge-agent) is named Claude AI on reviews, like everywhere else.

### Patch Changes

- Updated dependencies [22e53c7]
- Updated dependencies [e1f8f0c]
- Updated dependencies [e59366e]
- Updated dependencies [a99fbb9]
  - @bridge-ds/core@0.10.0

## 0.9.0

### Minor Changes

- adf195b: Studio shows product branches with the library pieces they need. A branch started for a product opens its product branch page: "Try it in the product", one sentence ("Built with the library. 1 piece was missing, and Claude AI opened a library branch for it."), the screen (the before and after, when the visual impact ran) next to the Harbor zone "Missing from the library", one row per piece with its library branch, status and reviewer, and the row's one action (Open a library branch, Use its preview in my branch, Get the latest preview, Switch to the published version). "Why it already shows in your screen" and "For developers" are folded. The review of a library branch a product branch needs starts with "Why it exists" (who needs it, for which product branch, the product preview) and, when the library has a close value, "Suggest danger". Branches lists the library branch under the product branch that needs it. Titles named after a component ("Badge: overdue tone") keep it.

### Patch Changes

- Updated dependencies [5b93962]
  - @bridge-ds/core@0.9.0

## 0.8.0

### Minor Changes

- 77ba45a: Create branch in Studio is product first. Step 1 asks what you work on: a feature in a product, or a change to the library. A feature asks what you build and in which product (preselected when there is one, or from `?product=`), starts an exploration with the product's `product: <key>` label and gives you the sentence to say to Claude AI. The library keeps its choices (Adjust the look, Add a variant or option, New component), and "Something looks wrong? Report it" stays one click away. core: `productMarks` (the product label and body line, nothing for the default product) moves from the MCP server into `@bridge-ds/core`, and `startExplorationOnGitHub` takes extra `labels`, so Studio, the CLI and the MCP server write the same label. Studio home: "Your branches" gets a one-line subtitle, and the "Published this week" line is gone.

### Patch Changes

- 7e9f2df: Docs proposals: one open proposal per component. Sending docs for a component that already has an open docs proposal adds a commit to it instead of opening a second pull request (`proposeDocsOnGitHub` returns `continued`, and `unchanged` when it already says the same). New core helpers `findOpenDocsProposal`, `findOpenDocsProposalOnGitHub`, `isDocsProposalBranch`, `continueDocsProposalOnGitHub` and `docsSlug`, shared by the Library editor and the MCP server (`bridge_save_docs` without `pr` continues the open one). The Library editor opens on the open proposal ("Continues the open proposal by ..., waiting for review", with a link to its review), and Send is off with "Nothing changed since the open proposal" when the text is the same.

  Attribution: the pull request's author line now says who wrote the text (`docsAuthorLine`, `withAuthorLine`, `defaultDocsFooter`): "Drafted by Claude AI, reviewed and sent by @person" when Claude's draft goes out as written, "Drafted by Claude AI, edited by @person" with the edited sections, and "No AI involved" only when no Claude draft is in the text. The editor tracks the text Claude wrote per section (`authorship`).

- 2da5cfd: Studio Components: the Open requests column leaves the table (teams triage requests in Jira); the component drawer still counts them with a link to GitHub.
- 74fe95a: Studio: screens no longer end with the "Updated" date and "View source" line (they show live data; Library pages keep it), and the Components table drops its note under the table.
- Updated dependencies [8cdcb9a]
- Updated dependencies [77ba45a]
- Updated dependencies [7e9f2df]
  - @bridge-ds/react@1.6.0
  - @bridge-ds/tokens@1.6.0
  - @bridge-ds/core@0.8.0

## 0.7.0

### Minor Changes

- b4edf85: Avatar: illustrated faces and Claude's identity.

  - `Avatar fallback="illustrated"`: without a photo (or when it fails), a drawn face that is always the same for the same `seed` (a login), on the Harbor zone color. The drawings are the DiceBear "Notionists" style (design CC0 1.0 by Zoish, code MIT), generated locally with no network. They weigh about 120 kB gzipped, so they live in a separate entry: import `Avatar` from `@bridge-ds/react/avatar-illustrated`. The main entry keeps initials as the default and stays light; `illustration` takes a ready image if you draw faces yourself.
  - `Avatar kind="agent" brand="claude"`: the Claude mark on a cream tile, same round shape as people, named "Claude AI", to attribute work Claude did. The Claude mark is an Anthropic trademark: check the Anthropic brand guidelines before shipping it in a product.
  - `avatarHtml()` in `@bridge-ds/react/dom`, the same markup for rows built in plain scripts.
  - Tokens: `color.illustration.surface` (the Harbor zone color, a lighter step in dark so line drawings stay readable) and `avatar.illustrated-bg`; `color.agent.surface` (cream, the same in both themes), `avatar.agent-bg` and `avatar.agent-border`.
  - Studio: change rows, the change and history details and explorations show a face and the person's display name instead of "@login"; work Claude made, and Claude's guidance drafts, show Claude's identity.
  - Studio Quality: the library health cards (contrast checks, adoption, guidance) open the page, with their detail below, and Share copies a short summary for Slack or a slide or downloads the header as an image.

- 7b53159: Motion is documented and reviewed from the code. The spec generator now records how a part opens and closes: the "Opening and closing" motion note carries the code's `enter` and `exit` transitions (duration, easing and their motion tokens, read per element so a drawer's side class and its popup class count together), and looping animations carry their `durationToken`. `componentMotion` returns them as `opening` and lists their tokens, so `componentsUsingMotionToken(specs, "motion.duration.moderate")` finds Dialog and AlertDialog. component-specs.json is regenerated (popup sets gain their open and close motion).

  Every Library component page has a generated "Motion and interaction" section in its Tokens tab: when it moves (hover, press, check, open, close, loops), what changes, the duration token with its value and the easing token in words, and what reduced motion does, in one sentence. Components without motion say so in one line; motion the specs cannot place is said, never denied.

  For branch reviews, `MotionChanges` (components/ds/studio/MotionChanges.tsx) shows a plain sentence per motion change, two looping previews of the same component at the old and new motion with Replay, and the other components it touches; still frames under reduced motion. `motionChanges` (lib/motion-changes.ts) computes the changes from the token sets and specs at both commits; `mountMotionChanges` (scripts/reviews/motion-changes.ts) mounts the block from a review page.

- eb66bd7: Studio branch review, redesigned: a breadcrumb (Branches, its product group, the title), the title with its status, and one line saying who asks and why. The change itself comes first, by type: guidance reads as it will in the Library with new text highlighted and click-to-edit (Save goes to the branch), tokens show before and after with the themes they change in, components show before and after screens with "Try it in the product". Below: the conversation (people only, latest comment inline, earlier ones on demand) and one line about checks with its details. One sticky decision bar: comment, "Suggest changes", "Approve" or "Approve and merge", and "More actions" (owner override only when it is the only way, share with a product team, copy a link to the review or for a developer, back to draft, close branch). Approving accepts a Claude guidance draft. A branch with several changes gets an outline with a "looked at" reading aid. The review queue uses the same view with its own bar (comment, Suggest changes, Approve, More actions with "Ask someone else to review"), outcome marks in its list, a toast with Undo after Approve, and A, S, J, K keys. "Open on GitHub" links leave this view.

### Patch Changes

- 51e743c: Studio parity: every action a designer takes in Bridge Studio now works with Claude (MCP) and in the terminal.

  - MCP: 20 new tools for branches in review (what needs me, status, send for review, back to draft, review, ask someone else to review,
    comment and reply, merge through Studio's gate with the owner override, close, reopen, update from main with
    token conflicts, try it in a product and share it, try 2 to 4 branches together), docs saved for review,
    explorations promoted or closed, products, settings and Figma coverage. `bridge_propose_token_change` takes
    `pr` (add edits to a branch in review), `jira` and `product`; explorations and requests take `product`.
  - CLI: `bridge branch ...`, `bridge products`, `bridge settings`, `bridge coverage`, `bridge docs save`, and
    `--product`, `--jira`, `--pr` where work starts.
  - Core: the review and merge rules, the branch writes, update from main, sharing, try in product, try together,
    docs proposals and Jira keys moved from the docs site into `@bridge-ds/core`, so Studio, the MCP server and
    the CLI run one implementation. New `products` list in `bridge.config.json` (schema included), defaulting to
    Admin demo and Library; Studio's Branches page groups by it with the same result.

- Updated dependencies [b4edf85]
- Updated dependencies [22d186e]
- Updated dependencies [51e743c]
- Updated dependencies [7b53159]
  - @bridge-ds/react@1.5.0
  - @bridge-ds/tokens@1.5.0
  - @bridge-ds/core@0.7.0

## 0.6.0

### Minor Changes

- a58ba2c: Studio Branches is all the work: the summary banner, the tabs and the status menu are gone. The header holds "History" (now a link, same view at ?view=history) and "Create branch" (the Home menu). One segmented control picks Mine, Waiting on me or All; rows are the Home row (before/after, who, title, Jira key, status pill, "N updates on main · Update from main" when behind), grouped by product (Admin demo, Library); explorations are rows with an Exploration status; merged and closed branches sit behind "N merged this month. Show merged". Token branches carry a checkbox to preview up to 4 together from a floating bar: one checked offers "Try it alone", two to four "Preview together" (a dialog asks for picks when they set a token differently). Old ?status=, ?tier=, ?view= and ?pr= links keep working. Also fixes the History token filter, whose field lost its id inside the DS Field.
- 022d79b: The Studio home answers "what do I do now". A time-of-day greeting says who waits on you and since when, at most
  three Needs you rows show a before and after of each branch, and the rest wait behind "Review all", a new review
  queue with "Approve and next". Your branches are cards with their status, and an empty library offers three ways to
  start.
- 8376732: Studio speaks Figma branching.

  - One vocabulary module (lib/vocabulary.ts) for every Studio screen: Create branch, Request review, Update from main, Review and merge, Merge, Publish for the release; statuses Draft, In review, Approved waiting for code, Merged, Closed. The Changes page is now Branches (same address).
  - No "For developers" fold left in Studio or the Library changelog. Where a design system lead may want the GitHub view, one quiet "Open on GitHub" link sits on the line of the thing it concerns; Settings explains integrations and protection in plain words with a "How it works on GitHub" link.
  - Request triage left the Studio home and the Branches tabs (teams triage in Jira). The code stays behind REQUEST_TRIAGE_IN_STUDIO; "Ask for a component change" still creates a request, and a request link still opens.
  - Create branch takes an optional Jira ticket key (DS-42) in the token editor, the Library edit mode, the new brand flow and Start an exploration. The key goes first in the GitHub title (and in the branch name outside explorations) so the Jira GitHub integration links it, and shows in mono on branch rows.
  - Core: `Exploration` takes an optional `jira` key; the merge-right sentence says "can merge this".
  - Figma plugin: the review flow strings say Request review and branch.

### Patch Changes

- ed4b28d: Every visual component is in Figma: 47 of 47, 46 generated from code and 1 drafted with Claude. The generator now draws Checklist, Form, Slider, Table (and TableEmpty), Tabs and TokenValue from their code examples. New generator capabilities: CSS grid rows and subgrid rows as auto layout, `::before` / `::after` decorations as layers, Base UI indicators sized to the selected item (a tab underline) drawn in that item, unselected tab panels hidden, `data-orientation`, sliders (thumb at the value, value render functions), tables as rows of cells, form errors reaching their field, typed values in fields, functions as values, string and list methods, helpers that return elements, plain modules of the package, React's JSX text spacing, screen reader text left out of sentences, example texts shown by default, and absolute layers placed per variant. Side effects on sets already in Figma: Field and Dialog lose an empty error layer, NumberField steppers get their dividers, ChoiceCard text wraps, CodeBlock reads its wrap style.

  Toast, shown from the `useToast` hook and never placed, is drafted with Claude: a spec written from the code in `packages/react/component-spec-overrides/Toast.json` (`"source": "drafted"`), validated against the format and the repo's tokens by `npm run specs`, counted as drafted (never as generated), marked "Drafted, check it" in the Pull preview and in its Figma description, and stale once its code changes. Specs record the code example they were drawn from, so the fidelity check renders the same content (rows, fields, tabs), and the Figma references capture renders hook-shown components (a toast) through their hook.

- bdca820: Honest Figma coverage. `npm run specs` now reads every component folder and records each one in a `coverage` list of component-specs.json: generated, unsupported with the generator's plain reason ("opens a popup", "uses CSS grid", "shows content computed while the page runs"), or a layout helper with nothing to draw. Support is decided by the generator from what it can read, no list to maintain. The plugin Pull tab says "26 of 47 components are in Figma" with the others folded under the count, each with its reason, and the Studio Components page shows a quiet "In Figma" column from the same data.

  Coverage goes from 6 to 26 of 47 visual components. The generator draws 19 more (Accordion, Alert, Avatar, Banner, Breadcrumb, Checkbox, CheckboxGroup, ChoiceCard, CodeBlock, Divider, Field, Kbd, Link, NumberField, RadioGroup and Radio, SegmentedControl, Skeleton, Switch, Textarea), and Icon counts as covered by the icon components of the Icons page. New general capabilities: content props as TEXT and BOOLEAN properties, Base UI checked states as a Checked axis, layers hidden per variant, translateX and row-reverse read as auto layout, flex grow and wrap, lists and selections from the docs preview, the page base stylesheet, em sizes, underlines, opacity, fixed and per-variant icons, images as the media slot, useRender links. Fixes from the fidelity check: a transparent border keeps its room (a transparent stroke counted in layout), link buttons are underlined, inherited typography reaches every text.

- 439dbad: Studio home: the greeting drawing is cropped to its scene (no empty sky), so it no longer makes the greeting taller than its text; its ground line rests on the task list.
- f301f84: Studio home: the greeting drawing keeps a gap above the task list instead of touching it, and the row button sits at the far right (the DS Button margin reset was overriding it).
- 429314c: Studio home: the Create branch card comes first in Your branches.
- fadf8ce: Studio home: the status pill on a Needs you row sits right after the row's text; the button keeps the far edge.
- 0502ea2: Studio home: Needs you rows get a verb button by count. One item: its button is the primary ("Review", "Fix", "Open"). Two or three: secondary buttons. More than three: no row buttons, the grouped "Review all" acts. "Waiting since today" now reads "New today".
- d4240cd: Studio nav: Branches comes right after the home, which is now called Home (was Overview), and Components comes before Tokens.
- 84a9143: Studio status polish.

  - Changes: the summary line and its button point at the most urgent change where it is your turn. With none, they name the most urgent change; when only a developer can move it, the line says it waits on a developer and shows no button.
  - A change: "Ready for review" keeps one tone whatever its checks say (status colour for the status only); failing checks show in the checklist and the "Blocked by tests" chip. The Overview and the change selector use the same tone.
  - Quality audits: share bars, legend keys and trend lines use the Harbor data hue and neutrals, never the success, warning or info hues.
  - Tokens: the type chips, the filter field, Options and New token sit at the DS control height (44px), up from 32px.

- 03a76fa: Studio: when only developer tests fail and the viewer can still approve the design or tech side, the list, the Overview and the opener say "Your turn: approve design" with "A developer fixes the failing checks meanwhile", instead of "Blocked by tests". Both go on in parallel.
- Updated dependencies [f655919]
- Updated dependencies [ed4b28d]
- Updated dependencies [bdca820]
- Updated dependencies [6b07b05]
- Updated dependencies [8376732]
  - @bridge-ds/core@0.6.0
  - @bridge-ds/react@1.4.1

## 0.5.2

### Patch Changes

- 837d215: Dark mode polish and leftovers from the critiques.

  - Tokens: `color.surface.strong` (Deep Harbor in both themes, for a strong mode surface) and `color.feedback.neutral.bg` (the fill of a status with no tone, one step off every surface in both themes), each checked by a new contrast pair. `popup.border` steps up to `color.border.emphasis` so a list opened inside a Dialog keeps an edge in dark.
  - SegmentedControl: the selected segment takes the checked control color as its edge, like a pressed Button toggle; it had no edge in dark.
  - Banner `appearance="strong"`: `color.surface.strong` with `color.text.on-solid` and a matching focus ring. In dark it was the light primary action color and read like a Harbor zone.
  - Badge neutral (subtle): `color.feedback.neutral.bg`, so grey status chips keep their fill on dark cards.
  - Docs site: the owner override confirmation is the DS Dialog for plain scripts (Textarea, Alert, SegmentedControl, ButtonGroup) instead of a native dialog; All tokens filter controls share one size; Quality audit tables stack on phones; the Changes tabs fit a phone; Changes rows say "Library moved on: N updates"; failing developer tests are never "Your turn" for the designer who made the change; the search palette shows the nav icons; Tokens type chips use the selected look; rows of a viewed change say "Changed" or "New"; "Bring in the latest library" uses the standard control height.

- Updated dependencies [837d215]
  - @bridge-ds/tokens@1.4.0
  - @bridge-ds/react@1.4.0

## 0.5.1

### Patch Changes

- a54ac38: `@bridge-ds/react/dom` gains the Dialog for pages without React at runtime: `dialogHtml()` renders the exact markup of `<DialogContent>` (same classes, same look), and `bindDialogs()`, `openDialog()`, `closeDialog()`, `isDialogOpen()` and `dialogReturnValue()` give it the React Dialog behavior: focus moves in and is trapped, the page behind is inert and does not scroll, Escape and the scrim close it, focus returns to the trigger, `aria-modal`, `open`, `cancel` and `close` events, and a `<form method="dialog">` inside closes it with the submit button's value. A parity test compares it with the React Dialog. SegmentedControl: the selected segment uses the raised surface, so it no longer disappears into its track in dark mode (light is unchanged).

  The audit counts a native element only when the design system has a component that replaces it: `<img>` is no longer a miss in a design system without an Image component.

  The docs site has no temporary audit allowlist any more: its prose links are the DS Link or ButtonLink, its icons are the DS Icon (the site's own glyphs, drawn through `createLucideIcon`), the Quality audit table is the DS Table, and the search palette, New token, Send for review, Connect GitHub and Undo planner dialogs are DS Dialogs opened by their scripts. Every Studio header control is the DS sm size.

- Updated dependencies [a54ac38]
  - @bridge-ds/react@1.3.0
  - @bridge-ds/core@0.5.1

## 0.5.0

### Minor Changes

- 67ae8f7: Variants and props for the gaps Studio and the admin worked around.

  - Button and IconButton: `pressed` makes a toggle (`aria-pressed`, a selected fill and a Deep Harbor edge; the look follows the attribute, so a script can drive a static toggle). Button `variant="link"` looks like a text link and stays a button, with the DS focus ring. `variant="inverse"` is the action on a strong surface (Deep Harbor, `color.surface.inverse`).
  - SegmentedControl: `appearance="strong"` fills the selected segment with Deep Harbor. Any number of segments: when they do not fit (a phone), the track scrolls sideways and fades the edge that hides segments instead of widening the page, and the selected segment scrolls into view. The focus ring now sits inside the segment so the track never clips it.
  - Select: `badge` on an option (a status or a count), shown on the item and in the trigger once selected. `portalContainer` on Select and Combobox.
  - Combobox, Select and Menu popups sit on the popover layer, above a Dialog or Drawer, so a list opened inside a dialog is never covered.
  - Menu: `icon` also takes an element (a brand mark); leading icons and indicators show reliably and keep labels aligned.
  - Table: `width` (token length, percentage or a fraction like `0.35`) and `minWidth` on TableHead and TableCell, `layout="fixed"`, and `narrowLayout="stack"`: under about 480px each row becomes a card, every value beside its column name (`label` on a cell, or the header text).
  - Alert: `actionsPlacement="inline"` puts the action at the end of a short message and under it on a phone.

  Adopted in Studio (Changes status filter on phones, the Viewing select's status badges, view and edit banners, Components "need guidance" filter, Settings approvals on phones, Start a change menu icons and families), on the Library site (terminal Copy buttons, Accessibility Compare) and in the admin Bridge toolbar (Before/After and Show what changed toggles). Homemade CSS for these is removed.

### Patch Changes

- 5bfc7e2: The adoption audit reads Astro, Vue and Svelte files. Template markup counts DS components imported in the frontmatter or `<script>` (Vue kebab case included), native elements a DS component should render (with the DS equivalent), local look-alikes named like a DS component (`Button.astro`), hardcoded values in `style` attributes (`style="..."`, `style={{ ... }}`, Vue `:style`, Svelte `style:prop`), `class` attributes and color attributes, and token references. The frontmatter and `<script>` blocks go through the TS scanner and `<style>` blocks through the CSS audit, with the file's own line numbers. Hidden inputs and elements inside `<noscript>` do not count. New escape hatches, both with a required reason and both kept visible in the report: a `bridge-audit-ignore-next-line: reason` comment on the line above (HTML, JSX, CSS or JS comment; a comment without a reason or above nothing is reported and ignores nothing), and `bridge audit --allowlist file.json` (`allowlist` in `bridge_audit`) for known file:line violations, with stale entries listed. The report gains `files[].ignored`, `files[].ignoreErrors`, `ignored` and the `astro`, `vue` and `svelte` languages (schema updated, still version 1). The docs site's `audit:docs` now sees its raw elements; they sit in a temporary, reasoned allowlist (`apps/docs-site/bridge-audit-allowlist.json`) until the native elements migration removes them.
- f1a8b55: Five new components and a supported path for pages without React. `CodeBlock` (code or a command in Plex Mono with a copy button that says "Copied"), `TokenValue` (a token name and value with a color swatch, for before and after values), `Checklist` and `ChecklistRow` (status icon, title, one line of detail and the action on the same row), `ChoiceCardGroup` and `ChoiceCard` (radio choices shown as cards with a title and a description) and `Banner` (a page-level mode banner, Deep Harbor or neutral, optionally sticky). The new `@bridge-ds/react/dom` entry renders Badge, CodeBlock, TokenValue and Checklist as HTML strings with the exact markup and classes of the React components, and adds `tooltipAttributes()` with `bindTooltips()` and `bindCodeBlocks()` for plain-script pages. `bridge audit` counts these renderers as design system components and now flags homemade look-alikes in script-built markup (`class="pill"`, `data-tip` tooltips). Studio and the Library adopt them in place of their homemade pills, tooltips, command rows, value chips, checklist, radio cards and mode banners.
- 9494004: Studio cleanup. Changes: the "In review" tab is now "All changes", its status filter is one Select named after the status model (All open, Draft, Ready for review, Approved waiting for code, Shipped, Closed), and the "try together" checkboxes appear only after "Choose changes", so the first screen holds about half the controls. A change detail keeps one ship control: Ship sits on the title line once the change can ship, and the disabled Ship in the action bar is gone, as is "Reply on GitHub". Tokens: on a phone the type chips get their own line and every brand and theme stacks into labeled lines; the draft bar reserves room so it never covers the last rows; a token changed in one theme only says which. Core and MCP: when GitHub's hourly limit runs out without a token, the error says so and how to fix it (set GITHUB_TOKEN for the MCP server) instead of blaming "this token".
- a833202: The docs site uses its own components for every form control. The Studio Components "All families" filter is a DS Select with each family's count as a badge (it was a native select with its arrow stuck to the edge). Token explorer search, switches, filter checkboxes and radios, code syntax menu and draft bar Review; Changes exploration form and history filters; Settings integration fields; Library token type filter, scope switches, copy buttons and the header links are DS Input, Textarea, Select, Switch, Checkbox, RadioGroup, SegmentedControl, Button, IconButton and ButtonLink, and the homemade CSS that styled the native ones is gone. Plain scripts drive them through two small contracts: `lib/select-bridge` (a DS Select island that talks to a script by events, `BridgedSelect`) and `scripts/vanilla-controls` (static Switch, Checkbox and RadioGroup marked `data-vanilla`). The raw controls left are marked with a `bridge-audit-ignore-next-line` reason (script-driven dialogs, the search palette field, a hidden file picker and four whole-row buttons), and their entries are gone from the temporary audit allowlist.
- Updated dependencies [5bfc7e2]
- Updated dependencies [f1a8b55]
- Updated dependencies [67ae8f7]
- Updated dependencies [0cfc3ff]
- Updated dependencies [9494004]
  - @bridge-ds/core@0.5.0
  - @bridge-ds/react@1.2.0

## 0.4.0

### Minor Changes

- 6fe9f88: Bring in the latest library. A change in Studio now says when the library has moved on since it started ("The library has moved on: 12 updates since this change started."), read from GitHub's compare API, with a "Latest library" row in its checklist. When nothing conflicts, "Bring in the latest library" asks GitHub to update the change, then the page refreshes its checks and visual comparison; the row says beforehand what happens next, from the library's rules (checks run again, approvals need renewing when GitHub dismisses them on new commits). When the change and the library changed the same tokens, the designer resolves them in Bridge: one row per token with the library's value, this change's value and the value before both, "Keep mine" by default or "Use the library's", and no default for a token removed on one side and changed on the other. The contrast checks run on the choices before anything is sent, then Bridge commits the resolved token files on top of the latest library. A conflict in code stays with a developer, with the GitHub link under For developers. The Changes list shows "N updates behind" on each change that is behind. Core gains `planTokenMerge` and `applyTokenMerge`, a file-by-file three-way merge of DTCG token files on the same rules as the Figma sync.
- 11f40fd: Change statuses and reopen. Every change in Studio now has one lifecycle, in designer words and from GitHub data only: Draft, Ready for review, Approved waiting for code, Shipped, Closed. A change waits for code when its design approval is in, nobody asked for changes, it is design work, and every failing check is a developer check; it names the tech owners from the config, or "a developer". The change page opens on one status line (a Badge, one sentence, at most one action): Mark as ready on a draft, Reopen this change on a closed one whose work is still there, or "Start again from this change" when its work was removed (its token edits go to the draft, then Tokens sends them for review). Back to draft sits under More. The Changes list gets a status filter (Open, Draft, Ready for review, Waiting for code, Shipped, Closed; a Select on phones) and one chip per row; the opener never points at a change that waits for code. The Overview "For you" rows carry the same badge, and your own drafts show there. Core adds `GitHubClient.convertToDraft`.
- 4c313d7: Try several changes together. On Studio > Changes (Open), each change has a checkbox; checking 2 to 4 token changes combines them in the browser: the latest library plus each change's own token edits (what it changed since it started, so a change that is behind never undoes newer library values). Nothing is written to GitHub. A token two changes set differently gets one row ("Use Darker default background's" or the other change's), and nothing opens until each has a pick; the contrast checks then run on the combination itself ("All 296 contrast checks pass with these changes together."). A change that edits code is left out and says why on its row ("This one changes code, so it can't be combined here."). "Try 3 changes together" opens the demo admin with `?bridge=101,118,120`: the Bridge toolbar applies the combined tokens live on the production admin (no preview holds all of them, and it says so), "These 3 changes" replaces "This change", its Changes sheet lists the changes with a checkbox each to switch one off live, and Before/After (B) and Show what changed (C) work on what is switched on, the tooltips naming the change a value comes from. "View the library with them" opens Studio Tokens, Components and Quality on `?change=101,118` (the #116 address model, with the picks in `use`): the banner names the changes, changed tokens are marked "Changed in #118", and Quality shows no combined numbers. Core gains `changeEdits`, `combineChanges` and `encodePicks`/`decodePicks` (token-combine), and `previewOverrides`/`cssOf` move to core (css-overrides) so Studio and the admin share them.
- 1a54198: Continue a change. In Studio Tokens, a designer adds more token edits to a change already in review instead of opening a new one, like "Add to open pull request" in the Figma plugin. The send dialog asks where the edits go (a DS RadioGroup): their own most recent token change is the default, "Start a new change" the alternative, and changes someone else opened are offered to people with write access but never picked for them. A change page has "Edit tokens in this change": it opens the token editor scoped to that change, with its values and a persistent banner ("Editing: Darker default background. Your edits are added to this change.") and a way back; that draft is kept apart from the local draft. Saving rereads the change and runs the same 3-way token diff as the plugin: tokens only the change moved stay as they are, and a token edited in both stops the save with a plain message and a link to the conflict flow, so nothing is overwritten. The commit goes on top of the change's current head as a fast-forward only update, the changeset keeps listing every token, and a comment lists what was added. Only open token changes (not explorations, brands or docs) take edits, and only from their author or someone with write access. The Changes draft strip says where the draft goes, and a change page says when GitHub dismissed an approval.
- 4bfd417: Studio tells design work from developer work, and says who really made it. Work that only touches code (a title that speaks code such as "React" or "props", tests, examples, types, build or tooling only, component code the visual impact run shows no difference for, a "tech" or "developer" label) no longer shows in Needs you, on the board columns or in the Changes badge: the Overview folds it into one quiet line under the board, "Developer work, 1 in progress", that opens its list. Changes keeps every item and tags developer work "Developer", with an All, Design, Developer filter that shows when a list holds some. When nothing says what a change is, it stays with designers. An exploration card says "Claude is building it" when a real marker says an agent made it (the pull request template box, the Claude Code footer or session link, a "Co-Authored-By: Claude" commit, an agent label, an exploration or request started from the MCP server), and "You are trying it" only for what you started from Studio. The exploration block now records where it was started (`source`: studio, figma, cli or mcp) and the agent behind it (`agent`), and the CLI records `agent: "claude"` when Claude Code runs it.
- df17495: Studio Overview redesign. One line ("Hello, Florian. 1 thing needs you." or "You're all caught up.") with one primary action: the first decision that needs you, else "Start a change" (Adjust the look, Add a variant or option, New component, Something looks wrong, each with one line; the component picker opens in place). Signed out, the page asks for one thing: "Connect GitHub to start working on the library." The Harbor zone opens only when something needs you and holds every designer decision in one list, usage guidance to review included. Library health shows three figures right under it (contrast failures, component adoption with its split per product, reviewed guidance), each opening Quality. In flight is a board in four stages (Exploring, In review, Ready to ship, Next release) with at most two cards each, the blocker written on the card with one status pattern, and on phones one row per stage that opens on tap. Bridge app updates no longer show on the Overview. The Changes badge in the side nav now counts only the changes in review that wait on your decision, with the same rule as the Overview, and hides at 0.
- 8a13b25: Studio change detail, designer first. The header says why the change is blocked and who acts, in plain words: one checklist with the design rules ("296 contrast checks still pass", or the failing pair and the token to change), the developer tests ("3 developer tests expect the old color. A developer needs to update them."), then each approval. Developer failures never read "Your turn: fix checks" to a designer: a design owner can approve the design while they fail, and only shipping waits. When the author waits on approvals, the checklist says why ("GitHub does not let authors approve their own"), with Ask for review (copies a ready message) and the owner override when the viewer holds it, instead of a menu. The before and after sits right under it with "What changes on screen", how to use the slider and what is compared; the slider starts at 25% so both sides show content. Open on GitHub, How review works, the failing checks with the tests they name, and Open failing test move into For developers. Contrast pairs that moved and still pass are one click away.
- 3210f75: Share with a product team. A change in Studio gets a secondary action next to "Try it in the product" that opens a dialog with a ready-to-paste message for a developer of a product team: the change title, the preview install command the Preview packages workflow posted for the latest update (read from its comment, never guessed), the "Try it in the product" link when there is one, how long the preview lasts and how to go back to the stable version. Copy message, or Open in email (a mailto link, nothing is sent). While the preview of the latest update is being prepared, when it failed, or when the change touches no library package, the dialog says so instead of showing a command. After the change ships or closes it says whether the preview still installs: the prerelease tarballs this repository uses are removed then, pkg.pr.new snapshots stay.
- fa28131: Try it in the product. The change detail in Studio links to the demo admin preview Vercel reported for the change, on the admin screen that changes most. Opened that way, the admin shows a Bridge toolbar: flip between the live product and this change (B), see each changed token as a before and after swatch, and jump to every screen the change alters. Token changes swap the live tokens in place; code changes move between the live admin and the preview on the same screen. Production shows nothing unless it is the live side of a code change.
- a03541a: View the library as a change. On Studio Tokens, Components and Quality, a "Viewing: Latest library" Select in the top bar lists the open changes with their status; picking one shows the page as it would be with that change applied, read only, with a persistent banner ("Viewing the library as Brighter primary action. Nothing is saved.") and the ways out: back to the latest library, open the change, and on Tokens "Edit tokens in this change". Tokens reads the change's token files and lists the tokens it changes first, marked "Changed in this change" with their latest library value on hover. Components paints its previews with the change's tokens and marks the components that look different or whose guidance the change edits. Quality never shows the latest library's numbers for a change: it says the change's quality is in its checks and links there. The address holds the view (`?change=N`); editing a change is `?change=N&edit=1`, so the two share one model, and links between these pages keep the view. Reads stay anonymous-safe: one GitHub read of the change's file list, then only the files it changed, kept in the browser per version. This replaces the branch picker StudioHeader carried but never showed.

### Patch Changes

- 6bb63a1: Library Changelog shows the real releases. Published versions come from each package's CHANGELOG.md, grouped into one release per publish with its date from the release tags (v1.1.0 on Oct 18, 2026, v1.0.0 on Oct 17, 2026) and the package versions it shipped; the pending entries show as "Coming in the next release". The page said "no release tagged yet" because the release tags sit on merge commits, which the commit list skipped. Each row puts the kind badge on the left and the title at full width, with one line under it and a small meta line (bump, then package tags or "5 packages" that opens the list). Long releases show their first changes and fold the rest; internal changes are folded; sources, GitHub releases, npm links and the pending files sit in For developers.
- ce8efd7: Library edit mode reads as a mode. A sticky edit bar opens the page on the Harbor zone, full page width, with "Editing <name>" and its state (No changes yet, Draft saved, not sent, Unsaved changes, Sent for review) on the left and the actions on the right: Draft with Claude, Cancel and Send for review as the one primary. "Keep all N Claude drafts" shows only when two drafts or more wait. While editing, the page sits on a tinted desk and only editable regions are white paper, with a dashed edge and an Edit hint on hover and the focus color on focus; the live preview and the Tokens, Code and Changelog tabs say "From the code". Escape leaves a field, then asks to leave editing: Cancel confirms before discarding. On phones the bar keeps the label, Send for review and a More menu.
- c499852: The docs now treat npm as the main install path. The Install page leads with `npm install @bridge-ds/react @bridge-ds/tokens` and `npx @bridge-ds/cli check`, lists every package with a link to its npmjs.com page and the version read from its package.json, and keeps the clone install in a "For contributors" disclosure at the bottom. The Agents page connects Claude to a GitHub repository with `npx -y @bridge-ds/mcp --repo owner/name` first (read-only, a token to open pull requests), with a local folder as the alternative. README, docs/AI.md and the package READMEs no longer say the packages are unpublished. `bridge init` now writes `npx -y @bridge-ds/mcp` into `.mcp.json` and the Claude Desktop snippet outside the Bridge repo (it wrote a path into the npx cache), and `bridge --help` exits 0.
- e143916: Studio sign-in. With Sign in with GitHub set up on the site, the designer UI has no token paste any more: the sign-in dialog, Settings and the account menu offer Sign in with GitHub only (a site without it keeps the token paste as its one way in). Signed out, every Studio page, Overview included, shows the same side nav foot: a full-width "Sign in with GitHub" button with "Read only until you sign in" under it.
- 6f0a5dd: Studio says "Sign in" everywhere when the site has Sign in with GitHub: "Sign in to send", "Sign in to start", "Sign in to propose", "Sign in to review", the rate limit and expired sign-in messages, and the token editor note. A site without a GitHub App keeps "Connect GitHub", since pasting a token is the way in there. The wording comes from one helper, `lib/gh-wording.ts`.
- Updated dependencies [6fe9f88]
- Updated dependencies [11f40fd]
- Updated dependencies [4c313d7]
- Updated dependencies [4bfd417]
  - @bridge-ds/core@0.4.0

## 0.3.0

### Minor Changes

- de895e9: Studio Components: "Change this component" replaces "Request a change". The drawer asks what the designer wants to
  change, in place: adjust the look (her component's tokens), add a variant or option (Claude builds it from her Figma
  frame in an exploration linked to a request, or "Ask a developer instead"), or something looks wrong ("Report a
  mismatch"). Signed out, the choice still shows and the last step connects GitHub. Requests and the Overview now say
  "@ana wants to change Button" instead of reading like tickets.
- adc0df7: Docs drafted with Claude in place, at three levels: the whole page (fill, or rewrite every section), one section, or a
  selected passage (clearer, shorter, or in the Bridge voice). Fill drafts the empty sections and never rewrites written
  ones: when the code is newer than docs.json, written sections are sent as checks, and Claude returns one only when
  something in it is no longer true for the code (the writer's wording kept elsewhere). Results say which checked
  sections are still accurate (`checked`) and which were updated (in `sections`). Same rule for MCP docs items
  (`DocsDraftTask.check`, `DraftResult.checked`).

  Core: new `docs-ai.ts` with the task model (`DocsDraftTask`, `validateDocsTask`), the prompts (`docsTaskPrompt`,
  `docsSelectionPrompt`; `docsPrompt` takes `{ keys, rewrite, outdated }` to ask for only some sections), the answer
  parsing and sanitizing to the docs.json shapes with em dashes removed (`parseDocsReply`, `sanitizeDocsSections`,
  `parseDocsTaskAnswer`, `sanitizeDocsReplacement`), the merges (`applyDocsSections`, and `mergeDocsDraft` for the
  docs-draft Action) and the Messages API request (`anthropicRequest`, `anthropicReplyText`). docs.json gains
  `draftedSections` (the prose sections a partial draft wrote, between `draftedBy` and `needsReview` in
  `formatDocsJson`); `markClaudeDraft(d, sections)` adds to it, `acceptDocsDraft` clears it, `sectionsNeedingReview`
  reads it. The draft exchange takes `docs` items (scope `"docs"`, source `"studio"`) whose results carry `docs` (the
  sections) or `replacement`; `createDocsDraftSession`, `ensureRequestsBranch` and `DraftPoller` move to core.

  MCP: `bridge_pending_drafts` and `bridge_write_drafts` explain docs items and accept `docs` or `replacement` results
  (title and summary are optional now, still required in practice for change items).

  Docs site: `src/scripts/docs-ai.ts` (`draftDocs`, `draftAvailability`, `outdatedSections`, `saveApiKey`,
  `applyDraft`) drafts with the designer's own API key (browser call, key kept in this browser only) or their own
  Claude through the exchange, from `/docs-ai/<slug>.json` (the facts from the code and the repo conventions, built
  with the site). The docs-draft Action now runs the same core code.

- 0426262: Edit a component's guidance in place on its Library page (`?edit=1`): same layout and live preview, every prose
  section editable with the read typography, Claude drafts shown per section with Keep and Discard (or "Still accurate"),
  a review rail, and "Send for review" through the existing docs save path. The separate Studio docs editor redirects to it.
- 4caee7a: Sign in with GitHub in Studio. When the site has a GitHub App (GITHUB_APP_CLIENT_ID and GITHUB_APP_CLIENT_SECRET on the host, docs/SIGN-IN.md), the side nav, Settings Account and the Connect dialog lead with "Sign in with GitHub" and keep "Use a token instead" as a quiet second way for developers. The sign-in uses state and PKCE, goes through one Vercel function (api/github/token.ts) that swaps the code for a user access token and renews it when it expires, and stores nothing on the server. Expired sign-ins, cancelled consent, the wrong account, a repository the app does not reach and missing app permissions each get a sentence that says how to fix them. Without the env vars Studio keeps the token paste exactly as before.
- dd2261c: Roles with default rights, editable per team, and a visual before and after that can run on demand.

  Core: `governance.rights` in `bridge.config.json` says which owner group may approve design, approve tech and ship
  (merge, which publishes to the products): `{ "approveDesign": ["design"], "approveTech": ["tech"], "ship": ["tech"] }`
  by default, and a team may let design owners ship too (`"ship": ["design", "tech"]`). A config without `rights`
  behaves as before: approvals follow `owners`, anyone with write access ships. New top-level `visualImpact.mode`,
  `"auto"` (default) or `"on-demand"`. Both are validated by `loadConfig` and the JSON schema and written back by
  `toConfigJson`. New exports in `rights.ts`: `DEFAULT_RIGHTS`, `normalizeRights`, `holdersOf`, `approverLists`,
  `shipPolicy`, `canShip`, `whoCanShipSentence`, `groupsPhrase`, `RIGHT_LABEL`, `VISUAL_CHECK_LABEL`.

  MCP and CLI: `bridge init` (detected configs) starts from the default rights.

  Studio: Settings gains Roles: one sentence, who holds each right with their avatars, and the visual before and after
  mode; "Change roles" proposes the edit as a pull request on `bridge.config.json` (only `governance.rights` and
  `visualImpact` change). Reviews counts approvals against the rights and keeps Merge off for a viewer without the
  ship right, saying who can ("Only the tech owner can ship this (@theo)."); the owner override never bypasses it.
  In on-demand mode a pull request without a before and after offers "Show the visual impact", which adds the
  `visual-check` label (the workflow runs on it), or links to GitHub without a write token.

- 1e78f3b: Roles by team: `governance.owners` may name GitHub teams (`"@acme/design"`) as well as people, so a company assigns
  roles by team and manages membership in GitHub. Still no database.

  Core: new `teams.ts`. `parseOwnerEntry` reads a person (`"theo"`, `"@theo"`) or a team (`"@org/team-slug"`);
  `loadConfig` and the JSON schema reject anything else with the entry named and both forms spelled out.
  `TeamDirectory` expands teams to logins through any client with the new `GitHubClient` methods
  (`listTeamMembers`, paginated; `getTeamMembership` for one person; `getAccountType`; `listOrgTeams`), cached for five
  minutes. A team it cannot read is a typed state (`no-token`, `missing-permission`, `not-found`, `personal-account`,
  `unreachable`) with the fix in `teamUnreadableMessage`, never an empty list: it keeps its place in the expanded lists
  and matches nobody. `approverLists` and `shipPolicy` take the team states; `whoCanShipSentence` names a team with its
  size ("Only the tech owner can ship this (@acme/web (4 people)).").

  CLI: `bridge check` lists the teams named as owners with their size and reports each team it cannot read, with the
  fix (never part of the exit code). MCP: `bridge_get_review` returns `roles`: who may approve design, approve tech and
  ship, with teams named, and an approval counts when the reviewer is in the team.

  Studio: approvals, who acts, the ship gate (with a membership check for the viewer), the Overview and History
  count team members and name teams as teams. Settings, Review rules gains Design owners and Tech owners rows: a team
  is a chip with its member count and avatars, a team that cannot be read gets one sentence with the reason and the
  fix, and Edit takes a person or a team (a DS Combobox suggesting the organization's teams and the repository's
  people), sent for review on `bridge.config.json`.

### Patch Changes

- 4d85720: Studio adoption in plain words. Quality rows lead with the current value, big, and the value before the move to Bridge as a quiet "Before Bridge" label, with one sentence that says what adoption means. Each adoption report page is redesigned: the product name, one summary sentence, the two metrics in the same block as on Quality with a plain sentence each, the trend only when there are two runs or more, a component bar with its legend and counts, one success line when no hard-coded value is left, then "How adoption is measured" and one "For developers" fold that holds the other runs, file tables and commands.
- d5bbba9: Exploration install commands that work. On exploration #64 the plugin showed a pkg.pr.new command that returned 404
  (the pkg.pr.new app is not installed); the working one was the prerelease tarball command in the pull request's
  `<!-- bridge-branch-preview -->` comment. Core reads that comment back: `installCommandFromPreviewComment(body)`,
  `readPreviewComment`, `findPreviewComment`, `explorationTryIt` (ready only when the comment's snapshot matches the
  branch head, "building" before, "failed" when the publish failed), `explorationTryItOnGitHub`,
  `explorationShareMessage` and `GitHubClient.listIssueComments`. The draft pull request body no longer guesses a
  command: it points to the comment.

  DS Bridge plugin: the "Sent to <exploration>" screen is for designers. "Try it" lists the previews with the product
  first (the admin demo, by its name in bridge.config.json), then Library and Workbench, one row each with "Open" on the
  same line. "Test build for your product" says whether the build is ready or being prepared (with "Check again"), and
  has one action, "Share with a developer", which copies a ready message with the working command, the previews and the
  pull request. The command itself stays under "Show the command". The bar's primary is "Open in the product" when that
  preview exists, otherwise "Open on GitHub". The Push form drops the "Commit title" disclosure for explorations (the
  title is still generated) and says "Owners review it only if the exploration is promoted."; other Push and Pull
  sentences say "the design system" instead of "main" and drop "commit".

  Studio explorations: the detail reads the install command from the preview comment (or says the test build is being
  prepared); the list no longer shows a guessed pkg.pr.new command.

- 4311efd: Library page headers: "Edit in Studio" becomes a quiet ghost button in the top right corner of the header zone instead of a button next to the title.
- 64fd190: Library: the GitHub link moves from the top bar to the foot of the side nav, where Studio keeps the GitHub account.
- f4ccf4a: Library token drawer: the token name is a plain heading, one summary comes first (a large specimen next to the value
  with copy, where the value comes from on one line with each token clickable, one plain sentence such as "Primitive. 9
  brand tokens point to it, used by 36 components."), then Aliased by, Used by, Contrast and History as collapsed rows
  that share one row component (first 5, then "Show all"), and one "For developers" fold at the bottom (code names, the
  developer note, the files). "Edit in Studio" is the one action, in the footer. Works for every token type.
- 04b0b97: Studio Overview: the greeting drawing grows with the space beside the to-do list and sits on its vertical middle, so the card stays balanced from 1100 px to wide monitors.
- 66cd629: Studio Overview sorts the to-do list by kind of work. "For you" lists only the decisions a designer or design system owner makes in the Studio, ordered by what unblocks the most: review the design of a change (it says when before and after are ready), ship an approved change, decide on a request, review usage guidance. Each button names the task ("Review design", "Ship", "Decide", "Review guidance") and the line under the title says what happens once it is done. Failing tests, a clash with the latest library, a missing release note, drafts, requested changes and the tech review fold into a quiet "Waiting on a developer" line that names the blocker and who is expected, with a link to the change only. The headline counts only what is for you ("2 decisions wait for you.", "Nothing needs you right now.").
- 4f92a1c: Studio Overview greeting is now your to-do list: one row per change or component request that waits for you, with why in plain words and the button for the task on the same row. What waits on someone else folds into one line that opens to name who. Library health moves to a Quality card, open changes are no longer repeated under the greeting, and on wide screens the suggestions stand next to the greeting.
- 196d02b: Real branch preview URLs and install commands everywhere, never guessed ones. On exploration #64
  (`explore/button-normal-again`) Vercel shortened the admin and Storybook aliases with a hash
  (`bridge-admin-git-explore-button-norm-0ed5ba-peterbonos-projects.vercel.app`), so the template URLs were wrong.

  Core: `branchPreviewUrls(client, prNumber | sha, config)` reads what Vercel reports, in order: GitHub deployments of the
  head commit, the Vercel commit statuses (state of each deploy), the Vercel bot comment (`[vc]` header, decoded), and the
  `previews.apps` template only when its host label fits in 63 characters. Pure parts: `parseVercelComment`,
  `findVercelComment`, `appForProject` (Vercel project to app by the template host), `resolveBranchPreviews`,
  `previewLinksOf`, `previewsSettled`. `explorationTestBuildOnGitHub` returns the install command from the preview comment
  and the real previews in one read. `GitHubClient.listCommitStatuses` and `listDeployments`. The sticky PR comment
  (`previewComment`) takes the resolved previews and never prints a shortened template URL. Removed: `explorationInstall`
  and `ExplorationInstall` (guessed pkg.pr.new commands); `StartedExploration.install` becomes `tryIt` and
  `ExplorationSummary.install` is gone (it gains `headSha`).

  Preview packages workflow: the comment's preview table uses the URLs Vercel reports (deployments, statuses, its comment).

  MCP and CLI: `bridge_list_explorations` / `bridge explore list` return the install command from the preview comment
  (`install.state` building, ready or failed) and the previews Vercel reports; `bridge explore start` no longer prints a
  pkg.pr.new command.

  Studio: the pull request detail ("Preview and install") shows the URLs Vercel reports and the command the workflow
  published, or that the test build is being prepared; the exploration detail fills its previews the same way.

  DS Bridge plugin: the exploration result screen ("Try it") shows the real URLs, checks every 15 seconds for up to 10
  minutes while it is open (stopping once the command and every preview are ready), updates in place without
  re-rendering, and keeps "Check again".

- fe29bed: Studio requests nobody is on now end in a decision, not a dead end. The Overview row says "Open request" (no more
  "Triage") and what is expected: "Nobody is on it yet: explore it, assign someone or decline it." On the request, a
  design system owner who is connected gets one row: Start an exploration (opens the Explorations form filled from the
  request, then links the request to it and puts them on it), Assign someone (a DS Combobox of the people who can edit
  the repository, in place) and Decline (a DS Dialog that asks for a reason, says who reads it, posts it and closes the
  request as not planned). Once someone is on it, the row gives way to one sentence ("@ana is on it", "@ana is exploring
  it"); everyone else reads who decides. A request linked to an exploration now counts its draft as the work on it.

  Core: `linkRequestToExplorationOnGitHub`, `assignRequestOnGitHub`, `declineRequestOnGitHub`, the pure
  `withRequestExploration`, `declineComment` and `declineReasonProblems`, `GitHubClient.updateIssue`, `addAssignees` and
  `listCollaborators`, and `requests` in the exploration settings (listed in its draft pull request body).

- 1a4e2c5: Studio review, designer first. A pull request now answers three things at first glance: who acts now ("Waiting for
  the design owner (@x) to approve.", "Your turn: approve the design."), who approved on the design and tech side (one
  row per approval the tier needs, with a check or an empty circle and the action on the row of the role you hold),
  and what it looks like (the biggest before/after from the visual impact, "N screens changed" with a link to all, a
  quiet line while it is prepared or "No visual change", then the token diff). Files, checks, changeset and previews
  move under one collapsed "For developers". In review rows and the Overview Activity rows say who acts now, and the
  Overview greeting lists the changes waiting for you. One pure, tested rule set (`whoActs`, `approvalRows` in
  lib/changes.ts) drives all three.
- 1d16b31: Studio review and history in designer words, with one source for every count. The review queue
  (`reviewQueue` in lib/review-queue.ts) leaves out running explorations and release automation (the changesets
  "Version packages" pull request on changeset-release/\*, opened by github-actions[bot]); the Overview hero, the
  nav badge and the In review tab all count it. In review rows say what approval a change needs in plain words
  ("Design + tech", "One approval", no color), with the same rule as the detail (label or computed from the changed
  files, highest wins, read with the status), and a conflict now blocks before approvals in the list as in the
  detail, with "Checking" until GitHub knows whether a change merges cleanly. "Other branches" becomes a link to
  GitHub inside one "For developers" fold. The change detail says Ship instead of Merge; the owner override and
  Close move into a More menu (DS Menu) with the override rule in one sentence; Conversation shows the count, the
  last word and "Open on GitHub". The Overview hero reads "3 changes wait for design approval. 1 is blocked on the
  developer side." with one GitHub link instead of an "Unblock" card, Activity folds Bridge app updates into one
  labelled row, and an Adoption tile links to Quality (from the audit reports). History opens on a "Next release"
  card built from the release pull request (changes counted, version bumps in plain words, the action for whoever
  holds the ship right), rows read human summaries, and the demo history switch is development only.
- 3f0266a: Studio Settings is redesigned as a settings page: each section is a band with its title and one sentence on the left and its rows in a card on the right, values next to their labels, and the page stops at 1200px. Sections are grouped by meaning: Account (a compact connected row, or the one Harbor zone with a Field Guide drawing while Studio is read only), Review rules (who approves and ships with Edit in the card header, what each change needs as one small table, the owner override as a fold), Safety (protection and the visual before and after, each with its action), Figma and Claude, Integrations, then For developers. The roles summary sentence that repeated the rows is gone, and editing sends the change for review.
- 12ac419: Studio Components, calmer list and drawer.

  List: each thumbnail renders one calm sample of the component (the secondary or neutral look, never the destructive
  one) at one size, and the columns say their facts in words: "Admin demo and Bridge itself", "1 request", "4
  examples", "40 tokens". The token split ("1 own · 39 from Button") leaves the row for the drawer's "For developers".

  Drawer, top to bottom: the family as an eyebrow on the name, one sentence with a link to the Library page, one live
  preview with a Light/Dark switch (it starts on the page theme), the facts in one line ("Used in Admin demo (4
  places). 40 tokens. Usage guidance written. No open request."), a pill only when guidance is missing or waits for a
  review, then one row of actions with a single primary (the guidance while it is missing or in review, else Edit
  tokens) and "Request a change" as the last secondary. Token origins, props, stories, the files folder, Code and the
  component sandbox sit in one "For developers" fold at the bottom.

- d2623a7: Studio Quality and Settings, designer first.

  Quality: a trend sparkline per product from the committed audit history, "102 unused tokens" counted from the
  data instead of "Clean up (2)", and file paths plus the commands CI runs in one "For developers" disclosure. Audit
  pages lead with the gauges, the trend chart and where component instances come from; what was scanned, the file
  tables and the CLI fold under "For developers". The trend chart keeps its axis labels inside the frame.

  Settings: Connection, Roles and Protection, Approvals as plain rules without tier numbers (read from
  docs/GOVERNANCE.md), Figma and Claude (the one `claude mcp add` command with a copy button), Integrations (Jira
  status and setup), then one collapsed "For developers" section with the repository sources, tiers and modes,
  previews, the tier table, MCP details and the Jira workflow. The GitHub dialog says "Change GitHub token" when
  opened while connected.

  Studio shell: the theme toggle moves into the account menu once GitHub is connected (side nav foot until then),
  one less control on every Studio page.

- 1975219: Studio Requests and Explorations, designer first. Requests: a new intro ("Token changes you can make yourself in
  Tokens. Component changes are built by a developer: ask here and follow progress."), a thumbnail per row (the
  request's image, else the component preview) and who is on it (the assignee, or the author of the change that closes
  it, else "Not started"). A request says "Waiting for a developer to pick it up", "In progress by @x" or "Done", shows
  a before and after side by side when it carries a baseline and a Figma image, and keeps the Claude commands under
  "For developers". Explorations: a new intro, no branch names in the list, a start form without branch or pull request
  help (it moves under "For developers"). An exploration opens on its previews (Library, Component sandbox, Admin demo)
  and the before and after against the official library, then the requests built on it; branch, install command and
  CLI move under "For developers". "Promote to review" now confirms in a DS Dialog that says who will be asked to
  approve and what happens next, then says where the change went with a link to it in In review.
- 5647108: Studio shows the theme switch in the top bar again, in the same place as the Library, instead of hiding it in the account menu.
- a6914d7: Studio Tokens and Components, designer first.

  Tokens: the list says "Semantic and foundation tokens" (the base collection reads Foundation in Studio), collections
  and usage filters move under Advanced in Options, swatches are 24px and values read at the UI size, and long names
  wrap at their dots instead of truncating next to the details panel. The details say "Where the value comes from".
  The value popover shows the real components that use the token, light and dark, repainted on every pick. The review
  opens on its visual preview: light and dark side by side, before above after, several components scaled to fill
  their frames; Export JSON moves under "For developers". "Send for review" replaces "Propose change": the dialog says
  who approves from the configured rights ("The design owner and a developer will approve it; nothing ships before
  both."), drafts the title from the edit ("Darker primary action fill") and keeps the branch sentence under "For
  developers".

  Components: each row starts with a thumbnail of the real component, "Stories" reads "Examples", and two columns join:
  open requests per component and "Used in products" (from the committed audit reports). The drawer opens on the
  component live in light and dark; Code, Workbench, props and stories move under "For developers". A request carries
  a Figma link and one image (pasted or picked, committed to the requests branch like the Figma plugin does), Kind
  starts on Visual change, and the button reads "Send request".

  Core: the request kind "Prop change" reads "Option change (prop)" everywhere requests are shown.

- dfa95ed: Textarea gets `appearance="inline"` for editing existing text in place: no border, no resize handle, the surrounding
  font, size and line height, a height that fits the content (`field-sizing: content`, measured without moving the page
  where it is not supported), a fill and hairline on hover and the DS focus ring on focus. Never use it in forms.
  The Library edit mode now uses it instead of restyling Textarea internals.
- ed31d29: Studio follows docs/GOVERNANCE.md for Tier 2: a new component, variant or prop needs a design owner and a tech owner approval, not one approval. The ship gate, In review labels, the promote dialog and the send sentence now say so.
- 7cb1733: Say clearly when the GitHub token stopped working (revoked, regenerated or expired), instead of scattered errors.

  Core: `GitHubError` gains `auth` (`'rejected'` for a 401, `'missing-permission'` for a 403 "Resource not accessible
  by personal access token" or a permission GitHub names in `X-Accepted-GitHub-Permissions`) and `permission`
  (`issues`, `pull_requests`, `contents`...: from the header, else from the endpoint). Rate limits stay rate limits.
  New exports: `classifyAuth`, `requiredPermission`, `isTokenRejected`, `isMissingPermission`,
  `missingPermissionMessage`, `permissionLabel`, `TOKEN_REJECTED_MESSAGE`, `TOKEN_SETTINGS_URL`. A refused token now
  stops an exploration promotion instead of becoming a warning.

  Studio: one session state. Any 401 marks the saved token as stopped working (it is kept, not deleted): the sidebar
  account block shows "Your GitHub token stopped working" with Reconnect (the connect dialog, field focused, saving
  replaces the token), Settings says the same, write actions show that one message, and reads fall back to anonymous.
  A missing permission is named on the action that needs it ("This token cannot create issues. Add Issues: Read and
  write on GitHub.") with a link to the token settings. The token is checked once on load when the last check is older
  than an hour (GET /user, cached with its result).

  DS Bridge plugin: the Settings token row shows "Stopped working" with "Replace token" after a 401; Pull, Push and the
  other GitHub flows show one callout, "Your GitHub token stopped working. Replace it in Settings.", with a button that
  goes there. Access is checked once when the plugin starts. A missing permission is named, with the GitHub link.

- 37dd883: Studio Components: the "Used in" column shows one tag per product instead of a sentence.
- d6c0889: Studio and the admin demo fill wide monitors: pages no longer stop at about 1000 to 1260 px with an empty column on the right. Past about 1800 px of content the page stops growing and sits centred beside the side nav.
- Updated dependencies [80228c0]
- Updated dependencies [adc0df7]
- Updated dependencies [d5bbba9]
- Updated dependencies [3d3d77d]
- Updated dependencies [537abd7]
- Updated dependencies [fb40ae8]
- Updated dependencies [196d02b]
- Updated dependencies [fe29bed]
- Updated dependencies [dd2261c]
- Updated dependencies [a6914d7]
- Updated dependencies [1e78f3b]
- Updated dependencies [dfa95ed]
- Updated dependencies [7cb1733]
  - @bridge-ds/core@0.3.0
  - @bridge-ds/react@1.1.0

## 0.2.0

### Minor Changes

- f103729: Owner override for solo maintainers and small teams. `governance.override` in `bridge.config.json` (`allowed`, `requireReason`, `minReasonLength`; absent by default) lets listed logins merge from Reviews when the only thing missing is approvals. It is never offered while CI fails or runs, when changes are requested, or on a draft. Bridge checks the token has write access, asks for a reason in a confirmation dialog, posts a `**Bridge owner override**` comment with the login, reason and missing approvals, then merges with the method the repo allows. If GitHub refuses, its message is shown and the comment is marked not merged.
- ef596ce: Library foundation pages (Color, Typography, Spacing, Radius and borders, Elevation) open each token group with a
  specimen of the real tokens in context, light and dark side by side, then a light list: dual swatch, the token name
  once, a one-line role, a muted alias line and a neutral usage chip. A page-level "Copy as" switch (CSS, JS, Figma)
  sets what a click on a name copies, and a row opens the token explorer's detail panel in read mode. Usage comes from
  the shared `tokenUsage()` definition, so the page background no longer reads as unused. Links in the app chrome are
  ink with a quiet underline; orange stays the signal for focus and the current place.
- 5c40693: New brands, from every surface. `planNewBrand` in `@bridge-ds/core` builds a brand file (primary and neutral ramps from the shared ramp engine, the starting brand's radius, fonts and theme overrides), adds the slug to `modes.brand` in `bridge.config.json`, and runs the contrast gate for the new brand in light and dark. The CLI gets `bridge brand create` and `bridge brand list`, the MCP server `bridge_list_brands`, `bridge_plan_brand` and `bridge_propose_brand`, the Figma plugin offers a new Brand mode as a new brand on Push, and the Studio has a four-step New brand flow with a live preview. The token build reads its brands from `bridge.config.json`, and `scripts/ramps.mjs` runs the same ramp engine (primitives unchanged).
- fdd4fc3: Studio reads as one app: compact page headers with no hero or lede, GitHub status only in the global header (connect button, or your login with repository, access and disconnect), a Drafts counter in the header that opens the draft as a side sheet, and the token explorer full bleed with one toolbar row (search, Filters, Modes, View, New token) and compact 40px rows. Overview starts with a KPI strip and a "Needs you" list whose status chips come from real CI, reviews and the merge gate, so a pull request with failing CI never reads "Ready". The Library is unchanged. Change titles read as text, with inline code rendered as code instead of raw backticks. Without a GitHub token, Overview and Reviews read the open list once and the live status of the 3 most recent pull requests, cached for 10 minutes per commit; other rows say "Status unknown" until you connect. New token and cell edits work without GitHub as drafts in this browser; only Propose, approve, merge and revert need a connection.
- 8c08d95: Studio Changes: one page with two views. In review lists the open pull requests most urgent first (blocked, then waiting for approval, then ready) under a Harbor opener with one status sentence and one action, the local draft as a strip, and branches without a pull request collapsed at the bottom. When GitHub cannot be read, the last list stays on screen "as of" its time, and the nav count keeps the last known number. A pull request opens in place with one sentence on its state, one primary action (open the failing run, connect GitHub, approve or merge) and collapsed sections with counts; the merge, approval and owner override rules are unchanged. History groups merged token changes by release, folds imports into one line, keeps filters behind a Filter button, and undo opens a side panel with one sentence and one primary. Color now means status only: red blocked, violet waiting for approval, green ready, grey otherwise; risk tiers are grey labels. Drafts, Branches, Reviews, Versions and Visual impact redirect to the right view. The Studio header switches to the Library, and the GitHub account moves to the bottom of the Studio nav.
- fb8a737: Component change requests in Studio: a Requests view in Changes (status, linked pull request, Jira key, a detail with "Implement with Claude"), "Request a change" in the Components drawer, an Integrations section in Settings that proposes Jira settings as a pull request, a line on the Overview when requests wait, and a "Component change requests" section in How review works.
- 525217f: Studio Changes gets an Explorations view: draft pull requests labeled `exploration` on `explore/<slug>` branches, summary first ("2 explorations running."), each with its purpose, author, previews, the snapshot install command to copy for a product staging branch and the requests filed on it. "Start an exploration" creates the branch from main with an exploration note and the draft pull request (or shows the `bridge explore start` command without GitHub). The detail opens in place (?exploration=N) with Promote to review (tier labels from the shared classifier, label removed, ready for review) and Close. Running explorations leave the In review list, show "Exploration (not mergeable)" in place of a tier, and never pass the merge gate, owner override included. How review works explains explorations.
- d66a923: Studio Settings is one page with three sections: Connection, Repository, Approvals. Connection opens with one sentence and one action for the GitHub state (Connect GitHub, or Change token once connected), then the Figma plugin and the MCP server as two plain rows. Repository says in one sentence which repository, branch and build it reads, shows Source at rest and folds tiers, modes, owners and previews behind counts; values share one mono style and the default mode reads "(default)" in plain text. Approvals is a compact "Who approves what" table, one row per tier with a grey label that opens Changes filtered to that tier (new ?tier= filter on In review), plus the owner override in one line. The governance prose moved to a new Library page under Use, How review works, with collapsible sections, linked from Approvals and from each pull request. The old Repository, Governance and Integrations URLs redirect to the matching section.

### Patch Changes

- 34b8e1d: Accessibility page, summary first: one status sentence from the contrast gate ("All 296 contrast checks pass across 2 brands and 2 themes", or how many fail and the first failing pair), then the gated pairs grouped by use (text, buttons and controls, UI and borders, focus, feedback, charts) for one brand and theme at a time. Each row shows a live sample, the pair, the ratio and one status (AAA, AA or "Fails, needs 4.5") and opens the token details. "Compare all 4" shows every brand and theme side by side, one at a time on phones. The method moves under "How we check". The wide "All pairs" table is gone.
- 53a02c4: All tokens fills the page, the side panel follows the filter, one Value column when light and dark match, dimension rows show a bar at their real size; wider gutter before the On this page rail.
- a55525d: Bridge brand moves to the "Field Guide" direction: white content, ink text, Harbor zones and Deep Harbor as the one strong color, Fraunces headings over Instrument Sans text, rounder radii. See `docs/DESIGN-LANGUAGE.md` (v2).

  Why this is major for `@bridge-ds/tokens`: the default brand changes what existing tokens resolve to, and consumers must check their screens.

  - Palette roles re-pointed in the bridge brand: `palette.neutral` from steel to the new `color.ink` ramp; `palette.primary`, `palette.accent` and `palette.link` to the new `color.harbor` ramp; `palette.info` from cable to plum. Orange is now only the categorical chart hue (`palette.categorical`).
  - `color.bg.default` is white (`palette.neutral.0`) in bridge light. Ocean keeps its tinted canvas, links and zone through `brands/ocean.light.tokens.json`.
  - Primary action and checked controls move to `primary.700` (hover 800, active 900); links to `link.700` (hover 800); `color.signal.default` to `accent.600`; `focus.ring.color` to `accent.700`. Dark: actions and checked controls use `primary.300/200/100` with `primary.950` text.
  - `font.family.sans` is Instrument Sans in bridge (was IBM Plex Sans).
  - Radius roles in bridge: inset 6, control 12, container 20, overlay 20 (were 2, 6, 10, 14). Primitive `radius.xl` is 12 (was 14).
  - Primitive `font.size` steps changed: `300` 17 to 16, `400` 20 to 21, `600` 29 to 30, `700` 35 to 36, `800` 42 to 44, `1000` 60 to 64.
  - `control.height.md` is 44 in comfortable density (was 40) and 36 in compact (was 32).

  Additions: `color.bg.zone` (Harbor blocks, light `primary.200`, dark `primary.900`, ocean light `primary.50`), `font.family.display` (Fraunces in bridge, Plex Sans in ocean), `font.family.fraunces`, `font.family.instrument-sans`, `typography.<display|h1|h2|h3|body|ui|caption>.{size,line-height,weight,family,tracking}` in both brands, `font.leading.{16,20,26,28,32,38,50,68}`, `size.11` (44px), and the `color.ink.*` and `color.harbor.*` ramps with pinned brand anchors (ink 200 `#E3E8EE`, 600 `#5B6672`, 900 `#15202B`; harbor 200 `#CFE8FF`, 700 `#0B4A8B`). `contrast.checks.json` gains 5 pairs on `color.bg.zone` (296 checks, 0 failing). Fixes a missing `$type` on `color.bg.zone` in the semantic light and dark files.

  `@bridge-ds/react`: no API change, but every component's rendered look changes through the tokens (colors, fonts, radii, 44px default controls). PageHeader, Card, Dialog and Drawer titles read the new `typography.*` roles; medium Badges set at 14/20 (the `ui` role), small Badges stay 12/16.

  `@bridge-ds/docs-site`: the Bridge site wears the Field Guide brand. Top bar of five items, a short side nav (no headings, no counts, collapsible groups), Harbor header blocks on Library section pages, new Library home and Studio overview, version chip by the page title, branch picker by the Studio title, brand and density in the preview toolbars. The theme playground is removed; `/playground/` redirects to the Library home. `.stylelintrc.json` accepts `var(--typography-<role>-family)` for `font-family`.

  `@bridge-ds/core`, `@bridge-ds/cli`, `@bridge-ds/mcp`, `@bridge-ds/eslint-plugin`, `@bridge-ds/stylelint-plugin`, `@bridge-ds/figma-plugin`: test expectations and fixtures follow the new token values (ink chains, white canvas, the ocean overrides, 296 contrast checks). No behavior change.

- 061deb5: Studio Components, "Edit tokens" now opens Studio Tokens on `?component=<slug>`: exactly the tokens that component's CSS module reads, across every collection, with a removable "Used by IconButton" chip in the chip row. The Tokens column, the Library component cards and the component page count the same set, so the link never lands on "No token matches". Components that read no token get no link.
- a914c38: Component pages: the On this page rail sits on the right from the top of the page (from 1320px) instead of inside the reading column, and the Skeleton preview shows an avatar, two lines and a block.
- f7e861c: Studio Components: one family menu instead of nine chips (17 interactive elements on the first screen).
- e2c7742: Click targets: token rows (name, copy, menu, uses chip), the Studio row menu, the logo link, changelog refs and Quality actions are at least 32px tall; standalone links at least 24px. The Preview brand switch hides when the repo has a single brand.
- 7f8972e: Library: home "What changed" lists short headlines with their kind on the full content width, the footer spans wide pages, reading pages get the "On this page" rail again from 1320px, and the Preview brand and density switches use the DS control height (44px).
- 558c78d: The Library is the site, the Studio is a space. No more Library | Studio switch: the Library header keeps logo, centered search, theme, GitHub and a quiet "Open Studio" (with the avatar in one pill when signed in); the Studio has its own "Bridge Studio" header on a soft ground and a "Library, view published library" box at the bottom of its nav. The Library nav is Home, Foundations (with All tokens), Components and Use; the one nav count is the reviews waiting, on Changes. "Edit in Studio" and "View source" show only for a GitHub token with write access. New page meta line and site footer.

  All tokens (`/tokens/`) becomes a read-only reference: filter, type chips with counts, light and dark values, copy on hover and a side panel per token. `?t=` deep links still work.

  Studio Tokens edits through one anchored popover per cell (palette families, a swatch ramp, one contrast line, more options folded), a slim "N changes · Review" bar, and a review sheet with before and after per mode, contrast, usage and a preview of real components. The full editor modal is removed; the detail drawer is read-only with one Edit. The explorer keeps to four font sizes.

  Home "What changed" and Studio activity show one-line titles.

- 75a6174: Studio Tokens: a page header and one toolbar row (filter field "Filter N tokens", type chips with counts, one Options menu for collections, usage, brand and modes, columns and exact match, then New token), and the table at full width with Name, Light and Dark. The collections tree and the Filters, Modes and View menus are gone; Semantic and Base are the default scope. The swatch name in the value editor shows under the ramp, never over the family tabs. "Used by" counts global stylesheets apart from components ("1 global style (base.css)") in the details and the review sheet. All tokens: "Copy variable" copies `var(--name)`. Library foundation pages: no page toolbar; each row has a copy button (CSS variable by default, JS or Figma name from its menu, last choice remembered) and the brand or density switch sits in the header of the specimens it changes.
- 1b1a272: AGENTS.md: a UI quality bar every screen and feature is checked against.
- Updated dependencies [e31bac2]
- Updated dependencies [5b9d677]
- Updated dependencies [3e59115]
- Updated dependencies [e54d2a1]
- Updated dependencies [bac1cb2]
- Updated dependencies
- Updated dependencies [a55525d]
- Updated dependencies [f103729]
- Updated dependencies [b6cb68a]
- Updated dependencies [8180108]
- Updated dependencies [8ec801a]
- Updated dependencies [e8fd4a8]
- Updated dependencies [b6cb68a]
- Updated dependencies [7d3f7cd]
- Updated dependencies [acd1273]
- Updated dependencies [b0da5ed]
- Updated dependencies [b6cb68a]
- Updated dependencies [cd5565e]
- Updated dependencies [95db484]
- Updated dependencies [cf3f5bb]
- Updated dependencies [abe4395]
- Updated dependencies [7261f47]
- Updated dependencies [a6a3a46]
- Updated dependencies [d5d263b]
- Updated dependencies [c66908c]
- Updated dependencies [73b1a6f]
- Updated dependencies [84e1383]
- Updated dependencies [6cd9c3a]
- Updated dependencies [525217f]
- Updated dependencies [e47f4a6]
- Updated dependencies [1f29f63]
- Updated dependencies [5c40693]
- Updated dependencies [fd83606]
- Updated dependencies [019a220]
- Updated dependencies [a0142d2]
- Updated dependencies [cf3f5bb]
- Updated dependencies [7261f47]
- Updated dependencies [36cb504]
- Updated dependencies [2c79d5d]
- Updated dependencies [fd83606]
- Updated dependencies [937bd43]
- Updated dependencies [a914c38]
- Updated dependencies [0cab1bb]
  - @bridge-ds/core@0.2.0
  - @bridge-ds/tokens@1.0.0
  - @bridge-ds/react@1.0.0
