// Your face, the rules (lib/team-faces.ts): faces are checked part by part, a team never wears one hair style twice,
// a new member's seed is redrawn (seed#1, seed#2...) until its hair is free, first claim wins, the taken rule names
// the holder, and Shuffle never lands on a taken style or its look-alike.
import { describe, expect, it } from 'vitest';
import { FACE_PART_VARIANTS, faceRecipe } from '@bridge-ds/react/avatar-illustrated';
import {
  FACE_PART_COUNTS,
  HAIR_STYLES,
  LOOK_ALIKE_PAIRS,
  blockedHair,
  faceHolder,
  firstHairTiles,
  lookAlikesOf,
  parseFace,
  parseTeamFaces,
  shuffleFace,
  takenHair,
  teamDrawings,
  type FaceRecipe,
} from './team-faces';
import { FACE_DRAWING_SEEDS } from './cast-faces';
import { SAMPLE_CAST, castFaceLogin } from './demo-cast';

const hairOf = (seed: string) => faceRecipe(seed).hair;
const face = (hair: string, extra: Partial<FaceRecipe> = {}): FaceRecipe => ({ v: 1, hair, eyes: 'variant01', brows: 'variant07', nose: 'variant20', lips: 'variant14', body: 'variant03', glasses: null, beard: null, ...extra });

