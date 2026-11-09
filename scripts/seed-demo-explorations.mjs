#!/usr/bin/env node
// Seeds the sample team's explorations (acme-design-demo/bridge-demo-ds) on its products, the way its members make
// them: the site starts each one as the member through Bridge's GitHub App, saves the files, and asks a lead or hands
// it off as the plan says (apps/docs-site/api/contribute action `seed-demo-explorations`, plan checks in
// api/_lib/demo-explorations.ts). This script only builds the plan from local clones and asks, with a GitHub token that
// administers the sample team's repository (the GitHub CLI's, or GH_TOKEN). Nothing is written without --apply, and an
// exploration already in its copy is not started again: running it again starts only what is missing. Its files that
// differ from the plan (or that its branch lacks) are saved as its member in one commit, the way their Claude session
// saves them; files that already say this write nothing. An item's `notes`
// ("Where it stands") are saved as its member, the way their Claude session saves them, on an exploration already
// there too: only its note file changes, and notes that already say this write nothing. An item's `screen` (the
// screen it changed, where its preview and its capture open: "/#/orders/12") is set as its member the same way, on an
// exploration already there too: only its description's Bridge block changes, and a screen it already shows writes
// nothing.
//
// The plan file (--plan, JSON):
//   { "items": [ { "clone": "../acme-prints-design", "branch": "explore/gift-wrap", "product": "prints",
//                  "member": "Sofia", "name": "Gift wrap at checkout", "purpose": "...", "useCase": "user-test",
//                  "state": "exploring" | "waiting-for-lead" | "done", "base": "main", "message": "...",
//                  "screen": "/#/orders/XGZFHY3Z",
//                  "notes": { "context": "...", "decisions": ["..."], "edgeCases": [ { "component": "Gift wrap",
//                             "state": "Long message", "covered": false, "note": "..." } ], "openQuestions": ["..."],
//                             "nextStep": "..." } } ] }
// `notes` takes the sections of core's NotesUpdate (exploration-notes.ts), each optional: lists add to the note,
// context and nextStep replace what it says.
// `clone` is a local git clone (relative to the plan file) with `branch` in it; the files the branch adds or changes
// against `base` (default main: git diff --name-only main...<branch>) are sent with their content. Deleted files and
// Bridge's own exploration note (.bridge/explorations/) are left out: the site writes the note when it starts it.
//
// An item's `overlay` (a folder relative to the plan file) adds its files on top of the branch's, at the same paths
// (`overlay/src/ui/Timeline.tsx` is saved as `src/ui/Timeline.tsx`): the next version of the exploration, without a
// commit in the clone. An item's `check: true` runs Bridge's library check on it as its member once its files are saved
// and records it (what the exploration page shows under "What this changes in the library"), as Studio runs it.
//
//   node scripts/seed-demo-explorations.mjs --plan explorations.json [--base https://bridge.floriangouloubi.com]   dry run
//   node scripts/seed-demo-explorations.mjs --plan explorations.json --apply [--base ...]                          does it
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TEAM = 'acme-design-demo/bridge-demo-ds';
/** Bridge writes the exploration note itself when it starts one. */
const NOTES_DIR = '.bridge/explorations/';

export function args(argv) {
  const o = { base: 'https://bridge.floriangouloubi.com', apply: false, plan: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') o.base = argv[++i].replace(/\/$/, '');
    else if (argv[i] === '--apply') o.apply = true;
    else if (argv[i] === '--plan') o.plan = argv[++i];
  }
  return o;
}

const git = (clone, a) => execFileSync('git', ['-C', clone, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

/** The files `branch` adds or changes against `base` in a local clone, with their content (text only). */
export function branchFiles(clone, branch, base = 'main') {
  const names = git(clone, ['diff', '--name-only', '--diff-filter=d', `${base}...${branch}`])
    .split('\n')
    .map((s) => s.trim())
    .filter((s) => s && !s.startsWith(NOTES_DIR));
  const files = [];
  const skipped = [];
  for (const path of names) {
    const content = execFileSync('git', ['-C', clone, 'show', `${branch}:${path}`], { maxBuffer: 64 * 1024 * 1024 });
    if (content.includes(0)) skipped.push(path);
    else files.push({ path, content: content.toString('utf8') });
  }
  return { files, skipped };
}

/** Every text file under a folder, with its path relative to it (forward slashes), sorted. */
export function overlayFiles(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else {
        const content = readFileSync(full);
        if (!content.includes(0)) out.push({ path: relative(dir, full).split(sep).join('/'), content: content.toString('utf8') });
      }
    }
  };
  walk(dir);
  return out;
}

