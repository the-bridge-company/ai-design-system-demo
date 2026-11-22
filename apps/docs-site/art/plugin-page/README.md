# /figma-plugin/ page images

Sources of the images in `apps/docs-site/public/plugin-art/`, shown by `src/pages/figma-plugin.astro`. Same
pattern as the Community kit (`apps/figma-plugin/community/src/`): an HTML drawing plus a Playwright script that
screenshots it with Chrome, and the real plugin UI captured by `community/src/plugin-shots.mjs`. Not served, not
built: run by hand when the picture, the plugin UI or the Studio page changes, then commit the PNGs.

| Image | Made by |
| --- | --- |
| `sync-both-ways.png`, `-dark`, `-narrow`, `-narrow-dark` (hero) | `hero.html` + `render.mjs` |
| `pull-window.png`, `push-window.png` (steps 1 and 2, 480 wide at 2x) | `community/src/plugin-shots.mjs` |
| `pull-window-phone.png`, `push-window-phone.png` (phones, 360 wide at 2x) | the same, `WIDTH=360` |
| `review-in-studio.png`, `review-in-studio-phone.png` (step 3) | `studio-shot.mjs`, live Studio page of PR #468 |

Needs Google Chrome (playwright-core, `channel: 'chrome'`) and `npm install` at the repo root (fonts from
`node_modules/@fontsource*`).

```sh
# From the repo root.

# Hero: the two-way picture, light and dark, wide and stacked for phones.
node apps/docs-site/art/plugin-page/render.mjs

# Steps 1 and 2: the real plugin UI, Pull with its variable list open and Push with two edits.
npm run plugin:build
OUT=/tmp/plugin-page-shots && mkdir -p $OUT
cd apps/figma-plugin
npx esbuild community/src/snapshot.ts --bundle --platform=node --format=esm --target=node20 --conditions=source --outfile=$OUT/snapshot.mjs
node $OUT/snapshot.mjs $OUT/push.json color/text/muted=palette/neutral/700 color/action/primary/bg=palette/primary/800
echo '{"fileName":"Bridge tokens","collections":[],"variables":[]}' > $OUT/pull.json
# optional: export GITHUB_TOKEN=$(gh auth token)   (read-only GET calls; the pages never see it)
node community/src/plugin-shots.mjs $OUT/pull.json $OUT pull-list
node community/src/plugin-shots.mjs $OUT/push.json $OUT push
WIDTH=360 node community/src/plugin-shots.mjs $OUT/pull.json $OUT pull-list
WIDTH=360 node community/src/plugin-shots.mjs $OUT/push.json $OUT push
cd ../..
cp $OUT/plugin-pull-list.png apps/docs-site/public/plugin-art/pull-window.png
cp $OUT/plugin-push.png apps/docs-site/public/plugin-art/push-window.png
cp $OUT/plugin-pull-list-360.png apps/docs-site/public/plugin-art/pull-window-phone.png
cp $OUT/plugin-push-360.png apps/docs-site/public/plugin-art/push-window-phone.png

# Step 3: the Studio page of the token change, wide and at phone width.
GITHUB_TOKEN=$(gh auth token) node apps/docs-site/art/plugin-page/studio-shot.mjs
```

Each script takes an output folder as its last argument to render somewhere else first and compare. The plugin
shots read the current `main` from GitHub and keep the answers in `$OUT/github-cache`: with the same cache the PNGs
come out byte for byte the same, with a fresh one they show the tokens of today's `main`. The hero is fully local
and reproduces byte for byte.
