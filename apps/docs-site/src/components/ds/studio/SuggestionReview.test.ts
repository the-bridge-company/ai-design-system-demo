// @vitest-environment jsdom
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import { SuggestionReview, type SuggestionReviewProps } from './SuggestionReview';

const props = (over: Partial<SuggestionReviewProps> = {}): SuggestionReviewProps => ({
  n: 12,
  url: 'https://github.com/acme-design-demo/bridge-demo-ds/issues/12',
  title: 'Deeper primary blue',
  kind: 'Token change',
  summary: 'Buttons read washed out on grey.',
  author: { login: '~ann', name: 'Ann', avatarUrl: null, agent: false },
  source: 'studio',
  createdAt: '2026-10-22T08:00:00Z',
  status: { label: 'Needs review', tone: 'info' },
  tokens: [],
  docs: [],
  spec: null,
  files: [],
  proofs: [],
  proofsWhen: 'suggested',
  stale: [],
  edited: false,
  approvals: [
    { label: 'Design approval', state: 'waiting', text: 'Waiting for Dana' },
    { label: 'Tech approval', state: 'waiting', text: 'Waiting for Malik' },
  ],
  gate: { canApprove: true, canRequestChanges: true, canDecline: false, role: 'design', covers: ['design'], why: null },
  approveLabel: 'Approve',
  apply: null,
  previews: [],
  next: [],
  inQueue: false,
  onApprove: vi.fn(async () => 'sent'),
  onRequestChanges: vi.fn(async () => undefined),
  onDecline: vi.fn(),
  ...over,
});

beforeEach(() => localStorage.clear());

describe('SuggestionReview, the same on every team (the sample team included)', () => {
  it('runs the real Approve: the server answers it (on the sample team, its write refusal), nothing is faked in the page', async () => {
    const p = props();
    const { container } = render(createElement(SuggestionReview, p));
    const approve = screen.getByRole('button', { name: 'Approve' });
    expect(approve.getAttribute('data-demo-write')).toBe('review suggestions');
    expect(approve.hasAttribute('data-demo-try')).toBe(false);
    await userEvent.click(approve);
    expect(p.onApprove).toHaveBeenCalled();
    expect(screen.queryByText(/Sample data, nothing is sent/)).toBeNull();
    await expectNoAxeViolations(container);
  });
});
