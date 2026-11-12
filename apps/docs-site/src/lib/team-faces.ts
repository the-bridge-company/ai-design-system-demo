// Your face (docs/specs/avatar-customizer.md): one drawn face per person, never a teammate's. Pure: no DOM, no
// storage, no drawing (the drawings are the DS's @bridge-ds/react/avatar-illustrated, loaded by the page), covered by
// team-faces.test.ts. The server (api/_lib/team-faces.ts, api/account `face`) and the page (scripts/team-faces.ts,
// components/ds/studio/FaceSetting.tsx) share these rules.
//
// What "the same face" means: at the sizes people see faces (20 to 24px in rows), identity is the hair. Two people of a
// team never wear the same hair style; Bridge's own picks (Shuffle, a new member's face) also avoid the look-alikes of
// a taken style. A person may still pick a look-alike by hand (allowed silently).
import type { FaceRecipe } from '@bridge-ds/react/avatar-illustrated';

export type { FaceRecipe };

/** How many variants each part has (the DS drawings, avatar-illustrated FACE_PART_VARIANTS; a test keeps them equal). */
export const FACE_PART_COUNTS = { hair: 63, eyes: 5, brows: 13, nose: 20, lips: 30, body: 25, glasses: 11, beard: 12 } as const;
type CountedPart = keyof typeof FACE_PART_COUNTS;

/** `variant07` for 7. */
export const variant = (n: number): string => `variant${String(n).padStart(2, '0')}`;

/** Every hair style: 63 drawn ones and the hat (64). */
export const HAIR_STYLES: readonly string[] = [...Array.from({ length: FACE_PART_COUNTS.hair }, (_, i) => variant(i + 1)), 'hat'];

const isVariant = (part: CountedPart, v: unknown): v is string => {
  if (part === 'hair' && v === 'hat') return true;
  const m = typeof v === 'string' ? /^variant(\d{2})$/.exec(v) : null;
  return Boolean(m && Number(m[1]) >= 1 && Number(m[1]) <= FACE_PART_COUNTS[part]);
};

/** A face from the network or storage, checked part by part; null when it is not one. */
export function parseFace(raw: unknown): FaceRecipe | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.v !== 1) return null;
  for (const p of ['hair', 'eyes', 'brows', 'nose', 'lips', 'body'] as const) if (!isVariant(p, r[p])) return null;
  for (const p of ['glasses', 'beard'] as const) if (r[p] !== null && r[p] !== undefined && !isVariant(p, r[p])) return null;
  return { v: 1, hair: r.hair as string, eyes: r.eyes as string, brows: r.brows as string, nose: r.nose as string, lips: r.lips as string, body: r.body as string, glasses: (r.glasses as string | null) ?? null, beard: (r.beard as string | null) ?? null };
}

export const sameFace = (a: FaceRecipe | null | undefined, b: FaceRecipe | null | undefined): boolean =>
  Boolean(a && b) && (['hair', 'eyes', 'brows', 'nose', 'lips', 'body', 'glasses', 'beard'] as const).every((k) => a![k] === b![k]);

/**
 * Hair styles that read the same at 20px: hair-only drawings on one fixed face, rendered at 20px on the Harbor surface,
 * mean grey distance under 0.02 (measured once, 66 pairs of 2,016), plus the pairs a designer judged too close by eye
 * (variant02 and variant37: Dana and the developer's first drawing on the sample team).
 */
