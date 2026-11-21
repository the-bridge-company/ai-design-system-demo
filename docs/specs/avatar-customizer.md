# Your face: an optional drawn-avatar customizer

Status: draft for the founder's review. Product spec only, no production code.
Mock: [avatar-customizer-mock.html](avatar-customizer-mock.html) (desktop only; phone after validation).
Screenshots: [avatar-customizer/](avatar-customizer/) at 1389x868, device scale 2.

## 1. Problem

Everyone in Bridge without a photo gets a drawn face: a Field Guide line drawing on a Harbor circle, generated from a
seed (`@bridge-ds/react/avatar-illustrated`, DiceBear Notionists, framed on the face). The seed is the GitHub login, or
`~name` for someone Bridge knows by name only (`lib/people.ts nameFace`). The same seed always gives the same face, on
every surface (`components/ds/studio/faces.tsx Who`).

Two things go wrong today:

1. **Two people can look alike.** A seed is random with respect to the team. Tonight Malik's login drew long dark hair
   close to Dana's, and the fix was a hand-written exception (`lib/cast-faces.ts FACE_DRAWING_SEEDS`,
   `acme-malik -> malik-7`). That does not scale past the sample team: a real team has no one to write the exception.
2. **Nobody chose their face.** A drawing that stands for you next to every review you ask for and every change you
   keep should feel like yours. Today it is whatever the hash gave you.

## 2. Who

| Person | Photo today | What they need |
| --- | --- | --- |
| Designer signed in by email | None: always drawn (`~name`) | The main audience. A face that feels like theirs, never a teammate's. |
| Developer signed in with GitHub, with a photo | GitHub photo | Nothing by default: the photo wins. A drawn face only if they ask for one (phase 3). |
| Developer with GitHub's generated pattern (no photo) | Drawn (Bridge detects the identicon, `scripts/github-photo`) | Same as the designer. |
| PM, lead, reviewer | Usually drawn | Tell people apart at a glance in review rows (20 to 24px). |
| Lead or admin | Any | Never has to arbitrate who looks like whom: Bridge keeps faces apart by itself. |

## 3. Goals and non-goals

Goals

- G1. In a team, no two drawn faces are the same at the size people actually see them (20 to 24px).
- G2. Anyone with a drawn face can change it in a few seconds with one Shuffle, and pick parts if they care.
- G3. One face per person everywhere: rows, avatars groups, the account menu, the Figma plugin, emails.
- G4. Quiet by default. The setting is one row; the editor opens only on demand.
- G5. Stays inside the brand: Field Guide line, Harbor surface, AA, recognisable at 20px.

Non-goals (v1)

- Uploading a photo. GitHub stays the photo source.
- Free drawing, colours on the lines, custom background tints (see Open questions, Q3).
- Body, hands, gestures or body icons: the face framing drops them on purpose (they are noise at 20px).
- Faces for Claude: the agent keeps its own mark (Avatar `kind="agent"`).
- A mobile layout (designed after the desktop is validated).

## 4. User stories

1. As a designer, I want to shuffle my drawn face until it feels like me, so my team recognises my work.
2. As a designer, I want Shuffle to never give me a face a teammate already wears, so I do not have to check.
3. As someone who cares, I want to pick my hair, glasses and beard, and see which styles are taken and by whom.
4. As a reviewer, I want every person in a review row to look different at 20px.
5. As a new member, I want a face that is already distinct from the team's on day one, without doing anything.
6. As a member of two teams, I want one face, and Bridge to keep it distinct in both.
7. As someone with a GitHub photo, I want my photo to keep showing unless I choose otherwise.
8. As a keyboard or screen reader user, I want to shuffle, pick and save without a mouse, and hear what changed.

## 5. The flow, step by step (progressive disclosure)

**Where it lives.** Settings > You, as the first band ("Your face"), above Appearance and Your AI tools. Settings > You is
already where personal choices live, and the AI tools setting already proves the storage path (kept with the Bridge
account, else in this browser). **Shortcut:** the account menu gets one item, "Change your face", with the person's
face as its icon; it opens Settings > You with the row already open.

