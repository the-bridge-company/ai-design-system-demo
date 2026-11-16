# DS Bridge: Figma Community listing

Everything the publish dialog asks for, ready to paste, plus the steps. Images are in this folder; the sources
that render them are in [`src/`](src/) (see "Rebuild the images" at the end).

## Name

```
DS Bridge
```

This is the name Figma shows on the Community page and in the Plugins menu of people who install it. The development
copy imported from `manifest.json` shows as **Bridge** (`"name"` in the manifest, and the window title in
`src/main/index.ts`). Keep **DS Bridge** as the public name ("Bridge" alone is too generic to find) and align the
manifest `"name"` and the window title on it in the next version. The id `1693034743850648023` does not change.

## Tagline (58 of 60 characters)

```
Pull tokens from GitHub. Send Figma edits back for review.
```

## Description

Paste as is (plain text with line breaks; use the dialog's list button for the "- " lines if you prefer bullets).
Every line says what the plugin does today; check it against "What each claim rests on" below before changing it.

```
DS Bridge connects Figma Variables to the design tokens of a design system kept in a GitHub repository. The repository stays the source of truth: you pull from it, edit in Figma, and send your edits back for review.

Connect
- Sign in with Bridge: the plugin opens bridgedesignsystem.com in your browser, you pick your team, and the plugin gets that team's repository and a GitHub sign-in that expires. No token to paste. You need a Bridge account for this.
- Or, for developers: paste a fine-grained GitHub token limited to one repository.

Pull: from the repository into Figma
- Reads the token files (W3C DTCG JSON) of your main branch and shows every change before anything is written.
- Creates one variable collection per tier (Primitives, Brand, Base, Semantic, Density, Component) with their modes: themes, brands, densities. Aliases between collections are kept.
- Keeps the edits you made in Figma. Tokens removed in code are marked [orphan], never deleted.
- On plans limited to one mode per collection, it creates one collection per mode instead.
- Components (optional): when the repository has the component specs file Bridge generates, Pull also draws component sets with variants, bound to the variables. Check each one: some components are not supported yet, and the plugin lists them.

Push: from Figma back to the repository
- Lists what you changed since your last pull, with color swatches before and after. When a token changed both in Figma and in the repository, you choose which one to keep.
- Checks the color pairs your repository lists for contrast, in every brand and theme (AA, AAA or fail). An edit that makes a pair fail cannot be sent.
- Where it goes depends on your repository:
  - Suggestion mode: your edits become a GitHub issue for your design system lead. Nothing is written to the code.
  - Pull request mode: the plugin opens a branch and a pull request with the token files you changed (plus a changeset when your repository asks for one), a table of the changes and the contrast before and after.
- Component changes found in Figma go out as GitHub issues, branches or pull requests for your team to review and build.
- The plugin never writes to your main branch. In pull request mode, if your team set up Bridge's GitHub app, Bridge can merge a pull request that only changes token values once your checks pass. Renamed or removed tokens wait for a developer.

Compare with code (optional)
- Exports each component set the plugin drew and compares it with images of the same component rendered from your code, which your repository publishes with Bridge's GitHub workflow. Nothing in the file changes.

Claude (optional)
- The plugin never calls an AI service and holds no AI key. "Ask Claude to fix it" opens claude.ai in your browser with the request written for your team's own Claude, where Bridge is added as a connector. "Draft with Claude" leaves your changes in a file in your repository for your Claude to read, then fills in the text it writes back. Nothing is sent until you press Send.

Privacy
- The plugin talks to two sites: api.github.com (your repository) and bridgedesignsystem.com (Sign in with Bridge, merging a token pull request, and the progress of a Claude fix). No analytics.
- Your GitHub sign-in or token is saved in this plugin's storage on your computer, never in the Figma file and never shown again. It is sent only to GitHub and to bridgedesignsystem.com, which uses it to ask GitHub who you are and what you can access.
- The repository, branch and tokens folder are saved in the Figma file, so everyone in the file uses the same ones.

Free and source available (FSL-1.1-MIT). Docs, source and issues: https://github.com/the-bridge-company/ai-design-system-demo
Bridge: https://bridgedesignsystem.com
```

## Tags (12 of 12)

```
design tokens, variables, github, pull request, design system, dtcg, git, tokens, contrast, accessibility, components, handoff
```

"code sync" was replaced by "components": nothing is synced live, you pull and push by hand.

## Support contact

```
https://github.com/the-bridge-company/ai-design-system-demo/issues
```

## Links (description footer, profile or "Learn more" field when offered)

- Live site: https://bridgedesignsystem.com
- Repository: https://github.com/the-bridge-company/ai-design-system-demo
- Plugin docs: https://github.com/the-bridge-company/ai-design-system-demo/tree/main/apps/figma-plugin

## Data security answers

For Figma's data security questions (publish dialog, or a reviewer's email). Plain answers, true for the code on
`main`; the proof is in "What each claim rests on".

**Does the plugin make network requests? To which domains?**
Yes, to two domains, both declared in `manifest.json`:
- `https://api.github.com`: reads and writes the team's own repository (token files, configuration, branches, pull
  requests, issues, and PNG exports of components the user chooses to send).