export const LOOK_ALIKE_PAIRS: readonly (readonly [string, string])[] = (
  [
    [27, 35], [16, 25], [21, 26], [6, 34], [55, 56], [49, 50], [21, 32], [25, 34], [24, 25], ['hat', 42], [44, 55], [13, 22],
    [16, 24], [5, 38], [6, 49], [53, 55], [21, 53], [18, 26], [21, 35], [15, 49], [6, 50], [5, 30], [15, 56], [15, 34],
    [21, 27], [27, 34], [6, 25], [6, 24], [7, 38], [13, 54], [34, 49], [24, 34], [52, 55], [18, 34], [18, 56], [7, 34],
    [6, 7], [44, 56], [44, 53], [53, 56], [22, 25], [34, 35], [32, 44], [21, 34], [26, 32], [5, 7], [31, 49], [52, 54],
    [13, 16], [15, 18], [18, 21], [6, 35], [24, 49], [25, 50], [12, 22], [7, 40], [21, 56], [6, 27], [13, 35], [34, 56],
    [7, 13], [15, 24], [19, 34], [15, 25], [34, 50], [29, 50],
    // Reviewed by eye.
    [2, 37],
  ] as const
).map(([a, b]) => [typeof a === 'number' ? variant(a) : a, variant(b)] as const);

const NEAR = new Map<string, Set<string>>();
for (const [a, b] of LOOK_ALIKE_PAIRS) {
  if (!NEAR.has(a)) NEAR.set(a, new Set());
  if (!NEAR.has(b)) NEAR.set(b, new Set());
  NEAR.get(a)!.add(b);
  NEAR.get(b)!.add(a);
}

/** The hair styles that read like `hair` at 20px (not itself). */
export const lookAlikesOf = (hair: string): ReadonlySet<string> => NEAR.get(hair) ?? new Set();

/** The styles Bridge's own picks skip: every taken style and its look-alikes. */
export function blockedHair(taken: Iterable<string>): Set<string> {
  const out = new Set<string>();
  for (const h of taken) {
    out.add(h);
    for (const x of lookAlikesOf(h)) out.add(x);
  }
  return out;
}

/** A saved face as the team keeps it: the face, the holder's name (to say "Taken by Sofia"), when it was saved. */
export interface TeamFace {
  face: FaceRecipe;
  name: string;
  at: number;
}

/** The team face map: face seed (a login, or `~name` for an email member) to their saved face. */
export type TeamFaces = Record<string, TeamFace>;

/** A team face map from the network or storage; entries that are not faces are dropped. */
export function parseTeamFaces(raw: unknown): TeamFaces {
  const out: TeamFaces = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [seed, v] of Object.entries(raw as Record<string, unknown>)) {
    const e = v as { face?: unknown; name?: unknown; at?: unknown } | null;
    const face = parseFace(e?.face);
    if (face && typeof e?.name === 'string') out[seed.toLowerCase()] = { face, name: e.name, at: typeof e.at === 'number' ? e.at : 0 };
  }
  return out;
}

/** How someone of a team is drawn: their own face (saved), or a seed's drawing. */
export type Drawing = { kind: 'face'; face: FaceRecipe; hair: string; name: string; lookAlikeOf?: string } | { kind: 'seed'; seed: string; hair: string; name: string };

/** How many redraws a new member's seed gets (seed#1, seed#2...) before Bridge keeps the seed as it is. */
export const MAX_REDRAWS = 64;

/**
 * Every person of a team, drawn apart (spec 6.4). `people`: the team in the order they joined (first claim wins);
 * `saved`: the team face map; `hairOf`: the hair a seed draws (the DS faceRecipe); `fixed`: seeds always drawn from
 * another seed (the sample team's cast, lib/cast-faces FACE_DRAWING_SEEDS).
 *   1. Saved faces claim their hair, earliest first. A later one with a hair already taken (a face saved in another
 *      team) is drawn here with the nearest free style, and says who it looks like.
 *   2. Fixed seeds claim theirs.
 *   3. Everyone else: their seed, else seed#1, seed#2... until the hair is neither taken nor a look-alike of a taken one.
 */