| Step | What the person sees | Disclosure level |
| --- | --- | --- |
| 1. Collapsed row | Band "Your face", one sentence ("How your team sees you next to your work, in every team you are in."), a card with one row: label "Drawn face", help "Made from your name. No photo needed.", the face at 40px, and **Change** on the same line. | Level 0: one row, one action |
| 2. Open | The row opens in place (no dialog, no page). Left column help becomes "Shuffle until it feels like you. Nobody in Acme Design gets the same face." Value column: the face at 80px, and to its right **Next to your team**: you and every teammate at 24px with first names, the size of a review row. Under it **Shuffle** and a quiet **Pick the parts yourself**. Save face (primary, disabled until something changed) and Cancel close the row. | Level 1: one decision, Shuffle |
| 3. Shuffle | The face riffles through three faces in 300ms, like the pages of a field guide, and settles on a new one. Shuffle never draws a hair style a teammate wears, nor its 20px look-alike. A polite live region says "New face: short curls, round glasses." | Level 1 |
| 4. Pick the parts | Contained Tabs: Hair, Glasses, Beard, Expression. Hair shows 16 styles first, each drawn on *your* face; a style a teammate wears is greyed, captioned with their first name, and its tooltip says "Taken by Sofia". One line says the rule once: "Styles a teammate wears are taken." "Show all 64 styles" opens the rest. | Level 2: on demand |
| 5. Save | Save face closes the row; the new face is at 40px with "Saved. Your team sees your new face." on the same line. Every surface uses it on the next render. | Back to level 0 |
| 6. Cancel | Closes the row; nothing changed. Esc does the same while focus is inside the row. | Back to level 0 |

The person with a GitHub photo sees the same row with the label "Photo", help "From GitHub. It shows instead of a
drawing.", and no Change in v1 (phase 3 adds "Use a drawn face instead").

## 6. The randomise rule: uniqueness across a team

### 6.1 What "the same face" means (measured, not guessed)

A face has nine parts in the Notionists style. We rendered every variant of each part on a fixed face at 20px (the xs
Avatar, Harbor circle) and measured how much the drawing changes (mean pixel distance between variants, 0 to 1):

| Part | Variants | Change at 20px | Readable at 20px? |
| --- | --- | --- | --- |
| Hair (with hat) | 64 | 0.064 | Yes: it carries the silhouette |
| Body (collar) | 25 | 0.039 | Partly: the shirt line at the bottom of the circle |
| Beard | 12 + none | 0.007 | Barely |
| Glasses | 11 + none | 0.007 | Barely |
| Lips | 30 | 0.002 | No |
| Brows | 13 | 0.001 | No |
| Nose | 20 | 0.001 | No |
| Eyes | 5 | 0.001 | No |

So at the sizes people see, **identity is the hair**, helped by beard and glasses; eyes, nose, lips and brows only read
from 40px up. We also learned a limit: whole-face pixel distance does not match what people see. Dana against the old
Malik drawing (the pair the founder judged too close) measures 0.130, farther apart than Dana and Ann (0.107). A pixel
threshold alone would have missed tonight's problem, so the rule below is structural, with the measurement as a guard.

**Definition.** Two faces are *the same* in a team when they share the same hair style. Two faces are *look-alikes* when
their hair styles are on the look-alike list: hair-only drawings closer than 0.02 at 20px (45 pairs out of 2,016 today,
for example variant21 with variant26, 27, 32, 35, 53), reviewed once by a designer, and kept in code next to the face
module so it is versioned and testable.

### 6.2 The rule

1. **Hard rule:** within one team, a hair style is worn by one person. Save is refused for a taken style (server check,
   409 `face_taken` naming who).
2. **Soft rule:** Shuffle and Bridge's own picks avoid look-alikes of taken styles. A person may still pick a look-alike
   by hand; the editor does not block it (v1 shows no warning; see Q5).
3. **Overflow (teams over 64 drawn faces):** once every hair style is taken, a style may repeat only with a different
   accessory signature (glasses yes or no, beard yes or no), which gives 64 x 4 = 256 distinct faces at 20px, then
   any differing glasses or beard variant: 64 x 12 x 13 = 9,984. Bridge's largest teams today are far below 64.

