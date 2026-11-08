#!/usr/bin/env node
// Seeds the sample team's people (acme-design-demo/bridge-demo-ds: Dana, Ann, Malik, Leo, Sofia) as its email members,
// and Ann as the product manager of its Account app, on a Bridge site. Idempotent: run it again and only what differs
// changes. The site writes them through the store it uses for every team (apps/docs-site/api/_lib/demo-members.ts,
// api/contribute action `seed-demo`); this script only asks, with a GitHub token that administers the sample team's
// repository (the GitHub CLI's, or GH_TOKEN). No storage secret leaves the site.
//
//   node scripts/seed-demo-members.mjs [--base https://bridge.floriangouloubi.com]
import { execFileSync } from 'node:child_process';

export const TEAM = 'acme-design-demo/bridge-demo-ds';

function args(argv) {
  const o = { base: 'https://bridge.floriangouloubi.com' };
  for (let i = 0; i < argv.length; i++) if (argv[i] === '--base') o.base = argv[++i].replace(/\/$/, '');
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

async function main() {
  const { base } = args(process.argv.slice(2));
  const res = await fetch(`${base}/api/contribute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Bridge-Contribute': '1', Origin: base, Authorization: `Bearer ${token()}` },
    body: JSON.stringify({ action: 'seed-demo', repo: TEAM }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Seeding failed (${res.status}): ${body.message ?? body.error ?? 'no answer'}`);
    process.exit(1);
  }
  console.log(`Added: ${body.added.join(', ') || 'none'}`);
  console.log(`Updated: ${body.updated.join(', ') || 'none'}`);
  console.log(`Already there: ${body.kept.join(', ') || 'none'}`);
  console.log(`Account app product manager: ${body.pm === 'set' ? 'set to Ann' : 'already Ann'}`);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
