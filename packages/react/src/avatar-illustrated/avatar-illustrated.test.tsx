// The drawn faces by recipe (Studio's Your face): a seed's recipe draws the very face the seed draws, every part
// variant is listed, and a part the drawings do not know falls back instead of breaking the face.
import { describe, expect, it } from 'vitest';
import { FACE_PART_VARIANTS, faceRecipe, illustratedAvatarSvg, illustratedFaceSvg, illustratedFaceUri } from './index';

describe('avatar-illustrated recipes', () => {
  it('lists every variant of each part', () => {
    expect(FACE_PART_VARIANTS.hair).toHaveLength(64);
    expect(FACE_PART_VARIANTS.hair).toContain('hat');
    expect(FACE_PART_VARIANTS.glasses).toHaveLength(11);
    expect(FACE_PART_VARIANTS.beard).toHaveLength(12);
    expect(FACE_PART_VARIANTS.eyes).toHaveLength(5);
    expect(FACE_PART_VARIANTS.brows).toHaveLength(13);
    expect(FACE_PART_VARIANTS.nose).toHaveLength(20);
    expect(FACE_PART_VARIANTS.lips).toHaveLength(30);
    expect(FACE_PART_VARIANTS.body).toHaveLength(25);
  });

  it('reads the recipe of a seed, and draws the same face from it', () => {
    const r = faceRecipe('~dana');
    expect(r).toMatchObject({ v: 1, hair: 'variant02', glasses: null, beard: null });
    const bySeed = illustratedAvatarSvg('~dana');
    const byRecipe = illustratedFaceSvg(r);
    // The drawings share every path; only the seed-made ids may differ.
    const paths = (svg: string) => [...svg.matchAll(/ d="([^"]+)"/g)].map((m) => m[1]);
    expect(paths(byRecipe)).toEqual(paths(bySeed));
  });

  it('draws glasses and a beard only when the recipe has them', () => {
    const r = { ...faceRecipe('~dana'), glasses: 'variant03', beard: 'variant04' };
    expect(illustratedFaceSvg(r).length).toBeGreaterThan(illustratedFaceSvg({ ...r, glasses: null, beard: null }).length);
  });

  it('memoizes the data URI per recipe', () => {
    const r = faceRecipe('~leo');
    expect(illustratedFaceUri(r)).toBe(illustratedFaceUri({ ...r }));
    expect(illustratedFaceUri(r)).toMatch(/^data:image\/svg\+xml/);
  });
});
