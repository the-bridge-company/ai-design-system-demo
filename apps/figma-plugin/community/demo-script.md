# DS Bridge: demo video for the Figma review

Figma support asked for "a screen recording or demo video showcasing how the resource is intended to work with
Figma". This is a 60 to 90 second recording, shot in the Figma desktop app with QuickTime, then a short reply with an
unlisted link. Nothing here publishes the plugin or contacts Figma: you do both by hand.

What the video must prove, in this order: the plugin reads a GitHub repository, writes Figma Variables (and component
sets) from it, a designer edits a variable, and the plugin sends that edit back as a pull request checked for
contrast. Show only what the plugin does today (see [`listing.md`](listing.md)), never a token on screen.

## Before recording (not filmed)

1. **Plugin build.** Use the build of the version you will submit: the release zip
   ([bridge-figma-plugin.zip](https://github.com/the-bridge-company/ai-design-system-demo/releases/download/figma-plugin-latest/bridge-figma-plugin.zip))
   or `npm run plugin:build` from the repository root. If it is not imported yet: **Plugins > Development > Import
   plugin from manifest...**. If an older copy named **Bridge** is still listed, remove it first in **Plugins >
   Development > Manage plugins in development**, so the menu shows only **DS Bridge**, the name on the listing.
2. **Repository.** The public sample team `acme-design-demo/bridge-demo-ds` (Acme Design). Its `bridge.config.json`
   says `"changes": "direct"`, so Push opens a real pull request there, which is what the video shows. Its
   `component-specs.json` is there, so Pull also draws components. It has no Figma reference images
   (`figma-references/` on `bridge-visual`), so **Compare with code is not in the video**.
3. **Connect, off camera.** In a new empty design file named `DS Bridge demo`, run the plugin, **Settings > Sign in
   with Bridge**, pick **Acme Design** in the browser, come back. If the Acme team is not in your Bridge account,
   use **For developers: connect with a token** instead, with a fine-grained token for `acme-design-demo/bridge-demo-ds`
   only:
   - Pull alone works read-only (**Contents: Read**).
   - The Push shot needs **Contents**, **Pull requests** and **Issues: Read and write** (the repository is in
     pull request mode).
   Paste it before you start recording; the field is empty afterwards and the token is never shown again.
4. **Then reset the file**: close the plugin, delete the file and create a new empty one (`DS Bridge demo 2`), so the
   video starts from "Get your design system". The sign-in is kept on this computer, not in the file; open
   **Settings** once in the new file and pick the repository again if it asks (`acme-design-demo/bridge-demo-ds`,
   branch `main`).
5. **Rehearse the Pull once** in a scratch file to know how long the component build takes on this Mac. Delete that
   file afterwards.
6. **Screen hygiene.** Focus mode on (no notifications), one Chrome window with only the GitHub tab you will open,
   bookmarks bar hidden, no other Figma tabs, desktop clean. Figma at full screen, zoom 100%.
7. **QuickTime.** Press **Cmd+Shift+5**, choose **Record Selected Portion**, draw the rectangle around the Figma
   window. **Options**: Microphone **None**, **Show Mouse Clicks** on, Save to **Desktop**. Do not press Record yet.

## Shots

Total target: about 80 seconds. Move the mouse slowly and pause one second on each result so it can be read.

| # | Time | Action | The viewer must see | Max |
| --- | --- | --- | --- | --- |
| 1 | 0:00 | Press **Record**. In the empty file, **Plugins > Development > DS Bridge**. | The plugin window, titled **DS Bridge**, opens on **Pull**: "Get your design system", "First time in this file: Bridge adds its variables and components." Tabs Pull, Push, Settings. | 6 s |
| 2 | 0:06 | Click **Check for updates**. Scroll the preview slowly once. | "Bring your design system into this file", **Changes in the design system** with the token count (open **See the N variables** to show names and values), **New components** with its count, **Include components** ticked, and the button **Apply to Figma**. Nothing is written yet. | 12 s |
| 3 | 0:18 | Click **Apply to Figma**. | The progress line ("Writing variables", then building components). If the build takes more than 8 seconds, stop the recording here (**Cmd+Ctrl+Esc**) and start a second one (shot 4) once "Your design system is in Figma" shows. | 8 s |
| 4 | 0:26 | Clip 2 starts on "Your design system is in Figma". Click an empty spot of the canvas, open **Local variables** in the right panel. | The collections **Primitives, Brand, Base, Semantic, Density, Component**; in **Semantic**, the **Light** and **Dark** columns, values shown as aliases (`palette/neutral/600`). | 10 s |
| 5 | 0:36 | Close the variables window. Go to the **Components** page, select one variant of **Button**. | The Button component set with its variants; in the right panel the fill shows a variable, not a raw hex. | 8 s |
| 6 | 0:44 | Open **Local variables** again, **Semantic**, row `color/text/muted`, **Light** column: change `palette/neutral/600` to `palette/neutral/700`. Close the window. | The alias changing in the Light column only. | 8 s |
| 7 | 0:52 | In the plugin, **Push** tab, **Scan for changes**. Open the contrast line under the change. | The row `color.text.muted` with the swatch before and after for Light, "Contrast: N pairs checked, all pass" with AA or AAA per pair, **Send for review** selected as where it goes. | 12 s |
| 8 | 1:04 | Click **Send for review**. When the result shows, click **Open on GitHub**. | The plugin's result ("Sent for review"), then the pull request on github.com: title, labels `tokens` and `source: figma`, the change table with the Contrast column. Scroll once. | 12 s |
| 9 | 1:16 | Back in Figma, plugin **Settings** tab. | The connected card: the design system's name, the repository, and "GitHub token: From the Bridge sign-in, on this computer only". No token value anywhere. Stop the recording. | 6 s |

If you must cut, cut shot 5 first, then shot 9. Never cut shots 2, 7 and 8: they are the plugin working with Figma.

## After recording

1. **Join the clips** (only if you stopped after shot 3): open clip 1 in QuickTime Player, **Edit > Add Clip to
   End...**, pick clip 2. Trim the start and end with **Edit > Trim** (Cmd+T). **File > Export As > 1080p**.
2. **Watch it once at full screen** and check: no token, no email address or notification, nothing from another
   project, under 90 seconds.
3. **The sample repository.** The pull request is real. Close it on GitHub right after recording (or before its
   checks finish), so `color.text.muted` stays as it is in the sample. If Bridge already merged it, undo it from
   **History** in Bridge Studio for Acme Design.

## Share the video

An unlisted link that anyone with the link can watch, without signing in. Pick one:

- **Google Drive**: upload the `.mov` or `.mp4`, **Share > General access > Anyone with the link, Viewer**, copy link.
- **Loom**: upload the file, sharing set to **Anyone with the link**, copy link.
- **YouTube**: upload, visibility **Unlisted**.

Open the link once in a private window to check it plays without a sign-in.

## Reply to Figma support

Reply in the same thread. Replace `[link]`; keep the last sentence only if the new listing text and version are
already submitted.

```
Hi, thank you for reviewing DS Bridge. Here is a short screen recording of the plugin in the Figma desktop app: [link]
It connects to a public sample repository (github.com/acme-design-demo/bridge-demo-ds), pulls its design tokens into Figma Variables and component sets, then sends a variable edit back as a GitHub pull request, checked for contrast.
The plugin only calls api.github.com and our own site, bridgedesignsystem.com (sign-in, and merging token pull requests once their checks pass). It never shows the user's token, has no analytics and never calls an AI service.
We have also updated the description so it says exactly what the plugin does today.
Best regards, Florian
```
