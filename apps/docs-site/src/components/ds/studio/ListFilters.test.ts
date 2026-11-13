// @vitest-environment jsdom
// The filters row (ListFilters FilterRow): on a phone it scrolls inside itself, never the page, and fades the edge
// that hides a filter. jsdom lays nothing out, so the CSS rules are read from the stylesheet and the fade is driven by
// faked scroll sizes.
import '../../../../../../packages/react/src/test/setup';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterRow, markRowOverflow, revealInRow } from './ListFilters';

const STYLES = join(__dirname, '../../../styles');
const strip = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');
const listCss = strip(readFileSync(join(STYLES, 'list-filters.css'), 'utf8'));
const reviewCss = strip(readFileSync(join(STYLES, 'library-review.css'), 'utf8'));
const phone = listCss.slice(listCss.indexOf('@media (max-width: 760px)'));
const selectCss = strip(readFileSync(join(__dirname, '../../../../../../packages/react/src/components/Select/Select.module.css'), 'utf8'));

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
    expect(row).toMatch(/scroll-padding-inline:\s*var\(--_fade\)/);
    expect(rule(phone, '.bl-scroll > *')).toMatch(/flex:\s*none/);
  });

  it('keeps absolutely placed parts inside the row: the row and every trigger are positioned', () => {
    // A visually hidden ": " in each trigger is absolute; unpositioned, it escaped the scroller and widened the page
    // to 482px at 390px.
    expect(rule(phone, '.bl-scroll')).toMatch(/position:\s*relative/);
    expect(rule(selectCss, '.trigger')).toMatch(/position:\s*relative/);
  });

  it('gives a filter the DS focus ring, with room for it inside the scrolling row', () => {
    const focus = rule(selectCss, '.hug:focus-visible');
    expect(focus).toMatch(/outline:\s*var\(--focus-ring-width\) solid var\(--focus-ring-color\)/);
    expect(focus).toMatch(/outline-offset:\s*var\(--focus-ring-offset\)/);
    expect(focus).toMatch(/box-shadow:\s*none/);
    const row = rule(phone, '.bl-scroll');
    expect(row).toMatch(/padding:\s*var\(--space-1\)/);
    expect(row).toMatch(/margin:\s*calc\(-1 \* var\(--space-1\)\)/);
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

  // Rects as laid out at 390px: the row shows 366px from x=12; a filter's rect moves left as the row scrolls.
  const laidOut = (row: HTMLElement, el: HTMLElement, left: number, width: number) => {
    sized(row, 629, 366, row.scrollLeft);
    row.getBoundingClientRect = () => ({ left: 12, right: 378, top: 0, bottom: 44, width: 366, height: 44, x: 12, y: 0, toJSON: () => ({}) });
    el.getBoundingClientRect = () => ({ left: 12 + left - row.scrollLeft, right: 12 + left + width - row.scrollLeft, top: 4, bottom: 40, width, height: 36, x: 0, y: 0, toJSON: () => ({}) });
  };

  it('brings a filter that takes focus under the fade fully into the row, clear of the fade, row only', () => {
    const row = document.createElement('div');
    const product = document.createElement('button');
    row.append(product);
    // Product from 196 to 409 in the row's content: 43px past the visible edge.
    laidOut(row, product, 196, 213);
    const scrollTo = vi.spyOn(window, 'scrollTo');
    revealInRow(row, product, 32);
    expect(row.scrollLeft).toBe(196 + 213 + 32 - 366);
    expect(scrollTo).not.toHaveBeenCalled();
    // Back to the first filter: the row scrolls back to its start.
    const status = document.createElement('button');
    row.prepend(status);
    laidOut(row, status, 4, 180);
    revealInRow(row, status, 32);
    expect(row.scrollLeft).toBe(0);
    scrollTo.mockRestore();
  });

  it('leaves the row alone when the focused filter is already clear of the fade', () => {
    const row = document.createElement('div');
    const status = document.createElement('button');
    row.append(status);
    laidOut(row, status, 40, 150);
    revealInRow(row, status, 32);
    expect(row.scrollLeft).toBe(0);
  });

  it('reveals on focus: Tab onto a filter inside the row scrolls the row', () => {
    const { container } = render(createElement(FilterRow, { className: 'bl-narrow', children: [createElement('button', { key: 'a', className: 'bl-filter' }, 'Status'), createElement('button', { key: 'b', className: 'bl-filter' }, 'Product')] }));
    const row = container.firstElementChild as HTMLElement;
    const product = row.querySelectorAll('button')[1] as HTMLElement;
    laidOut(row, product, 196, 213);
    product.focus();
    expect(row.scrollLeft).toBeGreaterThanOrEqual(196 + 213 - 366);
  });
});
