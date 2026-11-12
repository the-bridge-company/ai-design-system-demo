// One face per person on every surface (docs/specs/avatar-customizer.md, section 9), in the browser. Every surface
// that draws a face (components/ds/studio/faces.tsx Who, scripts/people.ts, scripts/avatar.ts, the account menu) asks
// faceUri(seed) here instead of drawing the seed itself, so a saved face, and the distinct face Bridge gives a new
// member (lib/team-faces.ts teamDrawings), show everywhere without surface-by-surface work.
//   - A real team: the team face map of its last members read (GET /api/contribute?members=1 `faces`, noted by
//     scripts/contribute-session.ts), kept per team in this browser (`bridge.faces.<team>`) for the next first paint.
//   - The person's own saved face (`bridge.face`, a copy of their account's), for the first paint and for a page that
//     has not read its team yet.
//   - The sample team: the cast, drawn as always (lib/cast-faces FACE_DRAWING_SEEDS); a visitor's saved face for the
//     person they play stays in this browser only (`bridge.face.sample.<cast key>`).
// `bridge:faces` tells mounted faces to draw again. Every storage call is wrapped: a blocked storage draws seeds.
import { FACE_DRAWING_SEEDS, drawingSeed } from '../lib/cast-faces';
import { SAMPLE_CAST, castFaceLogin, type CastKey } from '../lib/demo-cast';
import { isSampleTeam } from '../lib/demo';
import { parseFace, parseTeamFaces, teamDrawings, type Drawing, type FaceRecipe, type TeamFaces } from '../lib/team-faces';
import { emailMemberFace } from '../lib/people';
import { pageTeam } from './ai-tools';

export const FACES_EVENT = 'bridge:faces';
const TEAM_KEY = 'bridge.faces.';
export const MY_FACE_KEY = 'bridge.face';
const SAMPLE_KEY = 'bridge.face.sample.';

/** The drawer of @bridge-ds/react/avatar-illustrated, loaded by the page. */
export interface FaceDrawer {
  illustratedAvatarUri(seed: string): string;
  illustratedFaceUri(recipe: FaceRecipe): string;
  faceRecipe(seed: string): FaceRecipe;
}

/** What Bridge knows of a team's faces: the saved ones, and its people in the order they joined. */
export interface TeamFaceData {
  saved: TeamFaces;
  people: { seed: string; name: string }[];
}

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function put(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Storage blocked: this page still draws what it read.
  }
}

