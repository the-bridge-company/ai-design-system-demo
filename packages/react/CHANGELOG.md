# @bridge-ds/react

## 1.9.0

### Minor Changes

- 06282ec: An app type scale. Page titles drop from 44 to 30px (`typography.h1`), section titles from 30 to 24px (`typography.h2`), card and dialog titles from 21 to 16px semibold (`typography.h3`), body keeps 16px on a 24px line. New: `typography.meta` (13/18, the secondary line under a name or title), with the primitives `font.size.150` (13px), `font.leading.18` and `font.leading.24`. Components set their text on the role line heights (20px for UI text, 18 for meta, 16 for captions) instead of 1.2, 1.35 and 1.5 ratios that landed off the 4px grid, descriptions and errors under fields read in meta (13px) instead of 12px with wide tracking, and a bold word inside a Banner title no longer jumps to black (900). In Bridge, the current nav entry keeps the medium weight of the others (color and plate say where you are), the "See it as" menu sets names in medium over a 13px muted line, and text that sets no line height inherits 1.5 of its size instead of 24px.
- 19300f5: `Combobox` takes `inline`: the list sits under the input in the page flow, always open, the first result highlighted (a command palette, or a picker that fills a Dialog), with no Show options or Clear button; plus a `suffix` after the query, and `prefix` and `suffix` on each option (a kind glyph or swatch, a short kind word). `SegmentedControl` gets a link mode: give the items an `href` and the control is a `nav` of links, the current one `aria-current="page"`. `Pagination` takes `noun` ("Piece 3 of 12", "Next piece"). In Bridge, the Cmd+K search is the DS Combobox in inline mode (components/ds/SearchPalette.tsx), the Library and Studio switch is the DS SegmentedControl in link mode (two links, the space you are in the current page), and the phone One by one review pager says "Piece 3 of 12".
- ce41f93: Badge takes `appearance="count"` for the number next to a group heading in a review list: ink figures (text.default, medium, tabular, caption 12/16) on the emphasis neutral fill, no border, at 7:1 or more in every brand and theme; inside the current or selected item it takes the stronger tone (surface.inverse). `tone` is ignored for counts. Nav and tab counts are unchanged (Tabs, SegmentedControl and SidebarNav keep their count slot).

  Library review: the group and chapter counts (Foundations 5, Colors 4) use it. Before, they were muted text on the neutral status fill with a hairline border (5.08:1) and read as disabled on the tinted group cards.

- 5c042f8: New Stepper: the steps of a flow as one path (numbered markers on a connecting line; done, current and upcoming states; vertical, or horizontal that stacks on narrow containers; aria-current="step"). SegmentedControl items take a `count`, shown in a count tag like Tabs and SidebarNav; the three share one count tag (neutral pill, stronger tone on the selected item). PopoverContent takes `initialFocus`. Craft fixes: Breadcrumb and Pagination items ignore a page's own list spacing (later crumbs sat 3px low), Kbd sm and Avatar xs text no longer go under 12px, SidebarNav rows use the 20px UI line height.

  Library: the a11y check icons center on the first line, the component header groups its resources, the color specimens pass AA (pressed surface, overlay scrim, primitive ramp labels), counts sit in count tags (token types, component families), the duplicated component count is gone, the "Figma is ahead" line shows only to maintainers, Button usage reads without code. Home: an "Open the demo" button next to Get started, step numbers on the first line, the waiting review cards at a legible size, the Acme team's names in the mocks.

- 67e34ae: `@bridge-ds/react/dom` gains `tagHtml()`, the exact markup of a static `<Tag>` for pages that build rows in plain scripts, and `badgeHtml()` takes an `icon` (the glyphs the DOM renderers draw, such as `check` and `x`), like `<Badge icon>`. `iconButtonHtml()` draws the `ellipsis` glyph (MoreHorizontal) and takes a `tabindex` in `attributes` in place of the default one, like `tabIndex` on the React IconButton (a roving grid cell). Parity tests compare all of them with the React components.

  Studio Tokens and the token editor now use the design system's own components instead of hand-made copies: the type filter is a SegmentedControl with counts (a removable Tag when the table is scoped to a component), the row actions are a Menu, the editor's ramp is a SegmentedControl of swatches with DS tooltips (a RadioGroup of steps for sizes and durations), More families is a Menu, More options is a Button, the review is the DS Dialog, the draft count is a Badge, contrast results are Badges, aliases are Tags and the row actions button is the DS IconButton. The Library tree is the SidebarNav. Keyboard paths, deep links and the draft flow are unchanged; the hand-made styles are gone.