export function teamDrawings(x: { people: readonly { seed: string; name: string }[]; saved?: TeamFaces; hairOf: (seed: string) => string; fixed?: Readonly<Record<string, string>> }): Record<string, Drawing> {
  const saved = x.saved ?? {};
  const out: Record<string, Drawing> = {};
  const taken = new Map<string, string>();
  const names = new Map(x.people.map((p) => [p.seed.toLowerCase(), p.name]));
  const savedSeeds = Object.keys(saved)
    .filter((s) => names.has(s))
    .sort((a, b) => saved[a]!.at - saved[b]!.at || a.localeCompare(b));
  for (const seed of savedSeeds) {
    const { face } = saved[seed]!;
    const name = names.get(seed)!;
    const holder = taken.get(face.hair);
    if (!holder) {
      taken.set(face.hair, name);
      out[seed] = { kind: 'face', face, hair: face.hair, name };
      continue;
    }
    const hair = nearestFree(face.hair, blockedHair(taken.keys())) ?? face.hair;
    taken.set(hair, name);
    out[seed] = { kind: 'face', face: { ...face, hair }, hair, name, lookAlikeOf: holder };
  }
  const rest = x.people.filter((p) => !out[p.seed.toLowerCase()]);
  for (const p of rest) {
    const seed = p.seed.toLowerCase();
    const fixed = x.fixed?.[seed];
    if (!fixed) continue;
    const hair = x.hairOf(fixed);
    taken.set(hair, p.name);
    out[seed] = { kind: 'seed', seed: fixed, hair, name: p.name };
  }
  for (const p of rest) {
    const seed = p.seed.toLowerCase();
    if (out[seed]) continue;
    const blocked = blockedHair(taken.keys());
    let pick = { seed: p.seed, hair: x.hairOf(p.seed) };
    for (let n = 1; blocked.has(pick.hair) && n <= MAX_REDRAWS; n++) {
      const next = `${p.seed}#${n}`;
      const hair = x.hairOf(next);
      if (!blocked.has(hair)) pick = { seed: next, hair };
    }
    taken.set(pick.hair, p.name);
    out[seed] = { kind: 'seed', seed: pick.seed, hair: pick.hair, name: p.name };
  }
  return out;
}

/** The free style closest to `hair` in the list (next ones first), or null when every style is taken. */
function nearestFree(hair: string, blocked: ReadonlySet<string>): string | null {
  const i = Math.max(0, HAIR_STYLES.indexOf(hair));
  for (let d = 1; d < HAIR_STYLES.length; d++) {
    for (const j of [i + d, i - d]) {
      const h = HAIR_STYLES[(j + HAIR_STYLES.length) % HAIR_STYLES.length]!;
      if (!blocked.has(h)) return h;
    }
  }
  return null;
}

/** The hair styles worn by the team except `me` (seed), each with who wears it: "Taken by Sofia". */
export function takenHair(drawings: Readonly<Record<string, Drawing>>, me: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [seed, d] of Object.entries(drawings)) if (seed !== me.toLowerCase() && !out.has(d.hair)) out.set(d.hair, d.name);
  return out;
}

/**
 * The server's rule at save (409 face_taken): who of the team already wears this hair style, else null. `saved`: the
 * team face map; `others`: the seeds of the rest of the team, drawn from their seed (their hair by `hairOf`), when known;
 * `mine`: the person's own seeds (their old face never blocks the new one).
 */
export function faceHolder(face: FaceRecipe, saved: TeamFaces, mine: readonly string[]): string | null {
  const own = new Set(mine.map((s) => s.toLowerCase()));
  for (const [seed, e] of Object.entries(saved)) if (!own.has(seed) && e.face.hair === face.hair) return e.name;
  return null;
}

/** Four expressions that set the eyes, brows and lips together. */
export const EXPRESSIONS = [
  { value: 'calm', label: 'Calm', parts: { eyes: variant(1), brows: variant(7), lips: variant(14) } },
  { value: 'smile', label: 'Smile', parts: { eyes: variant(3), brows: variant(2), lips: variant(23) } },
  { value: 'curious', label: 'Curious', parts: { eyes: variant(5), brows: variant(11), lips: variant(6) } },
  { value: 'focused', label: 'Focused', parts: { eyes: variant(2), brows: variant(13), lips: variant(9) } },
] as const;