### 6.3 Combinatorics

- All parts: 64 hair x 5 eyes x 13 brows x 20 noses x 30 lips x 12 glasses (11 + none) x 13 beards (12 + none) x 25
  bodies = 9.7 billion faces. Uniqueness is never about running out of faces.
- Distinct at 20px under the hard rule: 64 people per team (hair alone), 256 with the accessory signature, 9,984 with
  every glasses and beard variant.
- Shuffle space for a 5-person team: 64 styles minus 4 taken minus their 5 look-alikes leaves 55 hair
  styles, times every other part: still billions of faces.

### 6.4 When someone joins, changes or leaves

- **Joining with no saved face** (most people): Bridge draws their seed as today. If the seed's hair is taken or a
  look-alike in that team, Bridge tries `seed#1`, `seed#2` and so on until it is free, and stores that drawing seed for
  the team. This is `FACE_DRAWING_SEEDS` generalised and automatic: nobody writes an exception again.
- **Joining with a saved face** that is taken in the new team: first claim wins. The person already in the team keeps
  their face. The newcomer is drawn, in that team only, with the nearest free hair style in the same family, and sees a
  quiet line in Settings > You: "Your face looks like Leo's in Acme Design. Shuffle for one that works in all your
  teams." Shuffle then avoids the taken styles of **every** team the person is in.
- **Changing:** the new face is checked against each of their teams at save. The old face is freed at once.
- **Leaving or deleting the account:** the face is freed. "A former member" keeps the neutral drawing it has today.
- **Race:** two people saving the same free style at once: the second save gets 409 with the name and the editor
  offers Shuffle. No silent overwrite.

## 7. What can be tweaked, and what cannot

Tweakable (v1): hair (64 styles, including the hat), glasses (none + 11), beard (none + 12), expression (4 presets
that set eyes, brows and lips together: Calm, Smile, Curious, Focused). Nose and body come with Shuffle only: they are
not worth a picker. The expression tab says what we measured: "Shows from 40px up: in rows your hair does the talking."

Not tweakable, ever:

- The Field Guide style: one line weight, black line, no fills beyond the drawing's own, the face framing (scale 125,
  translate 12, no hands, no body icons).
- The surface: `--avatar-illustrated-bg` (`color.illustration.surface`, Harbor 200 in light, Harbor 300 in dark).
  Black line on Harbor 200 is well above 3:1 for a graphical object (WCAG 1.4.11).
- Recognisable at 20px: no part may be added that only reads at 80px and changes nothing in rows.
- No text, letters, emoji or logos inside a face.

## 8. Persistence

**The recipe.** A face is a small object of part names, not an image:
`{ v: 1, hair, eyes, brows, nose, lips, body, glasses: string | null, beard: string | null }`. The SVG is drawn on the
client from it, exactly as today from a seed.

**Where it is stored** (following `scripts/ai-tools.ts`, which already keeps a personal choice this way):

| Who | Stored | Seen by the team |
| --- | --- | --- |
| Bridge account (email or GitHub sign-in) | `Account.face` on the account record (`api/_lib/account.ts`), written by `POST /api/account { action: 'face', face }`. This browser keeps a copy for the first paint. | Yes, through the team face map below |
| GitHub session without a Bridge account, self-hosted Studio, signed out | This browser only (`bridge.face`) | No: only on this screen. The row says "Sign in to show it to your team." |
| Sample team (`?as=dana`) | This browser only, like every sample-team edit (the banner says so) | The cast stays as drawn for everyone else |

**The team face map.** Every surface draws a person from a face seed (login or `~name`), often without knowing their
account. So on save, Bridge also writes, for each team the person is in, `bridge:team:faces:<repo>` (a Redis hash,
`faceSeed -> recipe`), and the team read (`api/_lib/team-read.ts`) returns it with the members. The client resolver in
`lib/cast-faces.ts` becomes `drawFace(seed) = teamFaces[seed] ?? drawingSeed(seed)`: one function every surface already
goes through, so "one face everywhere" needs no surface-by-surface work. The same map holds the automatic `seed#n`
picks of section 6.4. The uniqueness check reads this map.