/** The plan the site takes, from the plan file: each item's files read from its clone. */
export function buildPlan(planPath) {
  const raw = JSON.parse(readFileSync(planPath, 'utf8'));
  if (!Array.isArray(raw.items) || !raw.items.length) throw new Error(`${planPath} has no items.`);
  const dir = dirname(resolve(planPath));
  const skipped = [];
  const items = raw.items.map((it, i) => {
    if (typeof it.clone !== 'string' || typeof it.branch !== 'string') throw new Error(`Item ${i + 1}: give its clone (a local git clone) and its branch.`);
    const got = branchFiles(resolve(dir, it.clone), it.branch, it.base ?? 'main');
    for (const s of got.skipped) skipped.push(`${it.branch}: ${s} (not text)`);
    // The overlay's files win over the branch's at the same path.
    const over = typeof it.overlay === 'string' ? overlayFiles(resolve(dir, it.overlay)) : [];
    const files = [...got.files.filter((f) => !over.some((o) => o.path === f.path)), ...over];
    const rest = { ...it };
    delete rest.clone;
    delete rest.base;
    delete rest.overlay;
    return { ...rest, files };
  });
  return { plan: { items }, skipped };
}

function token() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('No GitHub token: sign in with `gh auth login` or set GH_TOKEN.');
  }
}

async function ask(base, plan, apply) {
  const res = await fetch(`${base}/api/contribute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Bridge-Contribute': '1', Origin: base, Authorization: `Bearer ${token()}` },
    body: JSON.stringify({ action: 'seed-demo-explorations', repo: TEAM, plan, ...(apply ? { apply: true } : {}) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`seed-demo-explorations failed (${res.status}): ${body.message ?? body.error ?? 'no answer'}`);
    for (const p of body.problems ?? []) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(body.dryRun ? 'Dry run: nothing written. Run again with --apply to do it.' : 'Done.');
  return body;
}

/** What happened to an item's notes, in the run's words. */
const NOTES_WORDS = { writes: 'writes its notes', same: 'notes already say this', saved: 'notes saved' };
/** What happened to an item's screen, in the run's words. */
const SCREEN_WORDS = { writes: 'sets its screen', same: 'already opens on its screen', saved: 'screen set' };
/** What happened to an item's library check, in the run's words. */
const CHECK_WORDS = { checks: 'checks it against the library', checked: 'checked against the library' };

export function printSeed(body) {
  if (!body.items.length) console.log('Nothing in the plan.');
  for (const i of body.items) {
    const now = i.error ? `FAILED: ${i.error}` : i.status === 'exists' ? (i.notes || i.screen || i.updates || i.check ? 'already there' : 'already there, left as it is') : body.dryRun ? `starts it, then ${i.state}` : `started #${i.pr} (${i.state})`;
    const notes = i.notes ? `, ${NOTES_WORDS[i.notes] ?? i.notes}` : '';
    const screen = i.screen ? `, ${SCREEN_WORDS[i.screen] ?? i.screen}` : '';
    const updates = i.updates ? `, ${body.dryRun ? 'updates' : 'updated'} ${i.updates} file${i.updates === 1 ? '' : 's'}` : '';
    const check = i.check ? `, ${CHECK_WORDS[i.check] ?? i.check}${typeof i.pieces === 'number' ? ` (${i.pieces} piece${i.pieces === 1 ? '' : 's'})` : ''}` : '';
    console.log(`${i.copy} ${i.branch}: as ${i.member}, ${i.files} file${i.files === 1 ? '' : 's'}, ${now}${updates}${notes}${screen}${check}${i.pr && i.error ? ` (#${i.pr})` : ''}`);
  }
}

async function main() {
  const { base, apply, plan: planPath } = args(process.argv.slice(2));
  if (!planPath) throw new Error('Say which plan: --plan <file.json>.');
  const { plan, skipped } = buildPlan(planPath);
  for (const s of skipped) console.log(`Left out: ${s}`);
  const body = await ask(base, plan, apply);
  printSeed(body);
  if (body.items.some((i) => i.error)) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
}
