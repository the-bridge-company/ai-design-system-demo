// @vitest-environment jsdom
// Settings shows a GitHub account without a photo of its own (the generated pattern) with its drawn face, as the home
// does (faces.tsx Who): the Review rules people, an owner group's people, and the Members rows, whose address is the one
// GitHub's API gives (avatars.githubusercontent.com/u/<id>).
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// acme-malik has no photo on GitHub; sam has one.
vi.mock('../../../scripts/github-photo', () => ({
  knownDrawn: (login: string) => login === 'acme-malik',
  drawnFace: async (login: string) => login === 'acme-malik',
}));
vi.mock('@bridge-ds/react', async (orig) => ({
  ...(await orig<typeof import('@bridge-ds/react')>()),
  Avatar: ({ name, src }: { name: string; src?: string }) => createElement('i', { 'data-avatar': name, 'data-src': src ?? '' }),
}));
vi.mock('./TeamState', () => ({
  useTeamData: () => ({
    load: {
      status: 'ready',
      data: {
        owner: 'acme-design-demo',
        repo: 'bridge-demo-ds',
        model: {
          site: { owners: { design: ['sam'], tech: ['acme-malik'] }, rights: null, changes: 'suggest', soloOwnerCanApproveBoth: false, override: { allowed: [] }, visualImpact: { mode: 'auto' }, defaultBranch: 'main' },
          config: { governance: { protectedBranches: ['main'], branchPrefix: '' } },
          tokens: { root: 'tokens' },
        },
      },
    },
    retry: () => {},
  }),
  TeamLoadError: () => null,
  TeamLoadProgress: () => null,
}));
vi.mock('./members-state', () => ({
  useTeamPeople: () => ({
    members: [
      { login: 'sam', name: 'Sam', role: 'admin', reviews: ['design'] },
      { login: 'acme-malik', name: 'Malik', role: 'writer', reviews: ['tech'] },
    ],
  }),
}));
vi.mock('./SettingsParts', () => ({
  AdminOnlyNote: () => null,
  Code: ({ children }: { children: unknown }) => createElement('code', null, children as never),
  DevFold: () => null,
}));
vi.mock('../../../scripts/people', () => ({ knownNames: () => new Map() }));

const { default: TeamSettings } = await import('./TeamSettings');
const { PersonCell } = await import('./MemberParts');

const srcOf = (name: string) => [...document.querySelectorAll(`[data-avatar="${name}"]`)].map((el) => el.getAttribute('data-src'));

describe('Settings faces', () => {
  it('Review rules show the drawn face for an account without a photo, the photo for the others', async () => {
    render(createElement(TeamSettings));
    await waitFor(() => expect(srcOf('Malik').every((s) => s === '')).toBe(true));
    expect(srcOf('Malik').length).toBeGreaterThan(0);
    expect(srcOf('sam')).toEqual(['https://github.com/sam.png?size=48']);
  });

  it('a Members row checks the address GitHub gives by the member login', async () => {
    render(createElement(PersonCell, { name: 'Malik', seed: 'acme-malik', line: 'Can edit', avatar: 'https://avatars.githubusercontent.com/u/123456?v=4' }));
    render(createElement(PersonCell, { name: 'Sam', seed: 'sam', line: 'Admin', avatar: 'https://avatars.githubusercontent.com/u/42?v=4' }));
    await waitFor(() => expect(srcOf('Malik')).toEqual(['']));
    expect(srcOf('Sam')).toEqual(['https://avatars.githubusercontent.com/u/42?v=4']);
  });
});
