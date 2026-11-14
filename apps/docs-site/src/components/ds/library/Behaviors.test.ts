// @vitest-environment jsdom
// The Behaviors section of a component page: one stage with the real component, then one list per family, each row a
// DS toggle Button with its keys in the DS Kbd and the expected announcement. The row picked tells, on the stage, what
// to do. Bridge's own page runs the component in the page; a team's Library plays its Storybook story.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import { repoModel } from '../../../lib/model';
import { loadComponents } from '../../../lib/library/components';
import { CP_TOC_REFRESH, readableDocs } from '../../../lib/library/component-page';
import type { LibraryData } from './library-data';
import ComponentView from './views/ComponentView';
import Behaviors from './Behaviors';

const SB = 'https://storybook.example.com';
const team: LibraryData = { model: repoModel, team: { owner: 'acme', repo: 'ds' }, extras: { storybook: SB, sourceBase: 'https://github.com/acme/ds/blob/main/' } };
const byName = (n: string) => loadComponents(repoModel).find((c) => c.name === n)!;
const section = (el: HTMLElement) => el.querySelector<HTMLElement>('section[aria-labelledby="behaviors"]');

describe('Behaviors section', () => {
  it('shows on a component with behaviors: one list per family, rows as toggles, keys in the DS Kbd; only there', () => {
    const s = section(render(createElement(ComponentView, { data: team, component: byName('Select') })).container)!;
    expect(s).not.toBeNull();
    expect([...s.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Opening', 'Moving', 'Picking', 'Closing', 'Focus']);
    expect(s.querySelectorAll('ul')).toHaveLength(5);
    const rows = [...s.querySelectorAll<HTMLButtonElement>('ul button')];
    expect(rows).toHaveLength(9);
    // Say it once: no separate Try it buttons, no intro sentence; the first row starts picked.
    expect(within(s).queryByRole('button', { name: /^Try it/ })).toBeNull();
    expect(rows.filter((r) => r.getAttribute('aria-pressed') === 'true').map((r) => r.querySelector('.bh-text')?.textContent)).toEqual(['Opens a list']);
    const escape = rows.find((r) => r.textContent?.includes('Closes on Escape'))!;
    expect(escape.querySelector('kbd')?.textContent).toContain('Esc');
    expect(section(render(createElement(ComponentView, { data: team, component: byName('Button') })).container)).toBeNull();
  });

  it("on a team's Library, plays the team's Storybook story as the stage, placed before the list", () => {
    const s = section(render(createElement(ComponentView, { data: team, component: byName('Select') })).container)!;
    const stage = within(s).getByRole('region', { name: 'Try it on the real Select' });
    expect(stage.querySelector('iframe')!.getAttribute('src')).toBe(`${SB}/iframe.html?id=${byName('Select').stories[0]!.id}&viewMode=story&globals=theme:light`);
    expect(stage.compareDocumentPosition(s.querySelector('.bh-list')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('runs the real component in the page; picking a row says what to do and swaps in its own example', async () => {
    const d = readableDocs(byName('Combobox').docs)!;
    const toc = vi.fn();
    document.addEventListener(CP_TOC_REFRESH, toc);
    const { container } = render(createElement(Behaviors, { name: 'Combobox', behaviors: d.behaviors!, preview: d.preview ?? null, live: true }));
    expect(toc).toHaveBeenCalledTimes(1);
    const stage = screen.getByRole('region', { name: 'Try it on the real Combobox' });
    expect(within(stage).getByRole('combobox', { name: 'Reviewer' })).toBeInTheDocument();
    expect(container.textContent).toContain('Expected announcement: No matches. Try another name.');
    expect(stage.querySelector('.bh-stage-note')!.textContent).toBe('Type ba in the field');

    const loading = screen.getByRole('button', { name: /Says when results are loading/ });
    fireEvent.click(loading);
    expect(loading).toHaveAttribute('aria-pressed', 'true');
    expect(stage.querySelector('.bh-stage-note')!.textContent).toBe('Click the field: the list says it is loading');
    expect(within(stage).getByRole('combobox', { name: 'Reviewer' })).toBeInTheDocument();
    // Picking keeps focus on the row, so the list stays easy to walk with the keyboard.
    expect(document.activeElement === loading || document.activeElement === document.body).toBe(true);
    await expectNoAxeViolations();
  });
});
