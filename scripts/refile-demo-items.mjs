#!/usr/bin/env node
// Puts the sample team's work under its members (acme-design-demo/bridge-demo-ds), the way Bridge does it when an email
// member acts, through Bridge's GitHub App. The site does the work (apps/docs-site/api/_lib/demo-refile.ts, api/contribute
// actions `refile-demo` and `update-demo-branches`); this script only asks, with a GitHub token that administers the
// sample team's repository (the GitHub CLI's, or GH_TOKEN). Nothing is written without --apply.
//
// Requests and suggestions (default): each open one an account opened is filed again for a member, with a "Requested
// by <member> through Bridge." line. The old issue is closed as not planned with a comment linking its replacement
// (never deleted), and a developer's pull request that closes it is pointed at the replacement.
//
// Explorations (--update-branches): each open exploration of the design copies is brought up to date from its product
// as its member ("Bring it in" in Studio), so its activity says "<member> brought in the latest product".
//
//   node scripts/refile-demo-items.mjs [--update-branches] [--base https://bridge.floriangouloubi.com]   dry run
//   node scripts/refile-demo-items.mjs [--update-branches] --apply [--base ...]                          does it
import { execFileSync } from 'node:child_process';

export const TEAM = 'acme-design-demo/bridge-demo-ds';

function args(argv) {
  const o = { base: 'https://bridge.floriangouloubi.com', apply: false, branches: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') o.base = argv[++i].replace(/\/$/, '');
    else if (argv[i] === '--apply') o.apply = true;
    else if (argv[i] === '--update-branches') o.branches = true;
  }
  return o;
}

function token() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  try {
    return execFileSync('gh', ['auth', 'token'], { encoding: 'utf8' }).trim();
  } catch {
    throw new Error('No GitHub token: sign in with `gh auth login` or set GH_TOKEN.');
  }
}

async function ask(base, action, apply) {
  const res = await fetch(`${base}/api/contribute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Bridge-Contribute': '1', Origin: base, Authorization: `Bearer ${token()}` },
    body: JSON.stringify({ action, repo: TEAM, ...(apply ? { apply: true } : {}) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`${action} failed (${res.status}): ${body.message ?? body.error ?? 'no answer'}`);
    process.exit(1);
  }
  console.log(body.dryRun ? 'Dry run: nothing written. Run again with --apply to do it.' : 'Done.');
  return body;
}

function printRefile(body) {
  if (!body.items.length) console.log('Nothing to file again.');
  for (const i of body.items) {
    const relink = i.relink.length ? `, points ${i.relink.map((n) => `#${n}`).join(', ')} at it` : '';
    const now = body.dryRun ? (i.new ? `reuses #${i.new}` : 'files it again') : i.error ? `FAILED: ${i.error}` : `${i.reused ? 'reused' : 'filed'} #${i.new}, closed #${i.old} as not planned`;
    console.log(`#${i.old} ${i.title}: for ${i.member} (${i.why}), ${now}${relink}`);
  }
  for (const s of body.skipped) console.log(`Left as is: #${s.number} ${s.title} (${s.why})`);
}

function printBranches(body) {
  if (!body.items.length) console.log('No exploration to bring up to date.');
  for (const i of body.items) {
    const behind = i.behind === null ? 'unknown' : `${i.behind} behind`;
    const now = body.dryRun ? (i.behind ? 'brings in the latest product' : 'already up to date') : i.error ? `FAILED: ${i.error}` : i.done === 'merged' ? 'brought in the latest product' : 'already up to date';
    console.log(`${i.copy}#${i.pull} ${i.branch}: as ${i.member}, ${behind}, ${now}`);
  }
  for (const s of body.skipped) console.log(`Left as is: ${s.copy}${s.pull ? `#${s.pull}` : ''} (${s.why})`);
}

async function main() {
  const { base, apply, branches } = args(process.argv.slice(2));
  const body = await ask(base, branches ? 'update-demo-branches' : 'refile-demo', apply);
  (branches ? printBranches : printRefile)(body);
  if (body.items.some((i) => i.error)) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
