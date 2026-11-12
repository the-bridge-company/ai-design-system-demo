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
// A real team by default; the sample team's test switches `at`.
const at = { owner: 'acme', repo: 'acme-product' };
vi.mock('./TeamState', () => ({
  useTeamData: () => ({
    load: {
      status: 'ready',
      data: {
        owner: at.owner,
        repo: at.repo,
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

// The face check of faces.tsx (its dynamic import) can still reach the real scripts/github-photo, whose HEAD request
// went to avatars.githubusercontent.com: on a CI runner GitHub answered 429 and Malik kept a photo. GitHub's answer is
// given here instead, as GitHub gives it (Last-Modified: the identicon stamp for an account without a photo), and no
// other request leaves the test.
vi.stubGlobal('fetch', async (input: unknown) => {
  const url = String(input);
  const m = /^https:\/\/avatars\.githubusercontent\.com\/([^/?]+)\?s=8$/.exec(url);
  if (!m) throw new Error(`No network in this test: ${url}`);
  const lastModified = m[1] === 'acme-malik' ? 'Sat, 05 Nov 2016 20:57:12 GMT' : 'Tue, 03 Mar 2020 10:00:00 GMT';
  return new Response(null, { status: 200, headers: { 'Last-Modified': lastModified } });
});
const { default: TeamSettings } = await import('./TeamSettings');
// The face check imports this module on first render (faces.tsx useDrawnFace): loaded here, so no test waits on a
// cold dynamic import (it took more than waitFor's default second on a busy CI runner).
await import('../../../scripts/github-photo');
const settle = { timeout: 5000 };
const { PersonCell } = await import('./MemberParts');

const srcOf = (name: string) => [...document.querySelectorAll(`[data-avatar="${name}"]`)].map((el) => el.getAttribute('data-src'));

describe('Settings faces', () => {
  it('Review rules show the drawn face for an account without a photo, the photo for the others', async () => {
    render(createElement(TeamSettings));
    await waitFor(() => {
      expect(srcOf('Malik').length).toBeGreaterThan(0);
      expect(srcOf('Malik').every((s) => s === '')).toBe(true);
    }, settle);
    expect(srcOf('sam')).toEqual(['https://github.com/sam.png?size=48']);
  });

  it('on the sample team, its developer is drawn as the cast draws him, never with a GitHub photo', () => {
    Object.assign(at, { owner: 'acme-design-demo', repo: 'bridge-demo-ds' });
    try {
      render(createElement(TeamSettings));
      // No photo address at all: nothing to wait for.
      expect(srcOf('Malik')).toEqual(['']);
      // sam is not one of the sample team's people: never named there.
      expect(srcOf('sam')).toEqual([]);
    } finally {
      Object.assign(at, { owner: 'acme', repo: 'acme-product' });
    }
  });

  it('a Members row checks the address GitHub gives by the member login', async () => {
    render(createElement(PersonCell, { name: 'Malik', seed: 'acme-malik', line: 'Can edit', avatar: 'https://avatars.githubusercontent.com/u/123456?v=4' }));
    render(createElement(PersonCell, { name: 'Sam', seed: 'sam', line: 'Admin', avatar: 'https://avatars.githubusercontent.com/u/42?v=4' }));
    await waitFor(() => expect(srcOf('Malik')).toEqual(['']), settle);
    expect(srcOf('Sam')).toEqual(['https://avatars.githubusercontent.com/u/42?v=4']);
  });
});
