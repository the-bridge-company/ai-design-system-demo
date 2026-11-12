# Two reviews: the library decision and the design review

Status: design, phase 1 (no code yet). Owner approved the direction on 2026-11-12.

## The problem

Bridge puts two different reviews under one "In review" that waits on "the design lead":

1. **The library decision.** Keep or not a new value, variant or component in the design system. The design system
   owners decide, for every product at once.
2. **The design review.** Someone checks a product screen before the developers build it. Usually that product's
   design lead. Optional: many teams skip it.

On the sample team Dana holds both hats, so every exploration lands on her and nothing says which hat she wears. Leo's
"Deal pipeline cards" has nothing new for the library ("Leo's screen uses Compact (12 px), already in the library.
Nothing to decide.") yet Leo reads "Dana decides what the library keeps", and the block header says "1 change" next to
"Nothing to decide". In real teams the product design lead is often not a design system owner.

## The rules

**Two roles, set in Settings > Reviews.**

| Role | Scope | Who, usually | Can be off |
| --- | --- | --- | --- |
| Decides what the library keeps | The whole team (one library) | Design system owners | No |
| Reviews the design before developers | Each product | The product's design lead | Yes, per product |

**When a designer says Done exploring**, Bridge looks at two things:

- **Something new for the library?** The pieces the designer ticked that the library does not have (a new token value,
  a variant, a size, a restyle, a new component; `library-impact.ts` `impactItems`, minus the ones that use the library
  as it is). If there is at least one: a **library decision**, asked to the library owners.
- **Does the product have a design review?** If it is on and someone other than the author can give it: a
  **design review**, asked to that product's reviewers.

Both start at the same time and never wait on each other. The exploration is **Ready to build** once:

- the design review said Looks right (or there was none), and
- every new piece has a library answer: Add to the library, Keep in the screen only, or Use an existing piece instead.

If neither review applies, Done exploring goes **straight to Ready to build**.

**What each answer does.**

- Design review, Needs changes: back to **Exploring**. Library answers already given stay; Done exploring again does not
  re-ask them (as today with library pieces on Take it back).
- Library, Ask for changes on a piece: back to **Exploring**, the design review answer stays unless the screen changes.
- Library, Add to the library: the piece becomes a library request (as today). The screen can be Ready to build; its
  second line then reads "Waiting for the library: Timeline" until the library request ships (existing `neededBy`).
- Library, Keep in the screen only: the developers build it inside the product (as today).

**One status ladder, the reason as the second line.** No new status. "In review" always comes with who and why:

| Case | Status | Second line (others) | Second line (the person holding the hat) |
| --- | --- | --- | --- |
| Both waiting | In review | Waiting for Dana's design review and the library decision on Timeline | Waiting for your design review and your library decision on Timeline |
| Design review only | In review | Waiting for Dana's design review | Waiting for your design review |
| Library only | In review | Waiting for the library decision on Timeline | Waiting for your library decision on Timeline |
| Design review done, library waits | In review | Waiting for the library decision on Timeline | (same, with "your") |
| Nothing to review | Ready to build | No review needed: nothing new for the library, and Acme CRM has no design review | (same) |

Several library owners: "the library decision" (no name); one owner: "Dana's library decision". Several design
reviewers: the one who took it ("I'll look") if any, else "the design review" plus the product name.

**Library impact block.** When nothing is new: title "Nothing new for the library", no count, one line listing what the
screen uses as it is. When something is new: the count names new pieces only ("1 new piece"); pieces used as they are
fold into the "Everything else comes from the library" line, never a row that says "Nothing to decide".

**Each step shows its hat.** The design review card says "Your turn: design review", "You review the screen as Acme
Prints design lead". The library decision sits on the piece's row ("Library decision. You decide as design system
owner, apart from the screen") with the same two buttons as Library review: Keep in Sofia's screen, Add to the library.
The author's card lists both reviews as two current steps of one Stepper.

**Queues.** Home rows name the hat: "Sofia's screen: your design review and a library decision", "Leo's screen: your
design review", "Library decision on guidance Claude AI drafted". Library review lists library decisions only and says
so: "12 library decisions wait for you, as design system owner", "Screens waiting for your design review are in
Explorations, not here." The Explorations count in the sidebar counts design reviews.

**Unchanged.** Nobody reviews their own exploration. An admin may answer either review but is never asked. The product
manager's view stays optional and apart from both. Token values pushed from Figma stay design approved. GitHub reviews on
the developers' pull request stay the last word on code.

## Mocks

Real Studio CSS and DS components on the prod sample team (`?as=`), text changed in the page, 1389 by 868 at 2x:

1. `01-settings-reviews.png`: Settings > Reviews, "The library" (Decides what the library keeps: Dana) and "Design
   review before developers" (Acme Prints: Dana, Acme CRM: Dana, Library: No design review).
2. `02-exploration-library-and-design-review.png`, `02b-...-library.png`: Sofia's Order fulfilment timeline seen by
   Dana: both hats, the library decision on the Timeline row. `02c-...-author.png`: the same seen by Sofia.
3. `03-exploration-design-review-only.png`, `03b-...-library.png`: Leo's Deal pipeline cards seen by Leo, "Waiting for
   Dana's design review", "Nothing new for the library".
4. `04-exploration-nothing-to-review-ready-to-build.png`: the same screen if Acme CRM had no design review.
5. `05-home-dana-queue.png`: Dana's Home rows.
6. `06-library-review-library-decisions-only.png`: Library review, library decisions only, Timeline open.

## Data model

**`bridge.config.json` (GitHub people).**

- `governance.owners.design` keeps its meaning and becomes, in words, "Decides what the library keeps". No rename: it
  already gates Tier 2 and 3 library pull requests.
- New, optional, per product: `products[].designReview`: `false` (off) or `{ "reviewers": ["login", ...] }`. Absent
  reads as the team default below. The schema (`bridge.config.schema.json`) and `core/config.ts` gain it; it is a
  guardrail file, so changing it is a reviewed change, as today.

**Server (email members, `api/_lib`).**

- `EmailMember.lead` splits in two: `libraryOwner: boolean` (decides what the library keeps) and nothing else on the
  member; design reviewers live per product.
- New key `bridge:design-review:<repo>`: `{ [productKey]: { on: boolean, reviewers: string[] | "any-designer" } }`.
  `"any-designer"` is today's "Shared, with review": every designer reviews the others' screens.
- `review-mode.ts` (`one | shared | shared-none`) is read once for the migration, then retired. `askedToReview`,
  `decidesOnExplorations` and `needsReview` become `asksLibrary(member)`, `asksDesignReview(member, product)` and
  `reviewsFor(exploration) -> { design: Reviewer[] | null, library: Reviewer[] | null }`.

**Exploration block (`core/explorations.ts`).**

- The `lead*` ask fields become the design review ask: `designAskedAt`, `designAskedTo`, `designTakenBy`, ... Old fields
  are read as the design review (same pattern as `leadNote` and `decisionsOf`), written in the new names on the next
  write.
- `library` (`ExplorationLibrary`) gains `askedAt` and `askedTo` (the owners asked) next to the per piece decisions it
  already holds.
- `Decision` gains `hat: 'design' | 'library'`; old decisions read as `design`.

**Core logic.**

- `status-ladder.ts`: a pure `waitingFor(x, viewer)` returns the second line from the table above. `STEP_LABEL` and the
  ladder are unchanged; the "In review" comment drops "the design lead".
- `library-impact.ts` / `library-impact-view.ts`: `state: 'nothing'` renders "Nothing new for the library" with no
  count; the count counts new pieces only.
- `exploration-done-github.ts`: `doneExploringOnGitHub` asks both reviews in parallel; `leadApproveOnGitHub` becomes
  `designApproveOnGitHub` and no longer approves pieces (they are answered on their own); "Ready to build" is written
  when both are settled, by whichever answer comes last.

## MCP and CLI

- `bridge_promote_exploration` (Done exploring): the result says which reviews were asked and to whom:
  `reviews: { design: { reviewers } | null, library: { owners, pieces } | null }`, plus `status` and `waitingFor` (the
  second line). With neither, `status: "ready-to-build"`. Its description drops "where the team names a design lead it
  waits for them".
- `bridge_continue_exploration`: `leadWords` becomes `designReviewWords` (old name kept as an alias for a while), plus
  the library answer per piece, so Claude tells the designer which hat said what.
- `bridge_list_explorations`, `bridge_get_review`, `bridge_list_reviews`: each item carries `waitingFor`.
- `bridge_what_needs_me`: each item carries `hat: "design-review" | "library"`.
- `bridge_get_settings` / `bridge_get_config`: both roles, and the design reviewers per product.
- Server instructions (`mcp/src/server.ts`): one sentence on the two reviews instead of "waits for the design lead".
- CLI `bridge explore done` and `bridge explore list`: same `waitingFor` words.

## Edge cases

- **The author is the product's only design reviewer** (Dana explores in Acme Prints): no design review, the second
  line says so ("No design review: Dana is Acme Prints' only reviewer"). The library decision still applies.
- **The author is the only library owner**: as today on GitHub (`soloOwnerCanApproveBoth`); in Bridge, a library decision
  needs someone else when there is someone else, else the owner decides and it is recorded.
- **Pieces added after the design review said Looks right**: Done exploring again asks only the library decision.
- **A push after the design reviewer was asked**: unchanged (the bar says it changed, the decision records its commit).
  A push that adds a new piece adds a library decision; it does not reset the design review.
- **Two explorations change the same part of a component differently**: a library conflict, answered once for both
  (unchanged), never part of the design review.
- **Explorations in the Library itself** (`products[].key = library`): design review off by default; the library
  decision is the only review.
- **Design review switched off while explorations wait**: those waiting only on it go to Ready to build, with an
  activity line "Design review turned off by Dana". Switched on: nothing already Ready to build goes back.
- **Reviewer removed from the team**: their asks go to the other reviewers; with none left, the admin is told on Home.

## Migration (nothing silently skips review)

Run once per team, at deploy, idempotent:

| Before | Library owners | Design review |
| --- | --- | --- |
| `one`, with design leads or design owners | leads + `governance.owners.design` | ON for every product, reviewers = the leads (else the design owners) |
| `shared` | leads + design owners, else every designer | ON for every product, `any-designer` |
| `shared-none` | leads + design owners, else every designer | OFF (the team chose no review); library decisions still asked |
| Nobody else to ask (solo team) | the owner | OFF, as today |

Explorations already In review keep waiting; their second line is computed with the new rules. One that waited only on
the lead and has nothing new keeps waiting on the design review (ON after migration), now named as such. Settings shows a
one time note: "Reviews now have two parts. Check who reviews each product's design."

## Open questions

1. Should Ready to build wait for the library decision, or may the developers start on the screen while a piece is
   still undecided (building it locally first)? The mocks wait for both.
2. Design reviewers per product: one person, a list (any of them), or "any designer but the author"? The mock shows one
   Select per product; a list needs a multi select.
3. Is the design review per product enough, or do teams want it per kind of change (new screens only)?
4. Library owners in Bridge: keep them equal to GitHub design owners plus email members marked owner, or one list
   edited in Settings that writes `governance.owners.design`?
5. Do we keep the old names (`bridge_promote_exploration`, `leadWords`) as aliases for one release or longer?
6. Where does "Shared, no review" go for teams that picked it: design review OFF everywhere (proposed), or ON with a
   one time prompt?
7. Home: when Dana holds both hats on one exploration, one row with both (mock) or two rows, one per hat?

Seen while mocking, not part of this change: on the prod sample team Library review's subtitle can read "11 wait for you"
while the list and the sidebar say 12.
