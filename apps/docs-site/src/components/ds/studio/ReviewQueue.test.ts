// @vitest-environment jsdom
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import { QueueBar, QueueItem, QueueList, type QueueBarProps } from './ReviewQueue';

const bar = (over: Partial<QueueBarProps> = {}): QueueBarProps => ({
  comment: true,
  secondary: { label: 'Ask for changes', needsText: 'Say what to change in the comment first.', onClick: vi.fn() },
  primary: { label: 'Approve', onClick: vi.fn() },
  menu: [{ label: 'Copy link', onClick: vi.fn() }],
  said: '',
  focusComment: 0,
  ...over,
});

const keysLine = 'Keyboard: A approve · S ask for changes · J K next and previous';
const keysOf = (c: HTMLElement) => c.querySelector('.rq-bar-keys')!.textContent!.replace(/\s+/g, ' ').trim();

describe('the review queue: one layout for every item', () => {
  it('the bar: comment, Ask for changes, Approve last, More actions, then the one keyboard line', async () => {
    const p = bar();
    const { container } = render(createElement(QueueBar, p));
    const buttons = [...container.querySelectorAll('.rq-bar-row button')].map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(buttons).toEqual(['Ask for changes', 'Approve', 'More actions']);
    expect(keysOf(container)).toBe(keysLine);
    // Ask for changes needs the comment: it says so instead of sending an empty request.
    await userEvent.click(screen.getByRole('button', { name: 'Ask for changes' }));
    expect(p.secondary!.onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toBe('Say what to change in the comment first.');
    await userEvent.type(screen.getByRole('textbox', { name: 'Comment' }), 'Use the lighter step');
    await userEvent.click(screen.getByRole('button', { name: 'Ask for changes' }));
    expect(p.secondary!.onClick).toHaveBeenCalledWith('Use the lighter step');
    await expectNoAxeViolations(container);
  });

  it('an item reviewed on its own page: the same bar and keyboard line, its link in the primary place', () => {
    const { container } = render(createElement(QueueBar, bar({ comment: false, note: 'You review it on its own page.', secondary: null, primary: { label: 'Open review', href: '/studio/explorations/?pr=1' }, menu: [] })));
    expect(screen.getByRole('link', { name: 'Open review' }).getAttribute('href')).toBe('/studio/explorations/?pr=1');
    expect(screen.getByText('You review it on its own page.')).toBeTruthy();
    expect(keysOf(container)).toBe(keysLine);
  });

  it('an item that is not reviewed in place has the same head as a branch: the title, then who waits', () => {
    render(createElement(QueueItem, { title: 'Order fulfilment timeline', person: { login: 'sofia', name: 'Sofia', agent: false }, line: 'Sofia is done exploring' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Order fulfilment timeline' }).className).toContain('br-title');
    expect(screen.getByText('Sofia is done exploring')).toBeTruthy();
  });

  it('the list shows as many rows wherever the viewer is, and the same "and N more"', () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({ key: `k${i}`, title: `Item ${i} with a long title that wraps on two lines in the list` }));
    const at = (i: number) => {
      const { container, unmount } = render(createElement(QueueList, { rows, selected: `k${i}`, outcomes: new Map(), onSelect: () => {} }));
      const shown = container.querySelectorAll('.rq-item-row').length;
      const more = container.querySelector('.rq-more')?.textContent;
      unmount();
      return { shown, more };
    };
    for (const i of [0, 3, 6, 9]) expect(at(i)).toEqual({ shown: 7, more: 'and 3 more' });
  });
});
