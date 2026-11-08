#!/usr/bin/env node
// Files the sample team's requests and suggestions again for its members (acme-design-demo/bridge-demo-ds), the way
// Bridge files them when an email member does: through Bridge's GitHub App, with a "Requested by <member> through
// Bridge." line. The old issues, opened by an account, are closed as not planned with a comment linking their
// replacement (never deleted), and a developer's pull request that closes one is pointed at the replacement. The site
// does the work (apps/docs-site/api/_lib/demo-refile.ts, api/contribute action `refile-demo`); this script only asks,
// with a GitHub token that administers the sample team's repository (the GitHub CLI's, or GH_TOKEN).
//
//   node scripts/refile-demo-items.mjs [--base https://bridge.floriangouloubi.com]           dry run: what it would do
//   node scripts/refile-demo-items.mjs --apply [--base https://bridge.floriangouloubi.com]   does it
import { execFileSync } from 'node:child_process';

export const TEAM = 'acme-design-demo/bridge-demo-ds';

function args(argv) {
  const o = { base: 'https://bridge.floriangouloubi.com', apply: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--base') o.base = argv[++i].replace(/\/$/, '');
    else if (argv[i] === '--apply') o.apply = true;
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

async function main() {
  const { base, apply } = args(process.argv.slice(2));
  const res = await fetch(`${base}/api/contribute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Bridge-Contribute': '1', Origin: base, Authorization: `Bearer ${token()}` },
    body: JSON.stringify({ action: 'refile-demo', repo: TEAM, ...(apply ? { apply: true } : {}) }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error(`Refiling failed (${res.status}): ${body.message ?? body.error ?? 'no answer'}`);
    process.exit(1);
  }
  console.log(body.dryRun ? 'Dry run: nothing written. Run again with --apply to do it.' : 'Done.');
  if (!body.items.length) console.log('Nothing to file again.');
  for (const i of body.items) {
    const relink = i.relink.length ? `, points ${i.relink.map((n) => `#${n}`).join(', ')} at it` : '';
    const now = body.dryRun ? (i.new ? `reuses #${i.new}` : 'files it again') : i.error ? `FAILED: ${i.error}` : `${i.reused ? 'reused' : 'filed'} #${i.new}, closed #${i.old} as not planned`;
    console.log(`#${i.old} ${i.title}: for ${i.member} (${i.why}), ${now}${relink}`);
  }
  for (const s of body.skipped) console.log(`Left as is: #${s.number} ${s.title} (${s.why})`);
  if (body.items.some((i) => i.error)) process.exit(1);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
});
