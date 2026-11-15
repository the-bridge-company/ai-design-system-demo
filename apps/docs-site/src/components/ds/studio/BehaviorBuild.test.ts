// @vitest-environment jsdom
// A behavior request in Being built: the change for everyone (today struck, the wanted one, who asked and who made it
// the default), and for a developer the behavior id with its keys, the files to change, the Base UI primitive and
// "Copy the request for Claude". Only what the repository says is shown. Axe clean.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import { BehaviorDevelopers, BehaviorSent } from './BehaviorBuild';
import type { BehaviorAsk } from '@bridge-ds/core';

const ask: BehaviorAsk = { of: 'component', id: 'Select', behavior: 'tab-leaves', today: 'Tab leaves without picking', wanted: 'Tab picks the highlighted option', where: 'Checkout' };

describe('BehaviorSent', () => {
  it('says today, the wanted sentence, where and who, once', async () => {
    const { container } = render(createElement(BehaviorSent, { ask, meta: 'Asked by Sofia on Nov 14. Dana made it the default on Nov 15.' }));
    expect(container.querySelector('s')?.textContent).toBe('Tab leaves without picking');
    expect(container.textContent).toContain('Today: Tab leaves without picking');
    expect(container.textContent).toContain('Wanted: Tab picks the highlighted option');
    expect(screen.getByText('It gets in the way in Checkout.')).toBeTruthy();
    expect(screen.getByText('Asked by Sofia on Nov 14. Dana made it the default on Nov 15.')).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});

describe('BehaviorDevelopers', () => {
  it('shows the id, its keys, the real files and the primitive, and copies the request for Claude', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const facts = {
      keys: ['Tab'],
      files: ['packages/react/src/components/Select/Select.tsx', 'packages/react/src/components/Select/Select.docs.json', 'packages/react/src/components/Select/Select.test.tsx'],
      primitives: [{ name: 'Select', module: '@base-ui/react/select' }],
    };
    const { container } = render(createElement(BehaviorDevelopers, { ask, facts, brief: 'the brief', github: { href: 'https://github.com/acme/ds/issues/75', label: 'Build request #75 on GitHub' } }));
    expect(screen.getByText('tab-leaves')).toBeTruthy();
    // Labelled rows, then the request on GitHub, then the copy, last.
    expect([...container.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Behavior', 'Files to change', 'Base UI']);
    expect(container.querySelector('.bb-bh-keys kbd, .bb-bh-keys [class*="kbd"]')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Build request #75 on GitHub' })).toBeTruthy();
    const order = [...container.querySelectorAll('dl, a, button')].map((e) => e.tagName);
    expect(order).toEqual(['DL', 'A', 'BUTTON']);
    expect(container.querySelectorAll('.bb-bh-files li')).toHaveLength(3);
    expect(screen.getByText('It wraps Select from @base-ui/react/select.')).toBeTruthy();
    await expectNoAxeViolations(container);
    await user.click(screen.getByRole('button', { name: 'Copy the request for Claude' }));
    expect(writeText).toHaveBeenCalledWith('the brief');
    expect(screen.getByRole('status').textContent).toBe('Copied. Paste it in Claude Code.');
  });

  it('says it reads while the facts come, and invents nothing when the repository says nothing', () => {
    const { rerender, container } = render(createElement(BehaviorDevelopers, { ask, facts: null, brief: null }));
    expect(screen.getByText('Reading the files of Select.')).toBeTruthy();
    rerender(createElement(BehaviorDevelopers, { ask, facts: {}, brief: null }));
    // A read that came back empty: no bare id, no row.
    expect(container.textContent).not.toContain('tab-leaves');
    expect(container.querySelector('dl')).toBeNull();
    expect(container.textContent).not.toContain('Files to change');
    expect(container.textContent).not.toContain('It wraps');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
