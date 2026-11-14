// @vitest-environment jsdom
// The Behaviors section of a component page: the list grouped by family with DS Kbd keys and the expected
// announcement, and one stage with the real component. Bridge's own page runs the component in the page; a team's
// Library plays its Storybook story. Try it puts focus on the real component.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import { repoModel } from '../../../lib/model';
import { loadComponents } from '../../../lib/library/components';
import { readableDocs } from '../../../lib/library/component-page';
import type { LibraryData } from './library-data';
import ComponentView from './views/ComponentView';
import Behaviors from './Behaviors';

const SB = 'https://storybook.example.com';
const team: LibraryData = { model: repoModel, team: { owner: 'acme', repo: 'ds' }, extras: { storybook: SB, sourceBase: 'https://github.com/acme/ds/blob/main/' } };
const byName = (n: string) => loadComponents(repoModel).find((c) => c.name === n)!;
const section = (el: HTMLElement) => el.querySelector<HTMLElement>('section[aria-labelledby="behaviors"]');
const nextFrame = () => act(() => new Promise<void>((r) => requestAnimationFrame(() => r())));

describe('Behaviors section', () => {
  it('shows on a component with behaviors, grouped by family, keys in the DS Kbd, and only there', () => {
    const select = render(createElement(ComponentView, { data: team, component: byName('Select') })).container;
    const s = section(select)!;
    expect(s).not.toBeNull();
    expect([...s.querySelectorAll('h3')].map((h) => h.textContent)).toEqual(['Opening', 'Moving', 'Picking', 'Closing', 'Focus']);
    expect(s.querySelectorAll('.bh-row')).toHaveLength(9);
    const escape = [...s.querySelectorAll('.bh-row')].find((r) => r.textContent?.includes('Closes on Escape'))!;
    expect(escape.querySelector('kbd')?.textContent).toContain('Esc');
    expect(section(render(createElement(ComponentView, { data: team, component: byName('Button') })).container)).toBeNull();
  });

  it("on a team's Library, plays the team's Storybook story as the stage", () => {
    const s = section(render(createElement(ComponentView, { data: team, component: byName('Select') })).container)!;
    const frame = s.querySelector('iframe')!;
    expect(frame.getAttribute('src')).toBe(`${SB}/iframe.html?id=${byName('Select').stories[0]!.id}&viewMode=story&globals=theme:light`);
    expect(s.querySelectorAll('button')).toHaveLength(9);
  });

  it('runs the real component in the page, says the expected announcement, and Try it focuses the component', async () => {
    const d = readableDocs(byName('Combobox').docs)!;
    const { container } = render(createElement(Behaviors, { name: 'Combobox', behaviors: d.behaviors!, preview: d.preview ?? null, live: true }));
    const stage = container.querySelector<HTMLElement>('.bh-stage')!;
    expect(within(stage).getByRole('combobox', { name: 'Reviewer' })).toBeInTheDocument();
    expect(container.textContent).toContain('Expected announcement: No matches. Try another name.');

    fireEvent.click(screen.getByRole('button', { name: 'Try it: Says when results are loading' }));
    await nextFrame();
    expect(screen.getByRole('button', { name: 'Try it: Says when results are loading' })).toHaveAttribute('aria-pressed', 'true');
    expect(stage.querySelector('.bh-stage-note')!.textContent).toBe('Now: Says when results are loading');
    expect(document.activeElement).toBe(within(stage).getByRole('combobox', { name: 'Reviewer' }));
    await expectNoAxeViolations();
  });
});
