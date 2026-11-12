// @vitest-environment jsdom
// People (People.tsx), the one group of people in Studio: the DS AvatarGroup at the context's size, every face up to
// three, two and "+N" past that, the names beside the faces, the notified sentence, axe clean. The line's layout is
// checked on its class contract (styles/people.css): faces and words centred on one axis, the DS gap, ui 14/20 in
// the default ink.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import { People } from './People';
import { notifiedLine } from '../../../lib/people-line';

afterEach(cleanup);

/** The size class of each avatar of the group (CSS Modules scope it: "_sm_x1y2" or "sm"). */
const sizes = (root: Element) =>
  [...root.querySelectorAll('[role="group"] > *')].map((el) => [...el.classList].map((c) => /^_?(xs|sm|md|lg)(_|$)/.exec(c)?.[1]).find(Boolean) ?? null);

describe('People', () => {
  it('two people: both faces in the DS AvatarGroup at sm, both names, no "+1"', async () => {
    const { container } = render(createElement(People, { names: ['Sofia', 'Leo'], size: 'sm' }));
    const group = container.querySelector('[role="group"]')!;
    expect(group.children).toHaveLength(2);
    expect(sizes(container)).toEqual(['sm', 'sm']);
    expect(screen.getByText('Sofia and Leo')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/\+1/);
    await expectNoAxeViolations(container);
  });

  it('three people: every face and every name', () => {
    const { container } = render(createElement(People, { names: ['Sofia', 'Leo', 'Ann'] }));
    expect(container.querySelector('[role="group"]')!.children).toHaveLength(3);
    expect(screen.getByText('Sofia, Leo and Ann')).toBeInTheDocument();
  });

  it('four people and more: two faces and the group\'s own "+N", two names and the rest counted', async () => {
    const { container } = render(createElement(People, { names: ['Sofia', 'Leo', 'Ann', 'Dana', 'Kai'] }));
    const group = container.querySelector('[role="group"]')!;
    expect(group.children).toHaveLength(3);
    expect(group.lastElementChild!.textContent).toBe('+3');
    expect(screen.getByText('Sofia, Leo and 3 others')).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('says who will be notified as a sentence beside the faces', async () => {
    const { container } = render(createElement(People, { names: ['Sofia', 'Leo'], text: notifiedLine(['Sofia', 'Leo']) }));
    expect(screen.getByText('Sofia and Leo will be notified.')).toHaveClass('people-names');
    expect(container.firstElementChild).toHaveClass('people', 'is-sm');
    await expectNoAxeViolations(container);
  });

  it('faces only: the names become the group\'s accessible name', async () => {
    render(createElement(People, { names: ['Sofia', 'Leo'], facesOnly: true }));
    expect(screen.getByRole('group', { name: 'Sofia and Leo' })).toBeInTheDocument();
    await expectNoAxeViolations();
  });

  it('draws nobody when there is nobody', () => {
    const { container } = render(createElement(People, { names: [] }));
    expect(container.innerHTML).toBe('');
  });
});

describe('People line, its class contract', () => {
  const css = readFileSync(join(__dirname, '../../../styles/people.css'), 'utf8');
  const rule = (selector: string) => {
    const at = css.indexOf(`\n${selector} {`);
    expect(at, selector).toBeGreaterThan(-1);
    return css.slice(at, css.indexOf('}', at));
  };

  it('centres the faces on the words with the DS gap, in ui 14/20 and the default ink', () => {
    const line = rule('.people');
    expect(line).toMatch(/display: inline-flex;/);
    expect(line).toMatch(/align-items: center;/);
    expect(line).toMatch(/gap: var\(--space-2\);/);
    expect(line).toMatch(/font-size: var\(--typography-ui-size\);/);
    expect(line).toMatch(/line-height: var\(--typography-ui-line-height\);/);
    expect(line).toMatch(/color: var\(--color-text-default\);/);
    expect(css).not.toMatch(/--typography-meta/);
    expect(rule('.people-faces')).toMatch(/flex: none;/);
  });
});
