// @vitest-environment jsdom
// The Cmd+K search palette in a Studio (SearchPalette.tsx, scripts/studio-search.ts mocked): what the page holds lists
// at once while a row says the rest is being read; then the results group by kind, explorations first, each group's
// heading naming the kind once. Axe clean. (Its own file: the index is read once per page.)
import '../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../../../../packages/react/src/test/axe';
import { PALETTE_OPEN_EVENT } from '../../lib/palette-search';
import type { SearchItem } from '../../lib/search';
import SearchPalette from './SearchPalette';

// The GitHub reads, held: `paint` shows what is read so far, `finish` ends them.
const live = vi.hoisted(() => {
  let paint: (items: unknown[]) => void = () => undefined;
  let finish: () => void = () => undefined;
  const read = (p: (items: unknown[]) => void) => {
    paint = p;
    return new Promise<void>((r) => (finish = r));
  };
  return { read, paint: (items: unknown[]) => paint(items), finish: () => finish() };
});
vi.mock('../../scripts/studio-search', () => ({
  loadStudioLocal: async () => [
    { kind: 'component', title: 'Avatar', href: '/studio/t/r/components/?c=avatar', meta: 'Data display' },
    { kind: 'token', title: 'color.avatar.bg', href: '/studio/t/r/tokens/?t=color.avatar.bg' },
    { kind: 'page', title: 'Settings', href: '/studio/t/r/settings/' },
  ],
  loadStudioLive: (paint: (items: unknown[]) => void) => live.read(paint),
}));

describe('SearchPalette in a Studio', () => {
  beforeEach(() => {
    document.documentElement.dataset.space = 'studio';
  });
  afterEach(() => {
    cleanup();
    document.body.textContent = '';
    delete document.documentElement.dataset.space;
  });

  it('lists what the page holds at once, says it reads the rest, then groups explorations first', async () => {
    const dialog = document.createElement('div');
    dialog.id = 'palette';
    document.body.append(dialog);
    const count = document.createElement('span');
    count.id = 'palette-count';
    document.body.append(count);
    render(createElement(SearchPalette), { container: dialog });
    await act(async () => {
      dialog.dispatchEvent(new CustomEvent(PALETTE_OPEN_EVENT));
    });
    const input = screen.getByRole('combobox', { name: 'Search' });
    expect(input).toHaveAttribute('placeholder', 'Search explorations, components, tokens');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
    expect(screen.getByText('Reading explorations, reviews and build requests')).toBeInTheDocument();
    await act(async () => {
      // First the explorations without their status (the reviews are read next), then with it.
      live.paint([{ kind: 'exploration', title: 'Avatar sizes', href: '/studio/t/r/explorations/?exploration=3', meta: 'Sofia' } satisfies SearchItem]);
    });
    expect(screen.getByText('Reading explorations, reviews and build requests')).toBeInTheDocument();
    await act(async () => {
      live.paint([{ kind: 'exploration', title: 'Avatar sizes', href: '/studio/t/r/explorations/?exploration=3', meta: 'In review · Sofia' } satisfies SearchItem]);
      live.finish();
    });
    await waitFor(() => expect(screen.queryByText('Reading explorations, reviews and build requests')).not.toBeInTheDocument(), { timeout: 4000 });
    await userEvent.type(input, 'avatar');
    await waitFor(() => expect(count.textContent).toBe('3 results'));
    await waitFor(() => expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([expect.stringContaining('Avatar sizes'), expect.stringContaining('Avatar'), expect.stringContaining('color.avatar.bg')]));
    expect(screen.getByText('Explorations')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Avatar sizes/ })).toHaveTextContent('In review · Sofia');
    await expectNoAxeViolations();
  });
});
