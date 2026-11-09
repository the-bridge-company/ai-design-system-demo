#!/usr/bin/env node
// Private shots: captures of the explorations of private design copies, kept by Bridge (apps/docs-site/api/_lib/
// private-shots.ts) instead of a public branch. Run by .github/workflows/private-shots.yml in Bridge's own repository:
//
//   node scripts/private-shots.mjs [--base https://bridge.floriangouloubi.com] [--dry-run] [--force]
//   node scripts/private-shots.mjs --migrate [--dry-run]
//
// Asks Bridge which explorations need a capture (GET /api/contribute?shots=todo), fills each preview template with
// @bridge-ds/core previewUrl (the branch, as the host names it), captures it with scripts/preview-shots.mjs captureOne
// and sends the webp back (POST ?shots=put). An exploration that chose its screen (core Exploration.screen, the job's
// `screen`) is captured on that screen (captureTarget), nowhere else; Bridge asks again when another one is chosen. Both calls carry this workflow's GitHub OIDC token (audience
// bridge-shots): no stored secret. A preview that is not up yet, or that answers a sign-in page, is skipped and asked
// again on the next run.
//
// --migrate (once, 2026-11-08): asks Bridge to move the images it still keeps in Redis to its private Blob store and to
// delete the stored images no capture names (POST ?shots=migrate, dry=1 with --dry-run), and prints what it moved and
// freed. Safe to run again: a second run moves nothing.
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { atScreen, captureOne, launch, screenOf } from './preview-shots.mjs';

export const AUDIENCE = 'bridge-shots';

/** The GitHub Actions OIDC token for Bridge, from the runner's request URL and token. */
export async function oidcToken(env = process.env, f = fetch) {
  const url = env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const bearer = env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !bearer) throw new Error('No OIDC token: the workflow needs permissions: id-token: write.');
  const res = await f(`${url}&audience=${AUDIENCE}`, { headers: { authorization: `Bearer ${bearer}` } });
  if (!res.ok) throw new Error(`OIDC token request answered ${res.status}`);
  return (await res.json()).value;
}

/** A page that is a host's sign-in or "not found" page, never the product: not kept. */
export function looksLikeAWall(finalUrl) {
  try {
    const u = new URL(finalUrl);
    return /(^|\.)vercel\.com$/.test(u.hostname) || /\/login|\/sso|cdn-cgi\/access/.test(u.pathname);
  } catch {
    return true;
  }
}

function args(argv) {
  const o = { base: 'https://bridge.floriangouloubi.com', dryRun: false, force: false, migrate: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') o.base = argv[++i].replace(/\/$/, '');
    else if (argv[i] === '--dry-run') o.dryRun = true;
    else if (argv[i] === '--force') o.force = true;
    else if (argv[i] === '--migrate') o.migrate = true;
  }
  return o;
}

/**
 * Where to capture one job and how: the exploration's own screen on its preview when it chose one (no guessing then),
 * else the preview root with the changed files' names as hints.
 */
export function captureTarget(url, job) {
  const screen = screenOf(job.screen);
  if (screen) return { url: atScreen(url, screen), options: { crawl: false, hints: [] }, at: screen };
  return { url, options: { hints: job.hints ?? [] }, at: null };
}

/** What a migration answer says, in one line per figure. */
export function migrationReport(r) {
  const kb = (n) => `${Math.round((n ?? 0) / 1024)} KB`;
  return [
    `${r.dryRun ? 'Dry run: nothing changed.' : 'Migration done.'}`,
    `- ${r.keys} capture(s) indexed in Redis, ${r.inStore} already in the Blob store`,
    `- ${r.moved} image(s) ${r.dryRun ? 'to move' : 'moved'} to the Blob store, ${kb(r.redisBytesFreed)} of Redis ${r.dryRun ? 'to free' : 'freed'}`,
    `- ${r.orphansDeleted} stored image(s) no capture names ${r.dryRun ? 'to delete' : 'deleted'} (${kb(r.orphanBytes)})`,
  ].join('\n');
}

async function migrate(o) {
  const token = await oidcToken();
  const res = await fetch(`${o.base}/api/contribute?shots=migrate${o.dryRun ? '&dry=1' : ''}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, accept: 'application/json' } });
  if (!res.ok) throw new Error(`Bridge answered ${res.status} to the migration: ${await res.text()}`);
  console.log(migrationReport(await res.json()));
}

async function main() {
  const o = args(process.argv.slice(2));
  if (o.migrate) return migrate(o);
  const require = createRequire(resolve(process.env.BRIDGE_DEPS ?? '.', 'package.json'));
  const core = await import(pathToFileURL(require.resolve('@bridge-ds/core')).href);
  const token = await oidcToken();
  const auth = { authorization: `Bearer ${token}` };
  const todo = await fetch(`${o.base}/api/contribute?shots=todo${o.force ? '&force=1' : ''}`, { headers: { ...auth, accept: 'application/json' } });
  if (!todo.ok) throw new Error(`Bridge answered ${todo.status} to the todo list: ${await todo.text()}`);
  const { jobs = [] } = await todo.json();
  console.log(`${jobs.length} exploration(s) to capture.`);
  if (!jobs.length) return;
  const browser = await launch();
  let kept = 0;
  try {
    for (const j of jobs) {
      const url = core.previewUrl(j.template, { branch: j.branch, pr: j.pr, sha: j.sha });
      if (!url) {
        console.log(`- ${j.repo}#${j.pr}: no preview address from ${j.template}`);
        continue;
      }
      try {
        const target = captureTarget(url, j);
        const shot = await captureOne(browser, target.url, target.options);
        if (looksLikeAWall(new URL(shot.route, url).href)) {
          console.log(`- ${j.repo}#${j.pr}: ${url} asks to sign in, skipped`);
          continue;
        }
        if (o.dryRun) {
          console.log(`- ${j.repo}#${j.pr}: captured ${target.url} (dry run, not sent)`);
          continue;
        }
        const put = await fetch(`${o.base}/api/contribute?shots=put`, {
          method: 'POST',
          headers: { ...auth, 'content-type': 'application/json' },
          body: JSON.stringify({ repo: j.repo, pr: j.pr, sha: j.sha, url, route: shot.route, screen: shot.screen, ...(target.at ? { at: target.at } : {}), image: Buffer.from(shot.webp).toString('base64') }),
        });
        console.log(`- ${j.repo}#${j.pr}: ${put.ok ? 'kept' : `refused (${put.status})`} ${target.url}`);
        if (put.ok) kept++;
      } catch (e) {
        console.log(`- ${j.repo}#${j.pr}: ${url} could not be captured (${e.message})`);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`${kept} capture(s) kept by Bridge.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
