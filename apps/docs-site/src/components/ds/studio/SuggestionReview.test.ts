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

  it('in the review queue: the layout of every queue item, no buttons of its own, plain words for the change', async () => {
    const p = props({
      inQueue: true,
      next: [{ key: 'change-63', title: 'Button label while loading' }],
      title: 'Always offer the next step',
      kind: 'Docs change',
      summary: 'Usage guidance for EmptyState, written with Claude through the Bridge MCP server.',
      docs: [{ component: 'EmptyState', after: { summary: 'Explains why a view has no content yet.' } }],
    });
    const { container } = render(createElement(SuggestionReview, p));
    expect(screen.getByRole('heading', { level: 2, name: /Always offer the next step/ })).toBeTruthy();
    expect(screen.getByText('suggests a change · Docs change', { exact: false })).toBeTruthy();
    // The queue's bar decides: no Approve, no stacked next cards, no keyboard line of its own.
    expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    expect(container.textContent).not.toContain('Button label while loading');
    expect(container.textContent).not.toMatch(/approve.*suggest.*next/);
    // Bridge's own words carry no tool name or file label.
    expect(container.textContent).toContain('Usage guidance for EmptyState.');
    expect(container.textContent).not.toContain('Bridge MCP server');
    expect(container.textContent).toContain('EmptyState usage guidance');
    expect(container.textContent).not.toContain('EmptyState docs');
    await expectNoAxeViolations(container);
  });

  it('a token change in the queue names what it paints, the token path folded under Details', () => {
    const tokens = [
      {
        path: 'color.border.emphasis',
        contexts: ['dark'],
        before: { alias: 'palette.neutral.700', css: '#495562', hex: '#495562' },
        after: { alias: 'palette.neutral.600', css: '#5b6672', hex: '#5b6672' },
      },
    ] as unknown as SuggestionReviewProps['tokens'];
    const { container } = render(createElement(SuggestionReview, props({ inQueue: true, tokens })));
    expect(container.textContent).toContain('Emphasis border · Dark');
    expect(container.textContent).toContain('Neutral 700');
    for (const pane of container.querySelectorAll('.sg-pane-list')) expect(pane.textContent).not.toContain('color.border.emphasis');
  });
});
