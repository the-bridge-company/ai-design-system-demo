// @vitest-environment jsdom
// Board G2: the person who asked changes her words; the request is saved with them and the preview reads as being
// prepared again until the workflow answers, then "Updated from your words".
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import BehaviorReplaySlot from './BehaviorReplaySlot';
import type { PreviewPlay } from '../../../scripts/behavior-preview-data';

const ask = { of: 'component' as const, id: 'Select', behavior: 'tab-leaves', today: 'Tab leaves without picking', wanted: 'Tab picks the option' };
const play = (over: Partial<PreviewPlay>): PreviewPlay => ({
  state: { kind: 'ready', today: 'https://sb.acme.com/iframe.html?id=s', preview: 'https://p.acme.com/iframe.html?id=s', updated: false },
  keys: ['Enter', 'Tab'],
  announces: null,
  component: 'Select',
  preview: { state: 'ready', branch: 'agent/preview-75', round: 1, at: '2026-11-15T10:00:00Z' },
  storybook: 'https://sb.acme.com',
  template: 'https://p-{branch}.acme.com',
  storyId: 's',
  behaviors: [],
  ...over,
});

describe('BehaviorReplaySlot', () => {
  it('saves her new words, then reads as preparing until the workflow made the new preview', async () => {
    const user = userEvent.setup();
    const onSaveWords = vi.fn(async () => {});
    const load = vi.fn(async () => play({}));
    render(createElement(BehaviorReplaySlot, { number: 75, ask, viewer: 'requester', settingsHref: '#', onSaveWords, load }));
    await user.click(await screen.findByRole('button', { name: 'Change your words' }));
    const field = screen.getByRole('textbox', { name: /What should it do instead/ });
    await user.clear(field);
    await user.click(screen.getByRole('button', { name: 'Save and update the preview' }));
    expect(await screen.findByText('Say what it should do, in a sentence.')).toBeTruthy();
    await user.type(field, 'Tab picks the highlighted option, Shift+Tab too');
    await user.click(screen.getByRole('button', { name: 'Save and update the preview' }));
    expect(onSaveWords).toHaveBeenCalledWith('Tab picks the highlighted option, Shift+Tab too');
    // The comment still says the old preview: it reads as being prepared.
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Claude is preparing the preview.'));
  });

  it('nobody else edits: the lead plays, without the words', async () => {
    render(createElement(BehaviorReplaySlot, { number: 75, ask, viewer: 'lead', settingsHref: '#', onSaveWords: null, load: async () => play({}) }));
    expect(await screen.findByRole('button', { name: 'Play both' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Change your words' })).toBeNull();
  });
});
