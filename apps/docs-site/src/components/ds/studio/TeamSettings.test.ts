// @vitest-environment jsdom
// Settings on a team shell: the owner exception reads once, in designer words; the sample team names its sample
// members (the same as Members), never the repository's accounts; token values never wait for a code check.
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
  TeamLoadProgress: () => null,
}));
vi.mock('./members-state', () => ({
  useTeamPeople: () => ({ members: [{ login: 'sam', name: 'Sam Rivera', role: 'admin', reviews: ['design', 'tech'] }] }),
}));
vi.mock('./SettingsParts', () => ({
  AdminOnlyNote: () => null,
  Code: ({ children }: { children: unknown }) => createElement('code', null, children as never),
  DevFold: () => null,
}));
vi.mock('./faces', () => ({ Who: ({ p }: { p: { login: string } }) => createElement('i', { 'data-face': p.login }) }));
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
    expect(screen.getByText('Sam Rivera, with a written reason of at least 20 characters.')).toBeInTheDocument();
  });

  it('says token values ship once the look is approved and the automatic checks pass, with no code check', () => {
    render(createElement(TeamSettings));
    expect(screen.getByText('Token values')).toBeInTheDocument();
    expect(screen.getByText('Ship once the look is approved and the automatic checks pass.')).toBeInTheDocument();
    expect(screen.getByText('Nobody checks the code. From Figma, sending counts as the approval. A renamed or removed token waits for a code check.')).toBeInTheDocument();
  });

  it('on the sample team, shows its own rules and people as on any team, with no sample note', () => {
    Object.assign(at, { owner: 'acme-design-demo', repo: 'bridge-demo-ds', site: sampleSite });
    try {
      const { container } = render(createElement(TeamSettings));
      const row = (label: string) => screen.getByText(label).closest('.set-row')!;
      const names = (label: string) => [...row(label).querySelectorAll('.set-owner > span:last-child')].map((o) => o.textContent);
      // The repository's own owners, named as any team names them (no persona rewrite).
      expect(names('Checks the look')).toEqual(['peterbono']);
      expect(names('Checks the code')).toEqual(['peterbono']);
      expect(screen.getByText('peterbono, with a written reason of at least 20 characters.')).toBeInTheDocument();
      expect(screen.getByText('Token values')).toBeInTheDocument();
      expect(container.textContent).not.toMatch(/a sample team/);
      // The rules editor and the admin notes of any team.
      expect(container.querySelectorAll('.set-row').length).toBeGreaterThan(3);
    } finally {
      Object.assign(at, { owner: 'acme', repo: 'acme-product', site });
    }
  });
});