## 9. One face everywhere, and photo versus drawing

Precedence, highest first:

1. Claude: the agent mark, always.
2. A real photo (GitHub avatar that is not the generated identicon).
3. The saved drawn face (team face map).
4. The automatic distinct drawing (`seed#n` from section 6.4).
5. The seed drawing (today's behaviour).

Surfaces: Studio rows and Who, Avatar groups, the account menu, the team switcher's member list, Settings members and
review rules, the Library review "Asked by", notification emails (rendered to PNG server side from the same recipe),
the Figma plugin (reads the team map through the MCP), and the MCP `bridge_whoami`. A face shows the same everywhere
within one render cycle after Save.

## 10. Accessibility

- **Keyboard:** Change, Shuffle, Pick the parts, the Tabs and Save are native buttons in DOM order. The part grid is a
  radio group (one choice): arrow keys move, Space picks, Home and End jump. A taken style stays focusable with
  `aria-disabled="true"`, so keyboard users reach its "Taken by Sofia" tooltip. Esc inside the open row is Cancel.
  Focus returns to Change after Save or Cancel.
- **Screen readers:** the preview image is "Your drawn face"; every tile is named by its part and a human word, never
  "variant32": "Hair: short curls", "Hair: long and straight, taken by Sofia", "No glasses". This needs a label list of
  64 hair styles, 11 glasses, 12 beards (a one-off writing task in the face module, translated with the rest of the UI).
  Shuffle announces the new face through a polite live region. Avatars next to a written name stay decorative, as
  today.
- **Reduced motion:** the riffle is skipped; the new face replaces the old at once (tokens.css already sets every
  duration to 0ms under `prefers-reduced-motion`), and the live region still announces it.
- **Colour is never the only cue:** a taken style is greyed and also captioned with a name and announced as taken.
- **Text:** nothing under 12px (captions are `--typography-caption-size`), muted text is 4.5:1 or more.

## 11. Edge cases

- **Sample team:** the cast (Dana, Sofia, Leo, Malik, Ann) is fixed for every visitor. Playing Dana, the editor works
  for real (same code path, per the "demo = real architecture" rule) and the face is kept in this browser only, like
  every sample-team edit. Teammates' faces are the cast's and are taken.
- **Guests and signed-out visitors:** no row. Settings > You shows Appearance only, as today.
- **Email members without an account yet** (invited, never signed in): their seed drawing, made distinct by 6.4.
- **Two people with the same first name:** names do not matter; faces are per seed, and the seeds differ (`~sofia`,
  `~sofia-2` as `nameFace` already slugs them). The tooltip names them as Settings names them.
- **Self-hosted Studio:** no account server. The face is kept in this browser; uniqueness is checked against the
  members Studio reads from GitHub, client side. Phase 3 can store the team map in the repository
  (`bridge.config.json` `faces`) if self-hosted teams ask.
- **GitHub photo removed later:** the person falls back to their saved drawn face, or the distinct seed drawing.
- **Very large teams (over 64 drawn faces):** section 6.2 overflow rule.
- **Recipe from an older face module** (DiceBear adds or renames a variant): `v` versions the recipe; an unknown part
  falls back to the seed's part for that slot and the person is not asked to do anything.

## 12. Delight

The Field Guide moment is the **riffle**: on Shuffle, the 80px face flips through three faces, each sliding up 8px
like the pages of a field guide being thumbed, in `--motion-duration-slow` (300ms) with `--motion-easing-enter`, then
settles. No confetti, no sound, no bounce: mechanical and damped, as section 8 of the design language asks. The quiet
second moment is **Next to your team**: seeing yourself at 24px between Sofia and Leo is the reason the feature exists,
and it shows the uniqueness rule working without a sentence.

## 13. Metrics

| Metric | Target after 30 days | Why |
| --- | --- | --- |
| Identical drawn faces in any team (nightly check over the team face maps) | 0 | G1, the guardrail |
| Look-alike pairs in any team | under 1% of pairs | G1, soft rule |
| Members with a drawn face who open the row | 30% | Discoverability of a quiet setting |
| Of those, who save | 60% | The editor is worth opening |
| Median Shuffles before Save | 3 or fewer | Shuffle lands good faces |
| Saves that used the part pickers | tracked, no target | Tells us if level 2 is worth growing |
| Face changes reverted within 24h | under 10% | People like what they saved |

## 14. Open questions for the founder

1. **Q1. Account menu shortcut:** a "Change your face" item in the account menu (mocked), or only Settings > You?
2. **Q2. Preview size:** the Avatar stops at 40px (`lg`). The 80px preview needs an `xl` size on Avatar (Tier 2, a new
   prop value) or a one-off in Studio. Recommendation: add `xl` (80px, `--size-20`) to the DS.
3. **Q3. Background tint:** keep one Harbor surface for everyone (recommended: brand rule "Harbor is a zone", and the
   face already carries identity), or allow 4 light tints from the categorical palette? Tints need new tokens (Tier 3)
   and a contrast pair each.
4. **Q4. First claim wins** when someone joins with a face that is taken: acceptable, or should the newcomer be asked
   to choose before their face shows?
5. **Q5. Look-alikes by hand:** allow silently (mocked), warn ("Close to Leo's at small sizes"), or block like taken?
6. **Q6. Photo people:** offer "Use a drawn face instead" to people with a GitHub photo (phase 3), or never?
7. **Q7. Per-team faces:** one face for all teams (recommended, "one face everywhere"), or let people have a different
   face per team?
8. **Q8. Part pickers in v1,** or ship Shuffle only first and add pickers if people ask?

## 15. Phased plan

| Phase | Scope | Ships when |
| --- | --- | --- |
| P0, no UI | The face recipe, the team face map, `drawFace(seed)` replacing `FACE_DRAWING_SEEDS`, automatic `seed#n` for new members, the look-alike list with its 20px measurement as a test, the nightly zero-identical check. Every team gets distinct faces without anyone opening Settings. | First: it fixes G1 alone |
| P1 | Settings > You "Your face" row: collapsed, Change, preview, Next to your team, Shuffle with the riffle, Save and Cancel, account storage, live region. | After P0 |
| P2 | Pick the parts (Hair, Glasses, Beard, Expression), taken states with names, human labels for every part, account menu shortcut, multi-team Shuffle. | After P1 metrics |
| P3 | Photo or drawing choice, tints if approved (Q3), phone layout, self-hosted team map in the repository, faces in emails. | On demand |

## Appendix: the mock

States, all at 1389x868 (device scale 2), built with the real Bridge Library 1.8.6 (tokens.css, bundle.css, bundle.js
from bridgedesignsystem.com) and the real face drawer (DiceBear Notionists 9.4.3 with Bridge's framing):

1. `1-collapsed.png`: Settings > You, the quiet row.
2. `2-open.png`: the editor open, Save disabled until a change.
3. `3-shuffled.png`: after one Shuffle, Save enabled.
4. `4-parts-taken.png`: Pick the parts, Hair tab, four styles taken, "Taken by Sofia" tooltip.
5. `5-saved.png`: back to one row, saved message on the same line, the account menu face updated.
6. `6-account-menu.png`: the "Change your face" shortcut.

Review against the UI quality bar (measured on the screenshots):

- Alignment: the 80px preview, Shuffle, the part tabs, the first tile and Save face all start at x=616, the value
  column of every Settings row. Collapsed: label block, 40px face and Change share one centre line (y=490).
- Font sizes: 30 (page title, Fraunces), 21 (band titles), 14 (UI), 12 (captions). Four, none under 12px.
- One primary action (Save face). Change, Shuffle and Save are at DS control heights (32, 44, 44px); tiles are 64px.
- Say it once: the band intro says "your team", the row help says the uniqueness rule once, the Hair panel says
  "Styles a teammate wears are taken." once; each taken tile shows only what differs, the name.
- Progressive disclosure: level 0 has 7 interactive elements on the first screen; the parts level (31 elements)
  appears only on demand.
- Known mock shortcuts: the Studio shell is simplified; tiles are Buttons with `pressed` (the product version is a
  radio group); the 80px preview is a token-built circle pending Q2.
