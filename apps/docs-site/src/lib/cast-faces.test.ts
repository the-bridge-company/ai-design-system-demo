import { describe, expect, it } from 'vitest';
import { illustratedAvatarSvg } from '@bridge-ds/react/avatar-illustrated';
import { createAvatar } from '@dicebear/core';
import { notionists } from '@dicebear/collection';
import { CAST_FACE_SEEDS, drawingSeed, faceSeedForName, namedFace } from './cast-faces';
import { SAMPLE_CAST, castFaceLogin } from './demo-cast';
import { emailMemberFace } from './people';
import { requesterPerson } from './home-model';

describe('cast faces', () => {
  it('gives each of the five people one seed, the one castFaceLogin draws everywhere', () => {
    expect(CAST_FACE_SEEDS).toEqual({ dana: '~dana', sofia: '~sofia', leo: '~leo', malik: 'acme-malik', ann: '~ann' });
    for (const p of SAMPLE_CAST) expect(CAST_FACE_SEEDS[p.key]).toBe(castFaceLogin(p));
  });

  it('draws five different faces (no two cast seeds give the same drawing)', () => {
    const svgs = Object.values(CAST_FACE_SEEDS).map((s) => illustratedAvatarSvg(drawingSeed(s)));
    expect(new Set(svgs).size).toBe(5);
  });

  it('tells the five apart by drawing id: no two share a hair drawing, the part that reads at 20 to 40 px', () => {
    // The drawing ids the face generator picks for a seed (the same options as @bridge-ds/react avatar-illustrated).
    const hair = (seed: string) => createAvatar(notionists, { seed: drawingSeed(seed).trim().toLowerCase(), gestureProbability: 0, bodyIconProbability: 0 }).toJson().extra['hair'];
    const ids = Object.fromEntries(Object.entries(CAST_FACE_SEEDS).map(([k, s]) => [k, hair(s)]));
    expect(new Set(Object.values(ids)).size).toBe(5);
    // Malik was drawn with Dana's look (long dark hair): his drawing comes from its own seed now.
    expect(drawingSeed('acme-malik')).not.toBe('acme-malik');
    expect(ids['malik']).not.toBe(ids['dana']);
  });

  it('an email member is drawn with the same seed by name, by email and by cast', () => {
    for (const p of SAMPLE_CAST) {
      if (p.via.kind !== 'email') continue;
      expect(emailMemberFace(p.name, p.via.email)).toBe(CAST_FACE_SEEDS[p.key]);
      expect(faceSeedForName(p.name)).toBe(CAST_FACE_SEEDS[p.key]);
      // The home's "Requested by Sofia" rows draw her the same way.
      expect(requesterPerson({ name: p.name, login: null })!.login).toBe(CAST_FACE_SEEDS[p.key]);
    }
  });

  it('on the sample team, the developer known by name keeps his GitHub face', () => {
    expect(faceSeedForName('Malik', { sample: true })).toBe('acme-malik');
    expect(faceSeedForName(' malik ', { sample: true })).toBe('acme-malik');
    // Any other team: a name is a name.
    expect(faceSeedForName('Malik')).toBe('~malik');
  });

  it('two people who share the account a row came through still get their own faces', () => {
    expect(namedFace('Sofia', { sample: true }).login).not.toBe(namedFace('Leo', { sample: true }).login);
    expect(namedFace('Priya Shah')).toEqual({ login: '~priya-shah', name: 'Priya Shah', avatar: null });
  });
});
