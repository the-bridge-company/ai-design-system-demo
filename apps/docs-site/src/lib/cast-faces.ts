// One face per person, the same drawing on every surface. Pure: tested in cast-faces.test.ts.
//
// A surface that knows a person by name only (Library review's "Asked by", a conflict's ways, the lead banner, the
// home's lead rows) draws the face of lib/people.ts nameFace ("~sofia"), the seed every other surface uses for an email
// member. The people of the sample team are drawn by their cast seed (demo-cast.ts castFaceLogin), so the developer,
// a GitHub account (acme-malik), keeps one face whether a screen knows his login or only his name.
import { SAMPLE_CAST, castFaceLogin, type CastKey } from './demo-cast';
import { nameFace } from './people';

/** The face seed of each person of the sample team, in one place: castFaceLogin, by their short name. */
export const CAST_FACE_SEEDS: Readonly<Record<CastKey, string>> = Object.fromEntries(SAMPLE_CAST.map((p) => [p.key, castFaceLogin(p)])) as Record<CastKey, string>;

/**
 * The face seed of someone known by name only: on the sample team, a cast person's own seed (by name, any case); else
 * nameFace. Never the account a row came through: two designers who joined by email share the app's account.
 */
export function faceSeedForName(name: string, x: { sample?: boolean } = {}): string {
  if (x.sample) {
    const k = name.trim().toLowerCase();
    const cast = SAMPLE_CAST.find((p) => p.name.toLowerCase() === k);
    if (cast) return CAST_FACE_SEEDS[cast.key];
  }
  return nameFace(name);
}

/** Someone known by name only, as the faces (components/ds/studio/faces.tsx Who) draw them: login = their face seed. */
export function namedFace(name: string, x: { sample?: boolean } = {}): { login: string; name: string; avatar: null } {
  return { login: faceSeedForName(name, x), name, avatar: null };
}

/**
 * The seed a face is drawn from, when it is not the face seed itself: the developer's GitHub login (acme-malik) drew
 * long dark hair close to Dana's, so he is drawn from the seed of a clearly different face (short spiky hair and a
 * moustache). Ann's own seed drew dark hair framing her face like Dana's, the two near-identical at 24 to 40px (D15): she is
 * drawn from a seed with a dark ponytail and glasses: apart from Dana, at the cast's weight (a light-haired seed read washed
 * out next to the others at 24 to 40px). Only the drawing changes: logins, face seeds and every lookup stay the same.
 */
export const FACE_DRAWING_SEEDS: Readonly<Record<string, string>> = { 'acme-malik': 'malik-7', '~ann': 'ann-11' };

/** The seed to draw a face seed with (FACE_DRAWING_SEEDS), any case; itself otherwise. */
export const drawingSeed = (seed: string): string => FACE_DRAWING_SEEDS[seed.trim().toLowerCase()] ?? seed;