- `https://bridgedesignsystem.com` (Bridge, our site): `POST /api/plugin-link` for Sign in with Bridge,
  `POST /api/ship` to ask Bridge to merge a token pull request the user just opened (and, for leads, to approve
  Claude's fixes), `GET /api/fix-sessions` to show the progress of a fix the user asked Claude for.
The manifest also lists `https://bridge.floriangouloubi.com`, Bridge's former address. This version never calls it;
it can go in the next version.
The plugin also opens links in the user's browser when they click them (github.com, claude.ai, bridgedesignsystem.com),
through `figma.openExternal`.

**What data leaves Figma?**
- To GitHub, the team's own repository: token values and names, the Figma file name, the file key and node ids when
  Figma provides them, PNG exports of the components the user sends, and the text the user writes.
- To bridgedesignsystem.com: the GitHub sign-in or token (in the `Authorization` header), the repository name, pull
  request numbers and component names. Bridge uses the token to ask GitHub who the user is and what they can access,
  and does not keep it. During Sign in with Bridge, the token is held encrypted on Bridge's side for at most 5
  minutes, until the plugin collects it once.

**What does the plugin store, and where?**
- On the user's computer (`figma.clientStorage`): the GitHub sign-in or token, whether GitHub last refused it, how it
  was obtained (Bridge or pasted) and the GitHub login of the person who signed in.
- In the Figma file (shared plugin data, namespace `dsbridge`): the repository, branch and tokens folder, the last
  pulled commit, ids and markers on the variables and component sets the plugin manages, and per-person sync state
  keyed by the Figma user id (the `currentuser` permission). The token is never stored in the file.

**Personal data, analytics, tracking?**
No analytics and no tracking. The Figma user id stays in the file's plugin data and is not sent anywhere by the
plugin. The GitHub login comes from GitHub through Sign in with Bridge and stays on the computer.

**AI?**
The plugin never calls Anthropic or any AI service and holds no AI key. Claude features open claude.ai in the user's
browser, or leave a file in the user's repository that the user's own Claude reads through the Bridge connector.

**Third parties?**
GitHub, for the team's own repository. Bridge (bridgedesignsystem.com) is ours.

## What each claim rests on

Re-check these before changing the copy above.

| Claim | Where it is in the code |
| --- | --- |
| Sign in with Bridge, no token to paste, sign-in expires | `src/sync/bridge-sign-in.ts` (`startBridgeSignIn`, `pollBridgeSignIn`), `apps/docs-site/api/plugin-link/index.ts` |
| Pasted fine-grained token for developers | `src/ui/index.ts` (`viewSettings`, "For developers: connect with a token") |
| Token in client storage only, never in the file | `src/main/github-token.ts` (`saveGitHubToken`) |
| Token sent to bridgedesignsystem.com | `src/sync/ship.ts` (`armShip`, `markFigmaPush`), `src/sync/approve-fixes.ts`, `src/sync/fix-session.ts` (`readFixSession`) |
| Two domains, no analytics | `manifest.json` `allowedDomains`; every `fetch` is in `src/ui/index.ts` and `src/sync/` (GitHub client, the three files above, `bridge-sign-in.ts`) |
| Preview before anything is written, local edits kept, orphans not deleted | `src/sync/flows.ts` (`analyze`, `buildPull`), `src/main/apply.ts` |
| One collection per tier, aliases across collections, one collection per mode on limited plans | `src/sync/mapping.ts`, `src/main/apply.ts` (split layout when `addMode` throws) |
| Component sets from the specs file, unsupported ones listed | `src/sync/component-pull.ts`, `src/main/build-components.ts` |
| Three-way diff, conflicts decided by the user, swatches | `src/sync/flows.ts` (`buildPush`), `src/ui/index.ts` (`viewPush`) |
| Contrast AA, AAA or fail, failing pair blocks the send | `@bridge-ds/core` `wcag.ts`, `src/ui/index.ts` (`viewPush`, blocking problems disable the bar) |
| Suggestion mode: a GitHub issue | `src/sync/flows.ts` (`sendSuggestion`), `@bridge-ds/core` `config.ts` (`changesMode`: "suggest" when the config does not say) |
| Pull request mode: branch, pull request, change table, contrast | `src/sync/flows.ts` (`openPullRequest`), `@bridge-ds/core` `pr-composer.ts` |
| Bridge can merge token-value pull requests after checks | `src/sync/ship.ts`, `apps/docs-site/api/ship/index.ts` (needs the Bridge GitHub app) |
| Component changes as issues or branches | `src/sync/publish.ts` (`sendComponentPush`), `src/sync/requests.ts` |
| Compare with code | `src/sync/fidelity.ts` (`runFidelityCheck`), images on the `bridge-visual` branch |
| Never calls an AI service, holds no AI key | no Anthropic call or key in `src/`; `src/sync/claude-connector.ts` (opens claude.ai), `src/sync/my-claude.ts` (file on the requests branch) |

## What the previous copy said that was not true

The copy submitted on 2026-10-16 promised more than the plugin does today, or described an older plugin:

- "DS Bridge only contacts api.github.com. No analytics, no server of ours." False: the plugin also calls
  bridgedesignsystem.com, with the GitHub sign-in in the request.
- "Your GitHub token (a fine-grained token limited to one repository)". Partly true: the main path is now Sign in with
  Bridge, which needs no token; the pasted token is for developers.
- "Opens a branch with one commit, a changeset and a draft pull request". False today: the pull request is ready for
  review (a draft only for a new brand), the changeset is written only when `bridge.config.json` names a package,
  and a repository in suggestion mode (the default when `bridge.config.json` exists) gets a GitHub issue, not a pull
  request.
- "Nothing is ever written to main. CI and your code owners decide." Partly true: the plugin never writes to main,
  but Bridge can merge a token-value pull request once the checks pass.
- "Contrast ... the token build in CI fails on them." True for this repository only; it depends on each team's CI.
- Components, Compare with code, Sign in with Bridge and the Claude features were not mentioned at all.

## Images

| Field | File | Size |
| --- | --- | --- |
| Icon | [`icon.png`](icon.png) | 128 x 128 |
| Cover (thumbnail) | [`cover.png`](cover.png) | 1920 x 1080 |
| Carousel 1 | [`gallery-1-plugin.png`](gallery-1-plugin.png): the plugin UI, Pull and Push | 1920 x 1080 |
| Carousel 2 | [`gallery-2-pull-request.png`](gallery-2-pull-request.png): PR #4, opened by the plugin, in Bridge Reviews | 1920 x 1080 |
| Carousel 3 | [`gallery-3-tokens.png`](gallery-3-tokens.png): the same tokens in the Bridge Studio token explorer | 1920 x 1080 |

The carousel only shows real UI. Gallery 1 is `dist/ui.html` rendered in Chrome against this repository's tokens on
GitHub; outside Figma, the Figma side (the variables and two edits) comes from the plugin's test simulator, as the
caption says. Galleries 2 and 3 are the live pages, unedited.

**Gallery 1 is out of date and must be rendered again before the next version is submitted.** It shows the old
repository name (`peterbono/ai-design-system-demo`), "Opens a draft pull request for review" and a "Push and open pull
request" button. Today the button reads **Send for review** (or **Send suggestion**), the Pull tab's first action is
**Check for updates**, and token pull requests are not drafts. Use "Rebuild the images" below.

## How to publish (owner)

You need the Figma desktop app, signed in to the account that will own the plugin. Two-factor authentication
must be on for that account (Figma requires it to publish).

1. Build: from the repository root, `npm install` then `npm run plugin:build`.
2. If the plugin is not imported yet: **Plugins > Development > Import plugin from manifest...** and pick
   `apps/figma-plugin/manifest.json`.
3. Open any design file, then **Plugins > Development > Bridge** and run it once to check it opens.
4. **Plugins > Development > Manage plugins in development**, find DS Bridge, open its **...** menu and choose
   **Publish** (on some versions the entry sits directly under **Plugins > Development > Bridge > Publish**).
5. Plugin id. Done: `manifest.json` holds the published id `1693034743850648023`. For a fork, the publish dialog gives a new id
   (a long number) and asks you to put it in `manifest.json`. Do it, run `npm run plugin:build` again, and
   continue. Then commit the new id on a branch and open a PR (`fix(figma-plugin): published plugin id`), so
   every later build publishes as the same plugin.
6. Fill the dialog from this file: name, tagline, description, icon, cover, carousel images (in the order of
   the table above), tags, support contact. Leave comments on.
7. Network access: nothing to write. The manifest declares its domains (`api.github.com` and the Bridge site) with
   the reasoning, and Figma shows it on the listing.
8. If Figma asks the data security questions: paste the answers from "Data security answers" above.
9. Publish. Figma reviews new plugins before they appear in Community; it usually takes a few working days and
   you get an email either way.
10. Once it is live, set the docs site's plugin link to the Community page: Vercel project `bridge-docs` >
    Settings > Environment Variables > `PLUGIN_URL` = the Community URL, for Production, then redeploy.

Later releases: build, then **Publish new version** from the same menu, with release notes. The id stays the same.

## Rebuild the images

Needs Google Chrome installed (one headless instance at a time) and the repository dependencies.

```sh
npm run plugin:build
cd apps/figma-plugin
OUT=/tmp/ds-bridge-shots && mkdir -p $OUT
npx esbuild community/src/snapshot.ts --bundle --platform=node --format=esm --target=node20 --conditions=source --outfile=$OUT/snapshot.mjs
node $OUT/snapshot.mjs $OUT/push.json color/text/muted=palette/neutral/700 color/action/primary/bg=palette/primary/800
echo '{"fileName":"Bridge tokens","collections":[],"variables":[]}' > $OUT/pull.json
export GITHUB_TOKEN=$(gh auth token)   # read-only GitHub calls; the pages never see it
node community/src/plugin-shots.mjs $OUT/pull.json $OUT pull
node community/src/plugin-shots.mjs $OUT/push.json $OUT push
node community/src/web-shots.mjs $OUT
node community/src/render.mjs $OUT   # writes icon.png, cover.png, gallery-*.png here
```
