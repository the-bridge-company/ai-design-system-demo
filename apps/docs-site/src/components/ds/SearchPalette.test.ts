// @vitest-environment jsdom
// The Cmd+K search palette (SearchPalette.tsx), the DS Combobox in inline mode: the shell's open event clears the
// query and loads the index; with no query it lists pages and components, never tokens; typing ranks (components
// first) and the first result is highlighted; Enter opens it; nothing found says what to try. Axe clean.
import '../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../../../../packages/react/src/test/axe';
import { PALETTE_OPEN_EVENT, rankResults } from '../../lib/palette-search';
import type { SearchItem } from '../../lib/search';
import SearchPalette from './SearchPalette';

const INDEX: SearchItem[] = [
  { kind: 'page', title: 'Color', href: '/foundations/color', meta: 'Palette, roles and contrast' },
  { kind: 'component', title: 'Button', href: '/components/button', meta: 'Actions' },
  { kind: 'component', title: 'Badge', href: '/components/badge', meta: 'Data display' },
  { kind: 'token', title: 'color.action.primary.bg', href: '/tokens?focus=color.action.primary.bg', meta: '#0B3A5B', swatch: '#0B3A5B', keys: 'button' },
];

describe('rankResults', () => {
  it('lists pages and components with no query, and ranks components before tokens', () => {
    expect(rankResults('', INDEX).map((x) => x.kind)).toEqual(['page', 'component', 'component']);
    const hits = rankResults('butt', INDEX).map((x) => x.title);
    expect(hits[0]).toBe('Button');
    expect(hits).toContain('color.action.primary.bg');
  });
});

describe('SearchPalette', () => {
  let assigned = '';
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(INDEX))));
    assigned = '';
    Object.defineProperty(window, 'location', { configurable: true, value: { ...window.location, set href(v: string) { assigned = v; }, get href() { return assigned; } } });
  });
  afterEach(() => {
    cleanup();
    document.body.textContent = '';
    vi.unstubAllGlobals();
  });

  const mount = async () => {
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
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(3));
    return { input, count };
  };

  it('lists pages and components when it opens, inline under the field', async () => {
    const { input } = await mount();
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('option', { name: /Button/ })).toHaveTextContent('Component');
    await expectNoAxeViolations();
  });

  it('ranks while typing, highlights the first result and opens it with Enter', async () => {
    const { input, count } = await mount();
    await userEvent.type(input, 'butt');
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));
    await waitFor(() => expect(screen.getAllByRole('option')[0]).toHaveAttribute('data-highlighted'));
    expect(count.textContent).toBe('2 results');
    await userEvent.keyboard('{Enter}');
    expect(assigned).toBe('/components/button');
  });

  it('says what to try when nothing matches', async () => {
    const { input } = await mount();
    await userEvent.type(input, 'zzzz');
    expect(await screen.findByText('Nothing matches "zzzz". Try a token path like color.action, or a hex.')).toBeInTheDocument();
    await expectNoAxeViolations();
  });
});