- 19300f5: The illustrated face's hair styles, glasses and beards have human names. `FACE_PART_NAMES` and `faceVariantName(part, variant)` give each of the 64 hair styles, 11 glasses and 12 beards a short name written from its drawing ("Short curls", "Space buns", "Round glasses", "Handlebar moustache"), unique within its part. They are exported by `@bridge-ds/react/avatar-illustrated` and by the new data-only entry `@bridge-ds/react/avatar-illustrated/names`, which a page or a server imports without loading the drawings.

  Settings > You > Your face names its tiles with them ("Curly puffs, taken by Sofia" instead of "Hair style 40, taken by Sofia") and says them after a Shuffle ("New face: space buns, round sunglasses."). Hat, No glasses and No beard stay.

- dcfa668: One filter pattern everywhere. Select gets `inlineLabel`: the filter's name inside the trigger in secondary text, then the value in default text and the chevron ("Status Waiting", "Product All products"), the trigger hugging its content and named by both ("Product: All products"). `multiple` with `values` and `onValuesChange` picks several values, the list staying open while options are ticked, and `displayValue` sums them up ("In progress", "Leo +1"). Studio's filters all use it, at the md control height beside the search field and the view switch, and all take several values (people, products, families and statuses combine): Library review (Status, Asked by, Product), Explorations and Being built (Status, Product, Person, "Everyone" now reads "Person Everyone"), and the Family filter of Components, the Storybook and team components and the library's component pages ("Family All"). One rule for every filter: nothing ticked is the filter's all word ("Not shipped yet", "In progress", "Everyone"), never an option among its own members; each option carries its count tag; an option with nothing in it is not listed; the trigger reads the first ticked option then "+N" ("Status Being built +1"), never "2 statuses". On a phone the filters are one row that scrolls sideways inside itself, never the page, with a fade on the edge that hides a filter. An inline-label trigger takes the DS focus ring (outline and offset) instead of the inset field line, and every Select trigger is positioned so its visually hidden parts never escape a scrolling row.
- c31c0b2: `bridge audit --no-regress` now also fails when component imitations go up since the baseline (skipped while the baseline was written before imitation detection). Banner gets `appearance="harbor"`: the light Harbor zone (`color.bg.zone`) for a designer note or a Field Guide moment. The docs site's Library review designer note uses it again, and the docs site audit baseline records the current imitation count.
- 7704ca1: `@bridge-ds/react/dom` renders two more components for pages without React at runtime: `buttonHtml()`,
  `buttonClassName()` and `iconButtonHtml()` give the exact markup of Button and IconButton, `drawerHtml()` gives the
  markup of Drawer, which opens and closes with the Dialog functions (`openDialog`, `closeDialog`). Parity tests compare
  each with its React component.

  Bridge's Library, homepage and site use the real design system components instead of hand-made copies: the site
  buttons are DS Buttons and IconButtons, the token detail drawer and the Studio component drawer are the DS Drawer,
  the copy toast is the DS Toast, the homepage step tabs are the DS Tabs, the "Copy as" menu of every token row is one
  DS SegmentedControl per page, the "Used by" chip is a DS Button that opens its list and "Unused" a DS Badge.

- 4f436c5: Studio uses the design system's own components where it had hand-made copies. Library review: the designer's "who decides" note is a neutral Banner, decisions wait in a Toast with Undo, One by one on a phone moves with Pagination (compact), the Map's "5 of 12" is a Badge, and the eyebrow's dot is the shared separator. The exploration capture shows a Button look on hover and a Tag on touch. The adoption report shows values and token names with TokenValue. The token review table marks added and removed tokens with Badges, the visual impact filters are SegmentedControls and its Before and After labels Badges. The token history's demo switch is a Switch. The changelog's announcement shows the agent Avatar. Typed " · " separators go through lib/sep. Dead hand-made CSS (unused counts, avatars, chips, banners, the old GitHub dialog box) is gone.

  `@bridge-ds/react/dom` gains two renderers for plain-script pages: `switchHtml` (with `bindSwitches`, `setSwitchChecked`) and `segmentedControlHtml` (with `bindSegmentedControls`, `selectSegment`), the same classes and static contract as `<Switch>` and `<SegmentedControl>`, guarded by parity tests.

