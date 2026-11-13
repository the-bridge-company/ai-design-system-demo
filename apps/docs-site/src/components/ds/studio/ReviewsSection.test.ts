// @vitest-environment jsdom
// Settings > Reviews (docs/specs/two-reviews.md): an admin reads the two reviews summary first, turns a product's design
// review off and on from the keyboard (one save per product), picks who reviews, and changes who decides what the
// library keeps; the one time note shows after the migration; anyone else reads the same words with no control.
// Keyboard and axe.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import type { Member } from '../../../lib/invites';
import ReviewsSection from './ReviewsSection';

const DANA = 'a399f73add3dbb2d';
const LEO = 'af419771c6f4d96f';

const api = vi.hoisted(() => ({
  setDesignReview: vi.fn(async (_repo: string, _product: string, _setting: unknown) => null),
  setLibraryOwner: vi.fn(async (_repo: string, _email: string, on: boolean) => ({ ok: true, libraryOwner: on })),
}));
vi.mock('../../../scripts/invites-api', () => api);
vi.mock('../../../scripts/repo-context', () => ({ siteConfig: () => ({ products: [{ key: 'crm', name: 'Acme CRM' }] }) }));
const owners = vi.hoisted(() => ({ design: [] as string[] }));
vi.mock('../../../scripts/teams', () => ({ siteApprovers: () => ({ design: owners.design, tech: [] }) }));
vi.mock('../../../scripts/github-session', () => ({ currentContributor: () => ({ ref: LEO }), getToken: () => null }));
vi.mock('../../../scripts/contribute-session', () => ({
  teamReview: async () => ({
    designReview: { '*': { on: true, reviewers: [DANA] }, library: { on: false } },
    members: [
      { name: 'Dana', ref: DANA, role: 'admin', libraryOwner: true },
      { name: 'Leo', ref: LEO, role: 'edit' },
    ],
    asked: [],
  }),
}));

const members: Member[] = [
  { login: 'dana@acme.example', email: 'dana@acme.example', name: 'Dana', role: 'admin', reviews: [], via: 'email', lead: true },
  { login: 'leo@acme.example', email: 'leo@acme.example', name: 'Leo', role: 'edit', reviews: [], via: 'email' },
];
const reviews = { designReview: { '*': { on: true as const, reviewers: [DANA] }, library: { on: false as const } }, note: true };

beforeEach(() => {
  vi.clearAllMocks();
  owners.design = [];
});

describe('Settings > Reviews', () => {
  it('an admin reads both reviews summary first, with the one time note', async () => {
    const { container } = render(createElement(ReviewsSection, { repo: 'acme/ds', canEdit: true, members, reviews }));
    expect(await screen.findByRole('switch', { name: 'Acme CRM' })).toBeChecked();
    expect(screen.getByRole('heading', { name: 'Reviews' })).toBeInTheDocument();
    expect(screen.getByText('Dana decides what the library keeps')).toBeInTheDocument();
    expect(screen.getByText("Reviews now have two parts. Check who reviews each product's design.")).toBeInTheDocument();
    expect(screen.getByText('Dana reviews')).toBeInTheDocument();
    // An admin edits: no read only line.
    expect(screen.queryByText('Only admins change who reviews.')).toBeNull();
    expect(screen.getByRole('switch', { name: 'Library' })).not.toBeChecked();
    expect(screen.getByText('No design review')).toBeInTheDocument();
    // Progressive disclosure: who reviews and who decides stay folded.
    expect(screen.queryByRole('group', { name: /Who reviews/ })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Library owners' })).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('keyboard: Tab to the product switch, Space turns its design review off, saved for that product only', async () => {
    const user = userEvent.setup();
    render(createElement(ReviewsSection, { repo: 'acme/ds', canEdit: true, members, reviews }));
    const sw = await screen.findByRole('switch', { name: 'Acme CRM' });
    // "Change who decides" comes first, then the product's switch.
    await user.tab();
    expect(screen.getByRole('button', { name: 'Change who decides' })).toHaveFocus();
    await user.tab();
    expect(sw).toHaveFocus();
    await user.keyboard(' ');
    await waitFor(() => expect(api.setDesignReview).toHaveBeenCalledWith('acme/ds', 'crm', { on: false }));
    expect(api.setDesignReview).toHaveBeenCalledTimes(1);
    expect(sw).not.toBeChecked();
    expect(await screen.findByText('Saved.')).toBeInTheDocument();
    // Saving clears the one time note.
    expect(screen.queryByText(/Reviews now have two parts/)).toBeNull();
  });

  it("turning the Library's design review on asks the team default; picking Any designer saves it", async () => {
    const user = userEvent.setup();
    const { container } = render(createElement(ReviewsSection, { repo: 'acme/ds', canEdit: true, members, reviews }));
    await user.click(await screen.findByRole('switch', { name: 'Library' }));
    await waitFor(() => expect(api.setDesignReview).toHaveBeenCalledWith('acme/ds', 'library', { on: true, reviewers: [DANA] }));
    const change = screen.getAllByRole('button', { name: 'Change who reviews' })[0]!;
    await user.click(change);
    const group = screen.getByRole('group', { name: 'Who reviews Acme CRM' });
    expect(group).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /Any designer/ }));
    await waitFor(() => expect(api.setDesignReview).toHaveBeenLastCalledWith('acme/ds', 'crm', { on: true, reviewers: 'any-designer' }));
    await expectNoAxeViolations(container);
  });

  it('changes who decides what the library keeps, and never leaves nobody', async () => {
    const user = userEvent.setup();
    render(createElement(ReviewsSection, { repo: 'acme/ds', canEdit: true, members, reviews }));
    await user.click(await screen.findByRole('button', { name: 'Change who decides' }));
    await user.click(screen.getByRole('checkbox', { name: 'Leo' }));
    await waitFor(() => expect(api.setLibraryOwner).toHaveBeenCalledWith('acme/ds', 'leo@acme.example', true));
    expect(await screen.findByText('Dana and Leo decide what the library keeps')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Leo' }));
    await user.click(screen.getByRole('checkbox', { name: 'Dana' }));
    expect(await screen.findByText('Keep at least one person who decides what the library keeps.')).toBeInTheDocument();
    expect(api.setLibraryOwner).not.toHaveBeenCalledWith('acme/ds', 'dana@acme.example', false);
  });

  it('anyone else reads the same words, with no control, and one line says only admins change them', async () => {
    const { container } = render(createElement(ReviewsSection, { repo: 'acme/ds', canEdit: false, members, reviews: null }));
    expect(await screen.findByText('Dana reviews')).toBeInTheDocument();
    expect(screen.getByText('Dana decides what the library keeps')).toBeInTheDocument();
    expect(screen.getByText('Only admins change who reviews.')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByText(/Reviews now have two parts/)).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('the sample team names only its cast: never the GitHub owner of the repository hosting it, never a config key', async () => {
    owners.design = ['peterbono'];
    render(createElement(ReviewsSection, { repo: 'acme-design-demo/bridge-demo-ds', canEdit: true, members, reviews }));
    expect(await screen.findByText('Dana decides what the library keeps')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/peterbono|bridge\.config|governance/i);
  });

  it('a real team keeps its GitHub design owners, in plain words', async () => {
    owners.design = ['lee'];
    render(createElement(ReviewsSection, { repo: 'acme/ds', canEdit: true, members, reviews }));
    expect(await screen.findByText('Dana and lee decide what the library keeps')).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/bridge\.config|governance/i);
  });
});
