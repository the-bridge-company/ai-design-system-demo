// @vitest-environment jsdom
// Play both on a behavior request: the hand-off to the person's own Claude while there is no preview, the states of the
// preview Bridge recorded, and the two frames with the same keys. Never an API key. Axe clean.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import BehaviorReplay, { REPLAY_WORDS } from './BehaviorReplay';

const base = { keys: ['Enter', 'ArrowDown', 'Tab'], number: 75, component: 'Select' };

describe('BehaviorReplay', () => {
  it('no preview yet: the line to say to your Claude, with Copy', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { container } = render(createElement(BehaviorReplay, { ...base, viewer: 'lead', state: { kind: 'ask', update: false } }));
    expect(container.textContent).toContain('Ask your Claude to make the preview. In Claude, with Bridge connected, say');
    expect(container.querySelector('q')?.textContent).toBe('Make the Bridge preview for request #75');
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('Make the Bridge preview for request #75');
    expect(container.textContent).not.toMatch(/API key|secret|\u2014/i);
  });

  it('after her new words: update the preview', () => {
    const { container } = render(createElement(BehaviorReplay, { ...base, viewer: 'requester', state: { kind: 'ask', update: true } }));
    expect(container.textContent).toContain('Ask your Claude to update the preview.');
    expect(container.querySelector('q')?.textContent).toBe('Update the Bridge preview for request #75');
  });

  it('ready: today and the preview side by side, the same keys, Updated from your words', async () => {
    const { container } = render(
      createElement(BehaviorReplay, { ...base, viewer: 'requester', announces: 'Shipping speed, collapsed', state: { kind: 'ready', today: 'https://sb.acme.com/iframe.html?id=s&embed=bridge-keys', preview: 'https://p.acme.com/iframe.html?id=s&embed=bridge-keys', updated: true } }),
    );
    expect([...container.querySelectorAll('figcaption')].map((f) => f.textContent)).toEqual(['Today', "Claude's preview"]);
    expect(screen.getByLabelText('Keys: Enter, ArrowDown, Tab')).toBeTruthy();
    expect(screen.getByText(REPLAY_WORDS.updated)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play both' })).toBeTruthy();
    expect(container.textContent).toContain('Expected announcement: Shipping speed, collapsed');
    // Each frame has its title; axe in jsdom cannot enter another origin's frame, so it checks the page around them.
    expect([...container.querySelectorAll('iframe')].map((f) => f.title)).toEqual(['Select, Today', "Select, Claude's preview"]);
    container.querySelectorAll('iframe').forEach((f) => f.remove());
    await expectNoAxeViolations(container);
  });

  it('preparing, failed and unplayable say it plainly', () => {
    const { rerender, container } = render(createElement(BehaviorReplay, { ...base, viewer: 'lead', state: { kind: 'preparing', by: 'Malik Diallo' } }));
    expect(screen.getByRole('status').textContent).toBe("Malik's Claude is preparing the preview.");
    rerender(createElement(BehaviorReplay, { ...base, viewer: 'lead', state: { kind: 'failed', reason: 'The component has no tests.' } }));
    expect(container.textContent).toContain('Claude could not make the preview: The component has no tests. You can still decide on the sentences.');
    expect(container.querySelector('q')?.textContent).toBe('Make the Bridge preview for request #75');
    rerender(createElement(BehaviorReplay, { ...base, viewer: 'lead', state: { kind: 'unplayable' } }));
    expect(container.textContent).toContain('your Storybook does not publish each branch');
  });
});