- 19300f5: `MenuContent` takes an `anchor`: the menu opens from an element, a ref, a virtual box (`{ getBoundingClientRect }`) or a point (`{ x, y }`) instead of its MenuTrigger. New types `MenuAnchor`, `MenuAnchorPoint`, `MenuAnchorRect` and `MenuVirtualAnchor`. `DrawerContent` takes `keepMounted`: the closed sheet stays in the DOM, hidden, so a script can bind its body and footer at load. In Bridge, the row actions menu of Studio Tokens is anchored to the row's own button, which now stays in place while the menu is open (no more swap for a DS trigger); a second click on it closes the menu. The token review is the DS Drawer again (StaticDrawer, which gains a footer slot) instead of a large Dialog.
- 6e56c93: Popup lists breathe: Menu, Select and Combobox popups now keep an 8px inset (space.2) between their edge and their items, up from 4px. Items stay concentric with the popup (popup radius minus the inset: 12px on Bridge, the control radius, and 8px on Ocean), and separators keep the inset's 8px gap above and below while still running to the popup edge. In the docs site, the account menu's head and the "See it as" footer note drop their own padding and line up with the menu items (the note on the names, after the faces), the note now sits under a DS MenuSeparator, and the sample banner's "See it as" uses the same secondary Button, at the same size, as "Get started" next to it, so the warm banner has one button language.
- a756fd6: `TabsPanel` can live outside its `Tabs` root: give it `tabId` (the id of its Tab, which points back with
  `aria-controls`) and it renders the same DS panel, a labelled tabpanel in the tab order, shown until the page picks
  one. `showTabsPanel()` from `@bridge-ds/react/dom` shows the picked panel and hides the others. For pages whose tabs
  are one island and whose panels are server-rendered or hold islands of their own.

  The Team Settings groups and the four panels of a Library component page are now DS TabsPanels linked to their DS
  Tabs, instead of hand-made tabpanels: the docs site has no imitation left.

- 4a54bc9: One logic for tab-like controls. Tabs (underline) switch the sections of a page or object; SegmentedControl switches a view or a filter of the same content. Tabs: the selected tab is ink text over the underline, never a box; the focus ring shows on keyboard focus only, inside the tab a step off its edge, and a click draws none. SegmentedControl: the selected segment (and the current link in link mode) is the raised plate with a neutral hairline edge, no longer a Deep Harbor outline that read as focus; the Deep Harbor fill needs `appearance="strong"`, now only on the Library and Studio space switch (link mode no longer fills by itself). Count tags look the same selected or not in both. Tabs `variant="contained"` is deprecated and wears the same plate as SegmentedControl. In Bridge, the space switch asks for `strong` and the face parts in Settings use underline Tabs.
- 4753774: RadioGroup gains `appearance="tile"`: options that are pictures in wrapping rows of equal tiles, the tile is the control (no
  radio circle drawn, the radio stays focusable), the selected one ringed, a disabled tile's picture grey.

  Your face: a drawn face that is yours and never a teammate's. `@bridge-ds/react/avatar-illustrated` draws a face from
  its parts (`FaceRecipe`, `faceRecipe(seed)`, `illustratedFaceSvg`, `illustratedFaceUri`, `FACE_PART_VARIANTS`). In
  Studio, Settings > You opens with "Your face": Change, Shuffle (a 300ms riffle, none under reduced motion) and, on
  demand, the parts (hair, glasses, beard, expression) as DS RadioGroup tiles, with a teammate's style taken and named. The face is kept on the
  Bridge account (`POST /api/account { action: 'face' }`, 409 `face_taken` naming who wears the style) and in each team's
  face map, read with the team; every surface draws through it, and a new member gets a distinct face by itself (their
  seed redrawn until its hair is free). On the sample team the face stays in this browser. The account menu shows the
  person's role on this team under their email.

### Patch Changes

- e8ec6b2: `bindTooltips` (DS tooltips on markup a script builds): when keyboard focus moves to the next trigger, the tooltip that is fading out is removed at once, so it never sits over the control that now has focus (WCAG 2.4.11).
- f3b26f4: Studio lists say one thing everywhere. The Library card counts its with-developer steps from Being built's rows. The
  Board shows only the statuses the filter keeps, with equal-width columns and "Shipped (30 days)" on one line. Cards and
  rows of an exploration read one clock with one formatter. Every in-progress tag has a dot, and Quality's waits are
  grey. The PM uses the lead's verbs (Review, Looks right). A developer gets a Pick up action. There is one Home hero
  layout for every role. The Button link variant keeps a 24px target.
