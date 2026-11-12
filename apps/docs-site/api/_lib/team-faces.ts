// The team face map (docs/specs/avatar-customizer.md, section 8): the drawn faces people of a team saved, so every
// member's Studio draws them the same and keeps them apart. Rules: src/lib/team-faces.ts.
//
// Key (Upstash Redis, the same database as accounts and members):
//   bridge:team:faces:<repo>   { "<face seed>": { face, name, at } }  a face seed is a GitHub login, or `~name` for an
//                              email member (src/lib/people.ts nameFace). No expiry: the face is freed when its holder
//                              saves another one, leaves the team (dropped on read) or deletes their account.
import type { Redis } from './redis.js';
import { faceHolder, parseTeamFaces, type FaceRecipe, type TeamFaces } from '../../src/lib/team-faces.js';

export const teamFacesKey = (repo: string) => `bridge:team:faces:${repo.toLowerCase()}`;

/** The saved faces of a team ({} when none, or when the record is not readable). */
export async function getTeamFaces(redis: Redis, repo: string): Promise<TeamFaces> {
  const raw = await redis.cmd('GET', teamFacesKey(repo));
  if (typeof raw !== 'string') return {};
  try {
    return parseTeamFaces(JSON.parse(raw));
  } catch {
    return {};
  }
}

/**
 * Only the faces of people still on the team: an email member (`~name`) who left frees theirs (`seeds`: the email
 * members' seeds, lower case). A GitHub login's face stays: GitHub says who is on the team, the page drops the rest.
 */
export const facesOf = (faces: TeamFaces, seeds: ReadonlySet<string>): TeamFaces => Object.fromEntries(Object.entries(faces).filter(([s]) => !s.startsWith('~') || seeds.has(s)));

/**
 * Who already wears this face's hair style in one of `repos` (first claim wins), else null. `mine`: the person's own
 * seeds; `members`: per team, the seeds of the people on it (a saved face of someone who left never blocks).
 */
export async function takenIn(redis: Redis, repos: readonly string[], face: FaceRecipe, mine: readonly string[], members: (repo: string) => Promise<ReadonlySet<string> | null>): Promise<{ repo: string; name: string } | null> {
  for (const repo of repos) {
    const all = await getTeamFaces(redis, repo);
    const seeds = await members(repo);
    const holder = faceHolder(face, seeds ? facesOf(all, new Set([...seeds, ...mine.map((s) => s.toLowerCase())])) : all, mine);
    if (holder) return { repo, name: holder };
  }
  return null;
}

/** Writes the person's face under each of their seeds in each team, and drops it under `dropSeeds` (an old name). */
export async function putFace(redis: Redis, repos: readonly string[], seeds: readonly string[], name: string, face: FaceRecipe | null, at: number, dropSeeds: readonly string[] = []): Promise<void> {
  for (const repo of repos) {
    const faces = await getTeamFaces(redis, repo);
    for (const s of [...dropSeeds, ...seeds]) delete faces[s.toLowerCase()];
    if (face) for (const s of seeds) faces[s.toLowerCase()] = { face, name, at };
    if (Object.keys(faces).length) await redis.cmd('SET', teamFacesKey(repo), JSON.stringify(faces));
    else await redis.cmd('DEL', teamFacesKey(repo));
  }
}