/** A seeded random, so Shuffle tests are repeatable. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('the parts', () => {
  it('match the DS drawings', () => {
    for (const [part, n] of Object.entries(FACE_PART_COUNTS)) {
      const variants = FACE_PART_VARIANTS[part as keyof typeof FACE_PART_COUNTS];
      expect(variants.filter((v) => v !== 'hat')).toHaveLength(n);
    }
    expect([...HAIR_STYLES].sort()).toEqual([...FACE_PART_VARIANTS.hair]);
  });

  it('parses a face, and refuses anything else', () => {
    expect(parseFace(face('hat', { glasses: 'variant11' }))).toEqual(face('hat', { glasses: 'variant11' }));
    expect(parseFace({ ...face('variant02'), glasses: undefined })).toEqual(face('variant02'));
    expect(parseFace({ ...face('variant64') })).toBeNull();
    expect(parseFace({ ...face('variant02'), eyes: 'variant06' })).toBeNull();
    expect(parseFace({ ...face('variant02'), beard: '<svg>' })).toBeNull();
    expect(parseFace({ ...face('variant02'), v: 2 })).toBeNull();
    expect(parseFace('variant02')).toBeNull();
  });

  it('keeps the look-alike list symmetric and on known styles', () => {
    for (const [a, b] of LOOK_ALIKE_PAIRS) {
      expect(HAIR_STYLES).toContain(a);
      expect(HAIR_STYLES).toContain(b);
      expect(lookAlikesOf(a).has(b)).toBe(true);
      expect(lookAlikesOf(b).has(a)).toBe(true);
    }
    expect(blockedHair(['variant21'])).toEqual(new Set(['variant21', ...lookAlikesOf('variant21')]));
  });
});

describe('teamDrawings', () => {
  it('draws everyone from their seed when the hair styles are free', () => {
    const d = teamDrawings({ people: [{ seed: '~dana', name: 'Dana' }, { seed: '~sofia', name: 'Sofia' }], hairOf });
    expect(d['~dana']).toEqual({ kind: 'seed', seed: '~dana', hair: 'variant02', name: 'Dana' });
    expect(d['~sofia']).toMatchObject({ kind: 'seed', seed: '~sofia' });
  });

  it('redraws a seed whose hair is taken: seed#1, seed#2... until it is free', () => {
    // A stub drawer: the two first draws of ~ana land on Dana's hair and on its look-alike.
    const hairs: Record<string, string> = { '~dana': 'variant02', '~ana': 'variant02', '~ana#1': 'variant37', '~ana#2': 'variant40' };
    const d = teamDrawings({ people: [{ seed: '~dana', name: 'Dana' }, { seed: '~ana', name: 'Ana' }], hairOf: (s) => hairs[s] ?? 'variant60' });
    expect(d['~ana']).toEqual({ kind: 'seed', seed: '~ana#2', hair: 'variant40', name: 'Ana' });
  });

  it('keeps faces once given: someone who joins later never changes an earlier face', () => {
    const hairs: Record<string, string> = { '~dana': 'variant02', '~ben': 'variant02', '~ben#1': 'variant10' };
    const before = teamDrawings({ people: [{ seed: '~dana', name: 'Dana' }], hairOf: (s) => hairs[s]! });
    const after = teamDrawings({ people: [{ seed: '~dana', name: 'Dana' }, { seed: '~ben', name: 'Ben' }], hairOf: (s) => hairs[s]! });
    expect(after['~dana']).toEqual(before['~dana']);
    expect(after['~ben']!.hair).toBe('variant10');
  });

  it('draws the real sample team apart, the cast kept as drawn', () => {
    const people = SAMPLE_CAST.map((p) => ({ seed: castFaceLogin(p), name: p.name }));
    const d = teamDrawings({ people, hairOf, fixed: FACE_DRAWING_SEEDS });
    expect(d['acme-malik']).toMatchObject({ kind: 'seed', seed: 'malik-7' });
    const hairs = Object.values(d).map((x) => x.hair);
    expect(new Set(hairs).size).toBe(hairs.length);
    for (const h of hairs) for (const o of hairs) if (h !== o) expect(lookAlikesOf(h).has(o)).toBe(false);
  });

  it('first claim wins: a later saved face with a taken hair is drawn here with the nearest free style, and says whose', () => {
    const saved = parseTeamFaces({
      '~leo': { face: face('variant20'), name: 'Leo', at: 1 },
      '~dana': { face: face('variant20', { glasses: 'variant01' }), name: 'Dana', at: 2 },
    });
    const d = teamDrawings({ people: [{ seed: '~dana', name: 'Dana' }, { seed: '~leo', name: 'Leo' }], saved, hairOf });
    expect(d['~leo']).toMatchObject({ kind: 'face', hair: 'variant20' });
    expect(d['~dana']).toMatchObject({ kind: 'face', lookAlikeOf: 'Leo' });
    expect(d['~dana']!.hair).not.toBe('variant20');
    expect(d['~dana']!.kind === 'face' && d['~dana']!.face.glasses).toBe('variant01');
  });

  it('ignores saved faces of people who left the team', () => {
    const saved = parseTeamFaces({ '~gone': { face: face('variant02'), name: 'Gone', at: 1 } });
    const d = teamDrawings({ people: [{ seed: '~dana', name: 'Dana' }], saved, hairOf });
    expect(d['~dana']).toMatchObject({ kind: 'seed', seed: '~dana', hair: 'variant02' });
  });
});

describe('the taken rule', () => {
  it('names who wears each style, never the person themselves', () => {
    const d = teamDrawings({ people: SAMPLE_CAST.map((p) => ({ seed: castFaceLogin(p), name: p.name })), hairOf, fixed: FACE_DRAWING_SEEDS });
    const taken = takenHair(d, '~dana');
    expect(taken.get(hairOf('~sofia'))).toBe('Sofia');
    expect(taken.has(hairOf('~dana'))).toBe(false);
    expect(taken.size).toBe(4);
  });

  it('refuses at save a hair style another member saved, naming them; one\'s own old face never blocks', () => {
    const saved = parseTeamFaces({ '~sofia': { face: face('variant32'), name: 'Sofia', at: 1 }, '~dana': { face: face('variant02'), name: 'Dana', at: 2 } });
    expect(faceHolder(face('variant32'), saved, ['~dana'])).toBe('Sofia');
    expect(faceHolder(face('variant02', { beard: 'variant01' }), saved, ['~dana'])).toBeNull();
    // A look-alike picked by hand is allowed.
    expect(faceHolder(face('variant35'), saved, ['~dana'])).toBeNull();
  });
});

describe('shuffleFace', () => {
  it('never draws a taken style nor its look-alike, nor the current one', () => {
    const blocked = blockedHair(['variant21', 'variant32', 'variant02']);
    const rand = rng(7);
    for (let i = 0; i < 500; i++) {
      const f = shuffleFace(rand, blocked, face('variant40'));
      expect(blocked.has(f.hair)).toBe(false);
      expect(f.hair).not.toBe('variant40');
      expect(parseFace(f)).toEqual(f);
    }
  });
});

describe('firstHairTiles', () => {
  it('shows the person\'s style and the taken ones among the first 16, in list order', () => {
    const tiles = firstHairTiles('variant40', new Map([['variant59', 'Leo'], ['hat', 'Ann']]));
    expect(tiles).toHaveLength(16);
    expect(tiles).toEqual(expect.arrayContaining(['variant40', 'variant59', 'hat']));
    expect(tiles).toEqual(HAIR_STYLES.filter((h) => tiles.includes(h)));
    expect(firstHairTiles('variant40', new Map(), true)).toHaveLength(64);
  });
});