const parseJson = (raw: string | null): unknown => {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

function announce(): void {
  drawn = null;
  if (typeof document !== 'undefined') document.dispatchEvent(new CustomEvent(FACES_EVENT));
}

/** The team of this page as the face map knows it: a real team, or the sample team. */
function facesTeam(): string | null {
  const team = pageTeam();
  if (team) return team.toLowerCase();
  return null;
}

/** The sample team's people: the cast, in the order the sample team lists them. */
export const SAMPLE_PEOPLE = SAMPLE_CAST.map((p) => ({ seed: castFaceLogin(p), name: p.name }));

/** A team's faces as this browser kept them. */
export function knownTeamFaces(team: string): TeamFaceData {
  if (isSampleTeam(team)) {
    const saved: TeamFaces = {};
    for (const p of SAMPLE_CAST) {
      const face = parseFace(parseJson(get(SAMPLE_KEY + p.key)));
      if (face) saved[castFaceLogin(p).toLowerCase()] = { face, name: p.name, at: 0 };
    }
    return { saved, people: SAMPLE_PEOPLE };
  }
  const raw = parseJson(get(TEAM_KEY + team.toLowerCase())) as { saved?: unknown; people?: unknown } | null;
  const people = Array.isArray(raw?.people) ? raw!.people.filter((p): p is { seed: string; name: string } => Boolean(p && typeof p.seed === 'string' && typeof p.name === 'string')) : [];
  return { saved: parseTeamFaces(raw?.saved), people };
}

/** Notes the faces of a team read (GET ?members=1): kept for the next first paint, and every face draws again. */
export function rememberTeamFaces(team: string, data: TeamFaceData): void {
  if (isSampleTeam(team)) return;
  const next = JSON.stringify({ saved: data.saved, people: data.people });
  if (get(TEAM_KEY + team.toLowerCase()) === next) return;
  put(TEAM_KEY + team.toLowerCase(), next);
  announce();
}

/** The person's own saved face and the seeds it is drawn by, as this browser keeps them. */
export function myFace(): { face: FaceRecipe; seeds: string[]; name: string } | null {
  const raw = parseJson(get(MY_FACE_KEY)) as { face?: unknown; seeds?: unknown; name?: unknown } | null;
  const face = parseFace(raw?.face);
  const seeds = Array.isArray(raw?.seeds) ? raw!.seeds.filter((s): s is string => typeof s === 'string') : [];
  return face && seeds.length ? { face, seeds, name: typeof raw?.name === 'string' ? raw.name : '' } : null;
}

/** Keeps the person's face in this browser (a copy of the account's), or forgets it (null). */
export function rememberMyFace(x: { face: FaceRecipe; seeds: string[]; name: string } | null): void {
  const next = x ? JSON.stringify({ face: x.face, seeds: x.seeds.map((s) => s.toLowerCase()), name: x.name }) : null;
  if (get(MY_FACE_KEY) === next) return;
  put(MY_FACE_KEY, next);
  announce();
}

/** The seeds a signed-in person is drawn by: their name (as an email member), and their GitHub login once linked. */
export const accountFaceSeeds = (a: { name: string | null; email: string; github: { login: string } | null }): string[] => [emailMemberFace(a.name, a.email), ...(a.github ? [a.github.login.toLowerCase()] : [])];

/** Keeps the copy of a signed-in account's face (lib/account.ts Account.face) in step with what the server said. */
export function noteAccountFace(a: { name: string | null; email: string; github: { login: string } | null; face?: FaceRecipe | null }): void {
  rememberMyFace(a.face ? { face: a.face, seeds: accountFaceSeeds(a), name: a.name ?? a.email.split('@')[0]! } : null);
}

/** The face the visitor saved for a person of the sample team, in this browser only (null: drawn as the cast is). */
export function saveSampleFace(key: CastKey, face: FaceRecipe | null): void {
  put(SAMPLE_KEY + key, face ? JSON.stringify(face) : null);
  announce();
}

/**
 * Everyone of `team` drawn apart (lib/team-faces.ts teamDrawings): the team's saved faces, the person's own face
 * when the team map does not have it yet, the cast as drawn on the sample team.
 */
export function drawingsOf(team: string, hairOf: (seed: string) => string, data: TeamFaceData = knownTeamFaces(team)): Record<string, Drawing> {
  const saved = { ...data.saved };
  const mine = isSampleTeam(team) ? null : myFace();
  const people = [...data.people];
  if (mine) {
    for (const s of mine.seeds) if (!saved[s]) saved[s] = { face: mine.face, name: mine.name, at: Number.MAX_SAFE_INTEGER };
    if (!people.some((p) => mine.seeds.includes(p.seed.toLowerCase()))) people.push({ seed: mine.seeds[0]!, name: mine.name });
  }
  return teamDrawings({ people, saved, hairOf, fixed: isSampleTeam(team) ? FACE_DRAWING_SEEDS : undefined });
}

function canDrawRecipes(m: FaceDrawer): boolean {
  try {
    return typeof m.faceRecipe === 'function' && typeof m.illustratedFaceUri === 'function';
  } catch {
    return false;
  }
}

let drawn: { team: string | null; map: Record<string, Drawing> } | null = null;

function currentDrawings(m: FaceDrawer): Record<string, Drawing> {
  const team = facesTeam();
  if (drawn && drawn.team === team) return drawn.map;
  // A drawer without recipes (an older DS build): every face is its seed's.
  if (!canDrawRecipes(m)) return {};
  const hairOf = (s: string) => m.faceRecipe(s).hair;
  let map: Record<string, Drawing> = {};
  if (team) map = drawingsOf(team, hairOf);
  else {
    // No team on this page: the person's own face only.
    const mine = myFace();
    if (mine) for (const s of mine.seeds) map[s] = { kind: 'face', face: mine.face, hair: mine.face.hair, name: mine.name };
  }
  drawn = { team, map };
  return map;
}

/** The face of a seed (a login, or `~name`), as this page draws it: saved, made distinct, or the seed's own. */
export function faceUri(m: FaceDrawer, seed: string): string {
  const d = currentDrawings(m)[seed.trim().toLowerCase()];
  if (d?.kind === 'face') return m.illustratedFaceUri(d.face);
  return m.illustratedAvatarUri(d?.kind === 'seed' ? d.seed : drawingSeed(seed));
}

/** Forgets what this page drew, for tests. */
export function forgetDrawings(): void {
  drawn = null;
}