/** The expression a face shows, when it is one of the four. */
export const expressionOf = (f: FaceRecipe): string | undefined => EXPRESSIONS.find((e) => e.parts.eyes === f.eyes && e.parts.brows === f.brows && e.parts.lips === f.lips)?.value;

/**
 * A new face at random: every part, glasses one time in four, a beard one time in seven, and never a hair style of
 * `blocked` (taken styles and their look-alikes, blockedHair). `rand` returns [0, 1).
 */
export function shuffleFace(rand: () => number, blocked: ReadonlySet<string>, current?: FaceRecipe | null): FaceRecipe {
  const pick = (n: number) => variant(1 + Math.floor(rand() * n));
  const free = HAIR_STYLES.filter((h) => !blocked.has(h) && h !== current?.hair);
  const pool = free.length ? free : HAIR_STYLES;
  return {
    v: 1,
    hair: pool[Math.floor(rand() * pool.length)]!,
    eyes: pick(FACE_PART_COUNTS.eyes),
    brows: pick(FACE_PART_COUNTS.brows),
    nose: pick(FACE_PART_COUNTS.nose),
    lips: pick(FACE_PART_COUNTS.lips),
    body: pick(FACE_PART_COUNTS.body),
    glasses: rand() < 0.25 ? pick(FACE_PART_COUNTS.glasses) : null,
    beard: rand() < 0.15 ? pick(FACE_PART_COUNTS.beard) : null,
  };
}

/** How many hair tiles show before "Show all 64 styles". */
export const HAIR_FIRST = 16;

/**
 * The hair tiles shown first: the person's own style, the taken ones (so the rule shows), then free ones in order,
 * HAIR_FIRST in all, sorted back into the list's order so the grid does not jump.
 */
export function firstHairTiles(mine: string, taken: ReadonlyMap<string, string>, all = false): string[] {
  if (all) return [...HAIR_STYLES];
  const picked = new Set<string>([mine, ...[...taken.keys()].slice(0, HAIR_FIRST / 2)]);
  for (const h of HAIR_STYLES) {
    if (picked.size >= HAIR_FIRST) break;
    picked.add(h);
  }
  return HAIR_STYLES.filter((h) => picked.has(h));
}

export const FACE_WORDS = {
  bandTitle: 'Your face',
  bandIntro: 'How your team sees you next to your work, in every team you are in.',
  drawnLabel: 'Drawn face',
  drawnHelp: 'Made from your name. No photo needed.',
  photoLabel: 'Photo',
  photoHelp: 'From GitHub. It shows instead of a drawing.',
  openHelp: (team: string) => `Shuffle until it feels like you. Nobody in ${team} gets the same face.`,
  change: 'Change',
  preview: 'Your drawn face',
  strip: 'Next to your team, at the size of a review row',
  you: 'You',
  shuffle: 'Shuffle',
  pickParts: 'Pick the parts yourself',
  parts: 'Parts of your face',
  tabs: { hair: 'Hair', glasses: 'Glasses', beard: 'Beard', expression: 'Expression' },
  takenRule: 'Styles a teammate wears are taken.',
  showAll: (n: number) => `Show all ${n} styles`,
  takenBy: (name: string) => `Taken by ${name}`,
  takenByShort: (name: string) => `taken by ${name}`,
  expressionHelp: 'Shows from 40px up: in rows your hair does the talking.',
  save: 'Save face',
  cancel: 'Cancel',
  saved: 'Saved. Your team sees your new face.',
  savedSample: 'Saved in this browser only: Acme Design is a sample team.',
  savedLocal: 'Saved in this browser. Sign in to show it to your team.',
  newFace: (words: string) => `New face: ${words}.`,
  lookAlike: (name: string, team: string) => `Your face looks like ${name}'s in ${team}. Shuffle for one that works in all your teams.`,
  failed: 'Bridge did not save your face. Try again.',
} as const;
