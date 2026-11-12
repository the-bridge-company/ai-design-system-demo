import { renderToStaticMarkup } from 'react-dom/server';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { SegmentedControl } from '../components/SegmentedControl';
import { bindSegmentedControls, segmentedControlHtml } from './index';

const host = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
};

const ITEMS = [
  { value: 'all', label: 'All' },
  { value: 'ocean', label: 'Ocean' },
  { value: 'harbor', label: 'Harbor' },
];

describe('segmentedControlHtml', () => {
  let unbind: (() => void) | null = null;
  afterEach(() => {
    unbind?.();
    unbind = null;
    document.body.innerHTML = '';
  });

  it('gives the group, track and segments the same classes and static contract as <SegmentedControl>', () => {
    for (const props of [{ size: 'sm' as const }, { size: 'md' as const, appearance: 'strong' as const, fullWidth: true }]) {
      const react = host(renderToStaticMarkup(<SegmentedControl label="Brand" value="ocean" items={ITEMS} {...props} />));
      const dom = host(segmentedControlHtml(ITEMS, { label: 'Brand', value: 'ocean', ...props }));
      for (const sel of ['[data-segmented-control]', '[data-segment-track]', '[data-segment]', '[data-segment] > span']) {
        expect(dom.querySelector(sel)?.className, sel).toBe(react.querySelector(sel)?.className);
      }
      const checked = (el: HTMLElement) => [...el.querySelectorAll('[data-segment]')].map((s) => `${s.getAttribute('data-value')}:${s.getAttribute('aria-checked')}`);
      expect(checked(dom)).toEqual(checked(react));
      expect(dom.querySelector('[role="radiogroup"]')).toHaveAttribute('aria-label', 'Brand');
    }
  });

  it('picks on click and with the arrow keys, keeps one tab stop, fires change, and passes axe', async () => {
    document.body.innerHTML = segmentedControlHtml(
      ITEMS.map((i) => ({ ...i, attributes: { 'data-f': 'brand' } })),
      { label: 'Brand' },
    );
    unbind = bindSegmentedControls();
    const group = screen.getByRole('radiogroup', { name: 'Brand' });
    const onChange = vi.fn();
    group.addEventListener('change', onChange);
    const [all, ocean, harbor] = screen.getAllByRole('radio');
    expect(all).toHaveAttribute('aria-checked', 'true');
    expect(all).toHaveAttribute('tabindex', '0');
    expect(ocean).toHaveAttribute('data-f', 'brand');
    fireEvent.click(ocean!);
    expect(ocean).toHaveAttribute('aria-checked', 'true');
    expect(all).toHaveAttribute('aria-checked', 'false');
    expect(all).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(ocean!, { key: 'ArrowRight' });
    expect(harbor).toHaveAttribute('aria-checked', 'true');
    expect(harbor).toHaveFocus();
    fireEvent.keyDown(harbor!, { key: 'ArrowRight' });
    expect(all).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(all!, { key: 'End' });
    expect(harbor).toHaveAttribute('aria-checked', 'true');
    expect(onChange).toHaveBeenCalledTimes(4);
    fireEvent.click(harbor!);
    expect(onChange).toHaveBeenCalledTimes(4);
    await expectNoAxeViolations();
  });

  it('escapes labels and values', () => {
    const html = segmentedControlHtml([{ value: '"x', label: '<b>' }], { label: 'L' });
    expect(html).toContain('data-value="&quot;x"');
    expect(html).toContain('&lt;b&gt;');
  });
});
