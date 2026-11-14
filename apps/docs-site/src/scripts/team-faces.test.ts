// @vitest-environment jsdom
// One face per person on every surface (scripts/team-faces.ts): a seed draws its saved face when the team map has one,
// the distinct seed Bridge picked for a newcomer otherwise, the cast as drawn on the sample team (a visitor's face for
// the person they play stays in this browser), and the person's own face before their team was read.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as drawer from '@bridge-ds/react/avatar-illustrated';
import { choseDrawn, faceUri, forgetDrawings, noteAccountFace, rememberMyFace, rememberTeamFaces, saveSampleFace, FACES_EVENT } from './team-faces';
import { SAMPLE_REPO } from '../lib/demo';

const ctx = vi.hoisted(() => ({ repo: 'acme/ds' }));
vi.mock('./repo-context', () => ({ repoContext: () => ({ owner: ctx.repo.split('/')[0], repo: ctx.repo.split('/')[1], defaultBranch: 'main', hosted: true }) }));

const face = (hair: string) => ({ ...drawer.faceRecipe('~dana'), hair });

beforeEach(() => {
  localStorage.clear();
  forgetDrawings();
  ctx.repo = 'acme/ds';
});

describe('faceUri', () => {
  it('draws a saved face from the team map, and tells mounted faces to draw again', () => {
    const heard = vi.fn();
    document.addEventListener(FACES_EVENT, heard);
    expect(faceUri(drawer, '~sofia')).toBe(drawer.illustratedAvatarUri('~sofia'));
    rememberTeamFaces('acme/ds', { saved: { '~sofia': { face: face('variant40'), name: 'Sofia', at: 1 } }, people: [{ seed: '~sofia', name: 'Sofia' }] });
    expect(heard).toHaveBeenCalledTimes(1);
    expect(faceUri(drawer, '~Sofia')).toBe(drawer.illustratedFaceUri(face('variant40')));
    document.removeEventListener(FACES_EVENT, heard);
  });

  it('redraws a newcomer whose seed wears a taken style', () => {
    const taken = drawer.faceRecipe('~ben').hair;
    rememberTeamFaces('acme/ds', { saved: { '~dana': { face: face(taken), name: 'Dana', at: 1 } }, people: [{ seed: '~dana', name: 'Dana' }, { seed: '~ben', name: 'Ben' }] });
    expect(faceUri(drawer, '~ben')).not.toBe(drawer.illustratedAvatarUri('~ben'));
    expect(faceUri(drawer, '~ben')).toMatch(/^data:image\/svg\+xml/);
  });

  it('draws the person\'s own face before their team was read', () => {
    rememberMyFace({ face: face('variant12'), seeds: ['~dana'], name: 'Dana' });
    expect(faceUri(drawer, '~dana')).toBe(drawer.illustratedFaceUri(face('variant12')));
  });

  it('on the sample team: the cast as drawn, the visitor\'s face for the person they play in this browser only', () => {
    ctx.repo = SAMPLE_REPO;
    expect(faceUri(drawer, 'acme-malik')).toBe(drawer.illustratedAvatarUri('malik-7'));
    saveSampleFace('dana', face('variant12'));
    expect(faceUri(drawer, '~dana')).toBe(drawer.illustratedFaceUri(face('variant12')));
    expect(localStorage.getItem('bridge.faces.' + SAMPLE_REPO)).toBeNull();
  });
});

describe('choseDrawn (photo or drawn face, Settings > You)', () => {
  it('the photo by default; the drawn face once the person chose it, from their account or from the team map', () => {
    expect(choseDrawn('dana-gh')).toBe(false);
    // A teammate's choice, as the team face map says it.
    rememberTeamFaces('acme/ds', { saved: { 'sofia-gh': { face: face('variant40'), name: 'Sofia', at: 1, overPhoto: true }, 'leo-gh': { face: face('variant41'), name: 'Leo', at: 2 } }, people: [] });
    expect(choseDrawn('Sofia-GH')).toBe(true);
    expect(choseDrawn('leo-gh')).toBe(false);
    // Their own choice, as their account says it, wins over a team map not read since.
    noteAccountFace({ name: 'Dana', email: 'dana@acme.example', github: { login: 'Dana-GH' }, face: face('variant12'), faceChoice: 'drawn' });
    expect(choseDrawn('dana-gh')).toBe(true);
    noteAccountFace({ name: 'Dana', email: 'dana@acme.example', github: { login: 'Dana-GH' }, face: face('variant12'), faceChoice: 'photo' });
    expect(choseDrawn('dana-gh')).toBe(false);
  });

  it('never on the sample team', () => {
    ctx.repo = SAMPLE_REPO;
    expect(choseDrawn('acme-malik')).toBe(false);
  });
});
