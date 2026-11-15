#!/usr/bin/env node
// Launch day, once (docs/BILLING.md): marks every team Bridge knows as a founding team. A founding team keeps
// everything it has at no cost, with no end date: it is never limited and never billed (api/_lib/billing.ts).
// Teams made in Bridge before the launch date count as founding anyway (their record carries the date); this mark is
// what covers a repository's team, which has no creation date of its own.
//
//   node --env-file=.env.prod scripts/billing-mark-founding.mjs                    dry run: lists the teams it found
//   node --env-file=.env.prod scripts/billing-mark-founding.mjs --apply            writes the marks
//   ... --team owner/repo [--team other/repo]                                      adds teams Redis does not know
//
// Where it looks (Upstash Redis): every team with email members, a team record, a kept name, a discovery setting,
// pending invites, or a GitHub team read by api/entry. Marks are SET NX: running it again changes nothing, and a mark
// is never removed. Env: KV_REST_API_URL + KV_REST_API_TOKEN (or the UPSTASH_ pair). Prints team keys only.

import { fileURLToPath } from 'node:url';

const TEAM = /^(?:[a-z0-9][a-z0-9-]{0,38}\/[a-z0-9._-]{1,100}|_team\/[a-f0-9]{16})$/;
export const foundingKey = (team) => `bridge:billing:founding:${team.toLowerCase()}`;

/** The key patterns that name a team, and how to read the team from a key. */
export const SOURCES = [
  { match: 'bridge:members:*', team: (k) => k.slice('bridge:members:'.length) },
  { match: 'bridge:team:name:*', team: (k) => k.slice('bridge:team:name:'.length) },
  { match: 'bridge:team:discovery:*', team: (k) => k.slice('bridge:team:discovery:'.length) },
  { match: 'bridge:invites:*', team: (k) => k.slice('bridge:invites:'.length) },
  { match: 'bridge:account:ghteams-of:*', team: (k) => k.slice('bridge:account:ghteams-of:'.length) },
];

/** Teams from key names: only well-formed team keys (counters and indexes that share a prefix are left out). */
export function teamsFromKeys(keys) {
  const out = new Set();
  for (const k of keys) {
    for (const s of SOURCES) {
      if (!k.startsWith(s.match.slice(0, -1))) continue;
      const t = s.team(k).toLowerCase();
      if (TEAM.test(t)) out.add(t);
    }
  }
  return out;
}

/** A Redis client over Upstash REST (cmd only). */
export function upstash(url, token, f = fetch) {
  return {
    async cmd(...args) {
      const r = await f(url.replace(/\/+$/, ''), { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(`redis: ${j.error ?? r.status}`);
      return j.result;
    },
  };
}

async function scan(redis, match) {
  const keys = [];
  let cursor = '0';
  do {
    const [next, batch] = await redis.cmd('SCAN', cursor, 'MATCH', match, 'COUNT', 1000);
    keys.push(...batch);
    cursor = String(next);
  } while (cursor !== '0');
  return keys;
}

/** Every team found, plus `extra`; with `apply`, a founding mark on each (SET NX). */
export async function markFounding(redis, { apply = false, extra = [], now = Date.now(), log = console.log } = {}) {
  const keys = [];
  for (const s of SOURCES) keys.push(...(await scan(redis, s.match)));
  const teams = teamsFromKeys(keys);
  // Team records: a team made in Bridge, under its key or the repository it was linked to.
  for (const k of await scan(redis, 'bridge:team:rec:*')) {
    try {
      const rec = JSON.parse(await redis.cmd('GET', k));
      const t = (rec?.repo ?? `_team/${rec?.id ?? ''}`).toLowerCase();
      if (TEAM.test(t)) teams.add(t);
    } catch {
      /* not a record */
    }
  }
  for (const t of extra) {
    const team = String(t).trim().toLowerCase();
    if (!TEAM.test(team)) throw new Error(`Not a team: "${t}" (owner/repo or _team/<id>).`);
    teams.add(team);
  }
  const list = [...teams].sort();
  let marked = 0;
  for (const team of list) {
    if (apply) {
      const r = await redis.cmd('SET', foundingKey(team), JSON.stringify({ at: new Date(now).toISOString(), by: 'launch' }), 'NX');
      if (r === 'OK') marked++;
      log(`${r === 'OK' ? 'marked ' : 'already'} ${team}`);
    } else log(`found   ${team}`);
  }
  log(apply ? `${marked} marked, ${list.length - marked} already founding.` : `${list.length} teams found. Add --apply to mark them.`);
  return list;
}

async function main() {
  const url = (process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL)?.trim();
  const token = (process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN)?.trim();
  if (!url || !token) {
    console.error('Set KV_REST_API_URL and KV_REST_API_TOKEN (vercel env pull).');
    process.exit(1);
  }
  const argv = process.argv.slice(2);
  const extra = argv.flatMap((a, i) => (a === '--team' && argv[i + 1] ? [argv[i + 1]] : []));
  await markFounding(upstash(url, token), { apply: argv.includes('--apply'), extra });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(`Failed: ${e?.message ?? e}`);
    process.exit(1);
  });
}