- 16f29b8: Sample team: no personal data, and the first two actions run in the browser. Settings > Reviews names only the cast (never the GitHub owners of the repository hosting it) and says the review rights in plain words ("Checks the look", "Checks the code", "Adds it to the library") instead of config keys. Example names in the Color specimen, the token editor preview, Card and Avatar docs read as people of the cast or generic people. The component page's Code tab no longer prints the raw Storybook address and says "Open in Storybook" instead of "Workbench". Start an exploration and Looks right work in the browser on the sample team; Looks right moves the exploration on as the real approval does (Ready to build, or the library decision while a new piece waits), and every read of the visit agrees. A component page shows one Figma status: never "Not linked to Figma yet" beside "Figma is ahead", and the hint only to a lead.
- 1742f8c: Field, Checkbox, Switch, CheckboxGroup and RadioGroup descriptions read in UI 14/20 in the muted color instead of meta 13/18: a description under a label introduces the control, it is not row metadata. Errors and item descriptions inside Select, Combobox and RadioGroup option lists stay meta.
- 2c4a094: Banner: the icon, the title's first line and the actions now share one centre line. Actions sit on the title's first line instead of floating at the vertical centre of a multi-line banner, and the title and detail keep one text column indented past the icon. Library review's designer note says it once: "Dana decides what the library keeps." then "The decision shows here and on your exploration." with "How library review works" inline at the end, on the Banner's own icon (no hand-made face in the title).
- 0cc35ed: Link: hover keeps the 1px underline; only its color changes.
- e03015e: Badge count appearance now matches the nav and tab counts: a quiet pill (neutral fill, default border, muted figures) instead of the dark emphasis fill.
- a3a21fc: Type sweep on the new scale. Secondary lines read in meta (13/18) everywhere: who and when under a row, ages, counts' companions, descriptions under titles, card meta, column labels, setting help, field counters and the Stepper's step meta. 12px stays for section labels, table heads, badges, tags and counts, keyboard keys, code values and chart ticks. Row titles in lists (home, Explorations, Library review) are UI 14 medium over their meta line instead of 16 over 12 or 14. Muted UI text (`t-ui t-muted`) and the new `t-meta` utility use meta. Every rule that sets a role size now sets the role's line height too (no more 14/21 or 12/18 from the root ratio).
- 414350e: `TabsPanel`: the panel's focus ring is for the keyboard only. A pointer focus (a click on the panel's text, or Safari handing focus to the panel when a button inside it is clicked) draws no ring, the browser's included, and the keyboard ring now sits `--space-1` away from the panel so its content never touches it.

  Settings > You, Your face: the four expressions are drawn apart at 80px (each one changes the eyes, brows and mouth visibly), the Expression control hugs its segments, the help line names the sample team "Acme Design" as its chip does, and the expression help is plain: "Expressions show on bigger faces. In small rows, people recognise you by your hair."

- Updated dependencies [06282ec]
  - @bridge-ds/tokens@1.9.0

## 1.8.6

### Patch Changes

- add7201: Checklist: rows ignore a page's list spacing, so a highlighted row fills its whole band up to the dividers.

## 1.8.5

### Patch Changes

- 0a716b8: Audit minors. A team's /products/ address now opens its Home, where the product folders are, instead of a missing page. On a phone, addresses wrap at their slashes and dots instead of mid-word, every Copy button of Settings fills its row, the Studio Tokens table keeps its border to the last token, and a row of tabs or type chips that scrolls fades its cut edge (DS Tabs does it for every tab list). Quality says how many components its adoption headline counts. Every "yesterday" and "N days ago" counts calendar days, so one moment reads the same on every screen, and each status keeps one tag color everywhere. An exploration keeps the name its designer typed on every screen, and its picture names the same screen on Home and its product page. Settings puts Add a product on the Products title line. A visitor who cannot open a private product sees one line asking to sign in.
- 3ce0cd9: Bridge's repository moved to the the-bridge-company organization: package repository, homepage, issues, docs and schema links point at the-bridge-company/ai-design-system-demo.
- Updated dependencies [3ce0cd9]
  - @bridge-ds/tokens@1.8.5

## 1.8.4

### Patch Changes

- 80d6bf4: Usage guidance for Button.

## 1.8.3

### Patch Changes

- 194c7a1: Select and Combobox: the highlighted option's corners now follow the popup's corners, like Menu items.

## 1.8.2

### Patch Changes

- c8ebeda: Usage guidance for VisuallyHidden.
- d91b46a: Publishing Claude's usage guidance from the docs editor now counts as its review: the drafts still pending go out kept (credited to Claude, `needsReview` false) instead of marked for a review nobody is asked for, and the send step says so. On the Studio home, a guidance draft someone already sent no longer waits on you: published, it reads "On its way to the library"; sent for review, "In review", and it opens the change. VisuallyHidden's guidance, published in #610, is marked reviewed.

## 1.8.1

### Patch Changes

- 009a5ee: Compare with code: popup examples with HTML elements (a list, a paragraph) are compared instead of skipped, a tooltip is rendered with its trigger instead of failing, a size difference is said first ("height 89 in Figma vs 48 in code") instead of a small pixel score, and the list says "Show all 57 compared" next to a headline that counts every set.

## 1.8.0

