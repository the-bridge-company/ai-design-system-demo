// @vitest-environment jsdom
// The filters row (ListFilters FilterRow): on a phone it scrolls inside itself, never the page, and fades the edge
// that hides a filter. jsdom lays nothing out, so the CSS rules are read from the stylesheet and the fade is driven by
// faked scroll sizes.
import '../../../../../../packages/react/src/test/setup';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FilterRow, markRowOverflow } from './ListFilters';

const STYLES = join(__dirname, '../../../styles');
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const listCss = strip(readFileSync(join(STYLES, 'list-filters.css'), 'utf8'));
const reviewCss = strip(readFileSync(join(STYLES, 'library-review.css'), 'utf8'));
const phone = listCss.slice(listCss.indexOf('@media (max-width: 760px)'));

/** The declarations of the first rule whose selector is exactly `selector` in `css`. */
function rule(css: string, selector: string): string {
  const re = new RegExp(`(^|[}\\s])${selector.replace(/[.[\]"=*>]/g, '\\$&')}\\s*\\{([^}]*)\\}`);
  const m = css.match(re);
  if (!m) throw new Error(`no rule ${selector}`);
  return m[2];
}

describe('filters row: scrolls inside itself on a phone, never the page', () => {
  it('the row container scrolls sideways and never widens its ancestors', () => {
    const row = rule(phone, '.bl-scroll');
    expect(row).toMatch(/overflow-x:\s*auto/);
    expect(row).toMatch(/min-inline-size:\s*0/);
    expect(row).toMatch(/flex-wrap:\s*nowrap/);
    expect(row).toMatch(/contain:\s*inline-size/);
    expect(rule(phone, '.bl-scroll > *')).toMatch(/flex:\s*none/);
  });

  it('its flex and grid ancestors can shrink below their content', () => {
    expect(rule(listCss, '.bl-scroll')).toMatch(/min-inline-size:\s*0/);
    expect(rule(listCss, '.bl-bar')).toMatch(/min-inline-size:\s*0/);
    expect(rule(listCss, '.bl-narrow')).toMatch(/min-inline-size:\s*0/);
    expect(rule(reviewCss, '.lr-bar-row')).toMatch(/min-inline-size:\s*0/);
    expect(rule(reviewCss, '.lr')).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\)/);
  });

  it('a filter keeps its full width in the row (no cut mid-word)', () => {
    expect(rule(phone, '.bl-scroll .bl-filter')).toMatch(/max-inline-size:\s*none/);
  });

  it('the hiding edge fades with a token-sized mask', () => {
    expect(rule(listCss, '.bl-scroll')).toMatch(/--_fade:\s*var\(--space-/);
    for (const edge of ['start', 'end', 'both']) expect(rule(listCss, `.bl-scroll[data-overflow="${edge}"]`)).toMatch(/mask-image:.*var\(--_fade\)/);
  });
});

describe('FilterRow', () => {
  const sized = (el: HTMLElement, scrollWidth: number, clientWidth: number, scrollLeft: number) => {
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth });
    el.scrollLeft = scrollLeft;
  };

  it('renders the page class with the scroll class, as the tag asked', () => {
    const { container } = render(createElement(FilterRow, { as: 'span', className: 'bl-narrow', children: 'x' }));
    const row = container.firstElementChild as HTMLElement;
    expect(row.tagName).toBe('SPAN');
    expect(row).toHaveClass('bl-scroll', 'bl-narrow');
  });

  it('marks the edge that hides filters, and nothing when everything fits', () => {
    const { container } = render(createElement(FilterRow, { className: 'lr-bar-row', children: 'x' }));
    const row = container.firstElementChild as HTMLElement;
    sized(row, 480, 358, 0);
    markRowOverflow(row);
    expect(row.getAttribute('data-overflow')).toBe('end');
    sized(row, 480, 358, 60);
    markRowOverflow(row);
    expect(row.getAttribute('data-overflow')).toBe('both');
    sized(row, 480, 358, 122);
    row.dispatchEvent(new Event('scroll'));
    expect(row.getAttribute('data-overflow')).toBe('start');
    sized(row, 300, 358, 0);
    markRowOverflow(row);
    expect(row.hasAttribute('data-overflow')).toBe(false);
  });
});
