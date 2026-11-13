// @vitest-environment jsdom
// Settings on a team shell: the owner exception reads once, in designer words; the sample team names its cast only
// (lib/review-people.ts), never the account that hosts its repository; token values need no code review.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const site: Record<string, unknown> = {
  owners: { design: ['sam'], tech: ['sam'] },
  rights: null,
  changes: 'suggest',
  soloOwnerCanApproveBoth: true,
  override: { allowed: ['sam'], requireReason: true, minReasonLength: 20 },
  visualImpact: { mode: 'auto' },
  defaultBranch: 'main',
};

const at = { owner: 'acme', repo: 'acme-product', site };

vi.mock('./TeamState', () => ({
  useTeamData: () => ({
    load: { status: 'ready', data: { owner: at.owner, repo: at.repo, model: { site: at.site, config: { governance: { protectedBranches: ['main'], branchPrefix: '' } }, tokens: { root: 'tokens' } } } },
    retry: () => {},
  }),
  TeamLoadError: () => null,
  TeamPageSkeleton: () => null,
}));
vi.mock('./members-state', () => ({
  useTeamPeople: () => ({ members: [{ login: 'sam', name: 'Sam Rivera', role: 'admin', reviews: ['design', 'tech'] }] }),
}));
vi.mock('./SettingsParts', () => ({
  AdminOnlyNote: () => null,
  Code: ({ children }: { children: unknown }) => createElement('code', null, children as never),
  DevFold: () => null,
}));
vi.mock('./faces', () => ({ Who: ({ p }: { p: { login: string } }) => createElement('i', { 'data-face': p.login }), githubPhoto: (l: string) => `https://github.com/${l}.png?size=48` }));
vi.mock('../../../scripts/people', () => ({ knownNames: () => new Map() }));

const { default: TeamSettings } = await import('./TeamSettings');

// The sample team's repository, as its real config might say it: its real account owns everything, merging is tech's.
const sampleSite = {
  ...site,
  owners: { design: ['peterbono'], tech: ['peterbono'] },
  rights: { approveDesign: ['design'], approveTech: ['tech'], ship: ['tech'] },
  override: { allowed: ['peterbono'], requireReason: true, minReasonLength: 20 },
  demo: { viewer: 'Dana' },
};

describe('TeamSettings', () => {
  it('shows the owner exception once, by name', () => {
    render(createElement(TeamSettings));
    expect(screen.getAllByText('Exception')).toHaveLength(1);
    expect(screen.getByText('Sam Rivera, with a reason of at least 20 characters.')).toBeInTheDocument();
  });

  it('says token values go live once the look is approved and the automatic checks pass, calmly', () => {
    const { container } = render(createElement(TeamSettings));
    expect(screen.getByText('Token values')).toBeInTheDocument();
    expect(screen.getByText('Go live once the look is approved and the automatic checks pass.')).toBeInTheDocument();
    expect(screen.getByText('A new value needs no code review. Sending from Figma counts as the approval. Renaming or removing a token also needs a code review.')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/Nobody checks/);
    expect(container.textContent).not.toMatch(/\u2014/);
  });

  const onSample = (s: Record<string, unknown>, run: (c: HTMLElement) => void) => {
    Object.assign(at, { owner: 'acme-design-demo', repo: 'bridge-demo-ds', site: s });
    try {
      run(render(createElement(TeamSettings)).container);
    } finally {
      Object.assign(at, { owner: 'acme', repo: 'acme-product', site });
    }
  };
  const row = (label: string) => screen.getByText(label).closest('.set-row')!;
  const names = (label: string) => [...row(label).querySelectorAll('.set-owner > span:last-child')].map((o) => o.textContent);

  it('on the sample team, never names the account that hosts its repository: its design lead checks the look', () => {
    onSample(sampleSite, (container) => {
      expect(container.textContent).not.toMatch(/peterbono|Florian/);
      expect(names('Checks the look')).toEqual(['Dana']);
      // Nobody of the cast is a code owner in this config: nobody is named, never someone from elsewhere.
      expect(names('Checks the code')).toEqual([]);
      expect(screen.queryByText('Exception')).toBeNull();
      expect(screen.queryByText('Only owner')).toBeNull();
      expect(container.textContent).not.toMatch(/a sample team/);
    });
  });

  it('on the sample team, names its cast as its config holds them: Dana checks the look and adds to the library, Malik checks the code', () => {
    const cast = {
      ...sampleSite,
      owners: { design: ['peterbono'], tech: ['acme-malik'] },
      rights: { approveDesign: ['design'], approveTech: ['tech'], ship: ['design'] },
      soloOwnerCanApproveBoth: false,
      override: { allowed: ['acme-malik'], requireReason: true, minReasonLength: 20 },
    };
    onSample(cast, (container) => {
      expect(names('Checks the look')).toEqual(['Dana']);
      expect(names('Checks the code')).toEqual(['Malik']);
      expect(names('Adds it to the library')).toEqual(['Dana']);
      expect(screen.getByText('Malik, with a reason of at least 20 characters.')).toBeInTheDocument();
      expect(container.textContent).not.toMatch(/peterbono|acme-malik/);
    });
  });
});
