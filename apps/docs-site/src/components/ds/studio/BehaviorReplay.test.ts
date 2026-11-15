// @vitest-environment jsdom
// Play both on a behavior request: the states the lead and the person who asked read, and the two frames with the
// same keys. Axe clean.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import BehaviorReplay, { REPLAY_WORDS } from './BehaviorReplay';

const base = { keys: ['Enter', 'ArrowDown', 'Tab'], settingsHref: '/studio/acme/ds/settings/#team-claude', component: 'Select' };

describe('BehaviorReplay', () => {
  it('ready: today and the preview side by side, the same keys, Updated from your words', async () => {
    const { container } = render(
      createElement(BehaviorReplay, { ...base, viewer: 'requester', announces: 'Shipping speed, collapsed', state: { kind: 'ready', today: 'https://sb.acme.com/iframe.html?id=s&embed=bridge-keys', preview: 'https://p.acme.com/iframe.html?id=s&embed=bridge-keys', updated: true } }),
    );
    expect([...container.querySelectorAll('figcaption')].map((f) => f.textContent)).toEqual(['Today', "Claude's preview"]);
    expect(container.querySelectorAll('iframe')).toHaveLength(2);
    expect(screen.getByLabelText('Keys: Enter, ArrowDown, Tab')).toBeTruthy();
    expect(screen.getByText(REPLAY_WORDS.updated)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play both' })).toBeTruthy();
    expect(container.textContent).toContain('Expected announcement: Shipping speed, collapsed');
    // Each frame has its title; axe in jsdom cannot enter another origin's frame, so it checks the page around them.
    expect([...container.querySelectorAll('iframe')].map((f) => f.title)).toEqual(['Select, Today', "Select, Claude's preview"]);
    container.querySelectorAll('iframe').forEach((f) => f.remove());
    await expectNoAxeViolations(container);
  });

  it('off: the lead reads how to turn it on, the person who asked reads nothing', async () => {
    const lead = render(createElement(BehaviorReplay, { ...base, viewer: 'lead', state: { kind: 'off' } }));
    expect(lead.container.textContent).toContain("Claude's previews are off for this team.");
    expect(screen.getByRole('link', { name: 'Turn them on in Settings' }).getAttribute('href')).toBe(base.settingsHref);
    await expectNoAxeViolations(lead.container);
    lead.unmount();
    const asked = render(createElement(BehaviorReplay, { ...base, viewer: 'requester', state: { kind: 'off' } }));
    expect(asked.container.textContent).toBe('');
  });

  it('preparing, failed and unplayable say it plainly', () => {
    const { rerender, container } = render(createElement(BehaviorReplay, { ...base, viewer: 'lead', state: { kind: 'preparing' } }));
    expect(screen.getByRole('status').textContent).toBe('Claude is preparing the preview.');
    rerender(createElement(BehaviorReplay, { ...base, viewer: 'lead', state: { kind: 'failed', reason: 'The component has no tests.' } }));
    expect(container.textContent).toBe('Claude could not make the preview: The component has no tests. You can still decide on the sentences.');
    rerender(createElement(BehaviorReplay, { ...base, viewer: 'requester', state: { kind: 'failed', reason: null } }));
    expect(container.textContent).toBe('Claude could not make the preview.');
    rerender(createElement(BehaviorReplay, { ...base, viewer: 'lead', state: { kind: 'unplayable' } }));
    expect(container.textContent).toContain('your Storybook does not publish each branch');
    expect(container.textContent).not.toMatch(/\u2014/);
  });
});