### Minor Changes

- 29162d9: Badge: the sm size gets 8px side padding (space-2) instead of 6px, so small badges no longer feel cramped. Drafted from a Figma change (#325).

### Patch Changes

- aaac948: AvatarGroup: avatars overlap by a sixth instead of a quarter, so the second of two initials is never cut.
- 57b8d89: Component specs treat a button or a select (including the Base UI part that renders one, read from Base UI's docs) as border-box: NumberField steppers are their height token wide again.
- 3ed1ee5: ButtonGroup: the focus rule of attached groups uses `> :focus-visible`, same behaviour, no universal selector.
- 64d3e8b: Combobox: a chip cut by the field width shows its full value on hover (title).
- 9044d1a: Combobox: the listbox takes the field's name (its `label`, `aria-label` or `aria-labelledby`), so it is never an anonymous list, including while it closes.
- ea27992: Designer words: screens a designer reads say "change" and "library", never branch, merge or main. The share and
  product-branch sentences of `@bridge-ds/core` (`shareDescription`, `SHARE_EXPLAIN`, `libraryPreviewState`,
  `productBranchSentence`) now read "This change was added to the library", "Your feature uses a preview of the library
  change". The MCP fallback share sentence follows. ChoiceCard docs examples say "your change". Gate reasons, status
  labels and developer texts (CLI, MCP, GitHub) keep their git words.
- e1d05e0: Drawer: a body taller than the sheet is now a focusable region named by the title, so it can be scrolled with the keyboard.
- 788b3f8: Stories per Figma variant for the sets whose checked state comes from their group (ChoiceCard, Radio, MenuRadioItem), with a `checked` arg the render turns into the group's value, so the Storybook measure maps each story to its variant.
- ff50cd9: Button stories take `disabled` as a control, so the Storybook measure reaches the Disabled variants. The Figma plugin reads measured specs with the core types, part pairing and state matching.
- 1c5563b: Menu: the item highlight is concentric with the popup corners.
- 8fa49c7: Popover: the arrow no longer makes the popup show scrollbars when it opens above its trigger. The content scrolls inside its own padded area.
- efa01d6: Component specs count height and width as the content box (a bordered table cell is its height plus its border), the Figma build draws an empty sized slot at its padding instead of 100px, and stories reach every Figma variant: a disabled control on IconButton, Input, Select, Combobox and Textarea, and Figma variant stories for AccordionItem, MenuItem, MenuCheckboxItem, MenuSubmenu and TableEmpty.
- 9ec466a: Component specs match the code in two places the generator misread: menu parts drawn alone take the popup's snug line height, and the page header title takes its desktop (h1) size, as width media queries are now read at the 1200 px the code images use.

## 1.7.0

### Minor Changes

- d1e0bc5: The agent mark of `Avatar kind="agent"` (and `avatarHtml({ kind: 'agent' })`) is now the Field Guide robot from the
  landing page: a rounded head with an antenna, two dot eyes, a smile, side ears and two legs, drawn as one round-cap
  stroke in currentColor with no fill, so it keeps the tile contrast in light and dark and reads at the xs size (16px
  mark). It replaces the prompt chevron and cursor. `AGENT_MARK` keeps its shape (`viewBox`, `path`, `strokeWidth`,
  `color`); its `viewBox` is now `0 -0.8 24 24` and its `strokeWidth` 1.8. The accessible name stays "Claude AI". Studio,
  the Library and the docs pick it up through the Avatar; the regenerated component specs carry it to the Figma plugin.

### Patch Changes

- c96cdc2: Page filter bars use one control size, md, like the Library tokens page. Studio Components (search and family
  Select), the Show filter of change requests and explorations, the History filters and the branch filter on Studio
  home moved from sm to md, so the search, Select and SegmentedControl in a bar share one height. The Input, Select and
  SegmentedControl guidance now says md for a page's filter bar and keeps sm for dense toolbars, menus and panels.

## 1.6.0

### Minor Changes

- 8cdcb9a: Avatar agent: Bridge now draws its own agent mark (a prompt chevron and cursor line, Deep Harbor on a Harbor rounded square tile) instead of shipping the Claude logo, which is an Anthropic trademark. `brand="claude"` still works and keeps the name "Claude AI". New `AGENT_MARK` export; `CLAUDE_MARK` stays as a deprecated alias of it. New optional `mark` prop for a vendor logo you have the brand owner's approval to use. The agent tile token `color.agent.surface` now follows the Harbor zone in every theme and brand. The Figma UI kit gets a Kind axis (person, agent) drawing the new mark, and the spec generator keeps an SVG line join.

### Patch Changes

- Updated dependencies [8cdcb9a]
  - @bridge-ds/tokens@1.6.0

## 1.5.0

### Minor Changes

- b4edf85: Avatar: illustrated faces and Claude's identity.

  - `Avatar fallback="illustrated"`: without a photo (or when it fails), a drawn face that is always the same for the same `seed` (a login), on the Harbor zone color. The drawings are the DiceBear "Notionists" style (design CC0 1.0 by Zoish, code MIT), generated locally with no network. They weigh about 120 kB gzipped, so they live in a separate entry: import `Avatar` from `@bridge-ds/react/avatar-illustrated`. The main entry keeps initials as the default and stays light; `illustration` takes a ready image if you draw faces yourself.
  - `Avatar kind="agent" brand="claude"`: the Claude mark on a cream tile, same round shape as people, named "Claude AI", to attribute work Claude did. The Claude mark is an Anthropic trademark: check the Anthropic brand guidelines before shipping it in a product.
  - `avatarHtml()` in `@bridge-ds/react/dom`, the same markup for rows built in plain scripts.
  - Tokens: `color.illustration.surface` (the Harbor zone color, a lighter step in dark so line drawings stay readable) and `avatar.illustrated-bg`; `color.agent.surface` (cream, the same in both themes), `avatar.agent-bg` and `avatar.agent-border`.
  - Studio: change rows, the change and history details and explorations show a face and the person's display name instead of "@login"; work Claude made, and Claude's guidance drafts, show Claude's identity.
  - Studio Quality: the library health cards (contrast checks, adoption, guidance) open the page, with their detail below, and Share copies a short summary for Slack or a slide or downloads the header as an image.

### Patch Changes

- 7b53159: Motion is documented and reviewed from the code. The spec generator now records how a part opens and closes: the "Opening and closing" motion note carries the code's `enter` and `exit` transitions (duration, easing and their motion tokens, read per element so a drawer's side class and its popup class count together), and looping animations carry their `durationToken`. `componentMotion` returns them as `opening` and lists their tokens, so `componentsUsingMotionToken(specs, "motion.duration.moderate")` finds Dialog and AlertDialog. component-specs.json is regenerated (popup sets gain their open and close motion).

  Every Library component page has a generated "Motion and interaction" section in its Tokens tab: when it moves (hover, press, check, open, close, loops), what changes, the duration token with its value and the easing token in words, and what reduced motion does, in one sentence. Components without motion say so in one line; motion the specs cannot place is said, never denied.

  For branch reviews, `MotionChanges` (components/ds/studio/MotionChanges.tsx) shows a plain sentence per motion change, two looping previews of the same component at the old and new motion with Replay, and the other components it touches; still frames under reduced motion. `motionChanges` (lib/motion-changes.ts) computes the changes from the token sets and specs at both commits; `mountMotionChanges` (scripts/reviews/motion-changes.ts) mounts the block from a review page.

- Updated dependencies [b4edf85]
  - @bridge-ds/tokens@1.5.0

## 1.4.1

### Patch Changes

- 6b07b05: Check fidelity: the Pull tab compares every generated Figma variant with the same variant rendered from code and says, per component, "Matches the code" or "Differs from the code: 12% of pixels, size 120x40 vs 118x40", with Figma, code and differences side by side. Nothing in the file changes. Core adds the pure comparison (`compareImages`, tolerant of font rasterization and antialiasing), the storable `FidelityReport` and the variant to code mapping (`planReference`); `bridge figma-references` (visual) captures the code images from Storybook, published on main by the Figma references workflow to the `bridge-visual` branch. React adds a hidden Storybook fixture, "Internal/Figma reference", not part of the package.

## 1.4.0

### Patch Changes

- 837d215: Dark mode polish and leftovers from the critiques.

  - Tokens: `color.surface.strong` (Deep Harbor in both themes, for a strong mode surface) and `color.feedback.neutral.bg` (the fill of a status with no tone, one step off every surface in both themes), each checked by a new contrast pair. `popup.border` steps up to `color.border.emphasis` so a list opened inside a Dialog keeps an edge in dark.
  - SegmentedControl: the selected segment takes the checked control color as its edge, like a pressed Button toggle; it had no edge in dark.
  - Banner `appearance="strong"`: `color.surface.strong` with `color.text.on-solid` and a matching focus ring. In dark it was the light primary action color and read like a Harbor zone.
  - Badge neutral (subtle): `color.feedback.neutral.bg`, so grey status chips keep their fill on dark cards.
  - Docs site: the owner override confirmation is the DS Dialog for plain scripts (Textarea, Alert, SegmentedControl, ButtonGroup) instead of a native dialog; All tokens filter controls share one size; Quality audit tables stack on phones; the Changes tabs fit a phone; Changes rows say "Library moved on: N updates"; failing developer tests are never "Your turn" for the designer who made the change; the search palette shows the nav icons; Tokens type chips use the selected look; rows of a viewed change say "Changed" or "New"; "Bring in the latest library" uses the standard control height.

- Updated dependencies [837d215]
  - @bridge-ds/tokens@1.4.0

## 1.3.0

### Minor Changes

- a54ac38: `@bridge-ds/react/dom` gains the Dialog for pages without React at runtime: `dialogHtml()` renders the exact markup of `<DialogContent>` (same classes, same look), and `bindDialogs()`, `openDialog()`, `closeDialog()`, `isDialogOpen()` and `dialogReturnValue()` give it the React Dialog behavior: focus moves in and is trapped, the page behind is inert and does not scroll, Escape and the scrim close it, focus returns to the trigger, `aria-modal`, `open`, `cancel` and `close` events, and a `<form method="dialog">` inside closes it with the submit button's value. A parity test compares it with the React Dialog. SegmentedControl: the selected segment uses the raised surface, so it no longer disappears into its track in dark mode (light is unchanged).

  The audit counts a native element only when the design system has a component that replaces it: `<img>` is no longer a miss in a design system without an Image component.

  The docs site has no temporary audit allowlist any more: its prose links are the DS Link or ButtonLink, its icons are the DS Icon (the site's own glyphs, drawn through `createLucideIcon`), the Quality audit table is the DS Table, and the search palette, New token, Send for review, Connect GitHub and Undo planner dialogs are DS Dialogs opened by their scripts. Every Studio header control is the DS sm size.

## 1.2.1

### Patch Changes

- 71bbb8e: Usage guidance for Icon.

## 1.2.0

### Minor Changes

- f1a8b55: Five new components and a supported path for pages without React. `CodeBlock` (code or a command in Plex Mono with a copy button that says "Copied"), `TokenValue` (a token name and value with a color swatch, for before and after values), `Checklist` and `ChecklistRow` (status icon, title, one line of detail and the action on the same row), `ChoiceCardGroup` and `ChoiceCard` (radio choices shown as cards with a title and a description) and `Banner` (a page-level mode banner, Deep Harbor or neutral, optionally sticky). The new `@bridge-ds/react/dom` entry renders Badge, CodeBlock, TokenValue and Checklist as HTML strings with the exact markup and classes of the React components, and adds `tooltipAttributes()` with `bindTooltips()` and `bindCodeBlocks()` for plain-script pages. `bridge audit` counts these renderers as design system components and now flags homemade look-alikes in script-built markup (`class="pill"`, `data-tip` tooltips). Studio and the Library adopt them in place of their homemade pills, tooltips, command rows, value chips, checklist, radio cards and mode banners.
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

- 0cfc3ff: Select: the label and badge row in the trigger now applies to every Select, not only disabled ones. A stray selector limited it to disabled triggers, so badges sat under the label and the narrow-trigger rule never ran.

## 1.1.0

### Minor Changes

- dfa95ed: Textarea gets `appearance="inline"` for editing existing text in place: no border, no resize handle, the surrounding
  font, size and line height, a height that fits the content (`field-sizing: content`, measured without moving the page
  where it is not supported), a fill and hairline on hover and the DS focus ring on focus. Never use it in forms.
  The Library edit mode now uses it instead of restyling Textarea internals.

## 1.0.0

### Minor Changes

- e54d2a1: Packages are publishable under the `@bridge-ds` npm scope (renamed from `@demo-ds` and `@bridge`). Each ships built ES modules, type declarations and, for React, one `styles.css`; the monorepo keeps resolving TypeScript sources through the `source` export condition. `@bridge-ds/core` adds branch preview helpers (`previewUrl`, `snapshotUrl`, `previewComment`) and a `previews` section in `bridge.config.json`. `@bridge-ds/react` adds an opt-in staging token override: `ThemeProvider` `tokenOverride` loads an allowlisted `tokens.css` from `?bridge-tokens=`, off by default and refused in production builds unless enabled.
- b6cb68a: Actions: Button gains `danger` variant, `lg` size, `iconStart`, `iconEnd`, `fullWidth` and `render` (a link stays a link); loading keeps focus. New IconButton, ButtonGroup (spaced or attached) and Link (inline, standalone, subtle, external).
- 8180108: Data display: Card restyled as a flat plate with an `interactive` option and padding sizes; Badge gains `appearance` (subtle, now the default, or solid), a dot, icons and sizes (existing solid badges must pass `appearance="solid"` to keep their look); new Avatar and AvatarGroup, Table (sortable headers with aria-sort, selectable rows, sticky header, focusable scroll region, useTableSort), Accordion, Tag (removable, toggleable), Divider and Kbd. Adds avatar, tag, kbd, divider and accordion component tokens.
- 8ec801a: Feedback: Alert (five tones, actions, dismiss, correct live region), Toast (ToastProvider and useToast with success, error, warning, info, promise, update and close), Progress (linear and circular, determinate and indeterminate), Skeleton, EmptyState, plus Spinner stories and guidance. Adds alert and skeleton component tokens.
- e8fd4a8: Forms: Field (label, description, error wired by Base UI Field) and Input rebuilt on it (prefix, suffix, sizes; label, hint and error props kept). New Textarea (autosize, character count), Select (groups, descriptions), Combobox (filtering, async loading and empty states, multiple with chips), Checkbox (indeterminate, parent), CheckboxGroup, RadioGroup, Switch, Slider (single and range), NumberField (steppers, units) and Form (server errors with a focusable error summary, FormActions footer).
- b6cb68a: Base UI foundation: components now wrap `@base-ui/react` for behavior and accessibility. Adds `ThemeProvider` (theme, brand and density scope, passed to portaled overlays), `Icon` (Lucide with token sizes), `VisuallyHidden`, and global base styles at `@bridge-ds/react/styles.css`.
- 7d3f7cd: Layout utilities: Stack, Inline, Grid (fixed columns or auto-fit by minimum item width) and Container (token widths and gutters). Gaps only accept space-scale keys.
- acd1273: Navigation: Tabs (underline with a sliding signal indicator, contained, icons, counts, vertical), Breadcrumb (aria-current, collapsing middle levels), Pagination (full and compact, getPageItems helper) and SidebarNav (sections, collapsible groups, counts, current page mark).
- b0da5ed: Overlays: Dialog (sizes, scrolling body, footer, close last in focus order), AlertDialog (destructive confirmations, async confirm), Drawer (start, end, bottom with swipe), Popover, Tooltip with TooltipProvider, Menu (icons, shortcuts, groups, submenus, checkbox and radio items, danger items). Every popup carries the theme, brand and density scope. Adds menu and drawer component tokens.
- 1f29f63: Initial foundation: DTCG 2025.10 primitives and light/dark semantic tokens built to CSS variables, plus Button, Input, Badge and Card consuming tokens only.
- fd83606: PageHeader: the top of a page with the title (h1 by default), a one-line lead, an optional meta line and the page actions, which wrap under the text on narrow screens. Lead, meta and actions are props, so the header also renders from Astro named slots.
- fd83606: SegmentedControl: pick one of two to five views or modes in a row of attached buttons (Base UI RadioGroup with native button radios). Takes an `items` array so it also renders from Astro and other static templates; the static HTML keeps role, aria-checked and data-value so a small script can drive it without hydration.

### Patch Changes

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

- 73b1a6f: Add usage guidance files for Button, Input, Badge and Card, plus the list of color pairs to check for contrast. They feed the new documentation site; no visual or API change.

  For you: Nothing changes in your designs. Usage guidance, contrast checks and this changelog now live on the documentation site.

- 6cd9c3a: Target sizes: SegmentedControl `sm` segments are at least the small control height (32px), and standalone Links are at least 24px tall (WCAG 2.5.8).
- e47f4a6: Usage guidance for Icon and VisuallyHidden, drafted by Claude from their code and marked for review.
- cf3f5bb: Adds the generated `component-specs.json` (run `npm run specs`) for Button, IconButton, Badge, Tag, Input and Card, read by the DS Bridge Figma plugin to pull them as component sets. No change to the components.
- 7261f47: Regenerates `component-specs.json` with icon and content slot swaps and the icons section. No change to the components.
- 937bd43: SegmentedControl docs: a visible label goes outside the track, to its left, and names the group with aria-labelledby. New do and don't, a WithVisibleLabel story, an external label row in AllStates and a test for the accessible name. Bridge foundation pages now show "Preview brand" and "Preview density" as captions beside the switch instead of inside the pill.
- a914c38: Skeleton docs: the preview shows an avatar, two text lines and a block (it rendered at zero width).
- Updated dependencies [e54d2a1]
- Updated dependencies [a55525d]
- Updated dependencies [8180108]
- Updated dependencies [8ec801a]
- Updated dependencies [b0da5ed]
- Updated dependencies [b6cb68a]
- Updated dependencies [73b1a6f]
- Updated dependencies [84e1383]
- Updated dependencies [1f29f63]
- Updated dependencies [5c40693]
- Updated dependencies [0cab1bb]
  - @bridge-ds/tokens@1.0.0
