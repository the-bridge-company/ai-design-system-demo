// @vitest-environment jsdom
// The screen thumbnail of an exploration: its preview capture with "Captured ... ago" on a card, the plate when there
// is none, and the plate again, in the same box, when the image does not load. A component change without pictures:
// the component's Library preview, else its icon.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BranchThumb, captureAgeOf } from './BranchThumb';
import { ComponentPreviewsProvider, type ComponentPreviews } from './ComponentPreviews';

afterEach(cleanup);

// Midday: "2 h ago" never crosses midnight (it reads "yesterday" then, as CI found at 00:05).
const NOON = new Date(2026, 10, 5, 12, 0);
beforeAll(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOON);
});
afterAll(() => void vi.useRealTimers());

const shot = { kind: 'screen' as const, src: 'https://raw.githubusercontent.com/o/r/bridge-shots/o/p/2.webp?v=abc1234', capturedAt: new Date(NOON.getTime() - 2 * 3600 * 1000).toISOString(), product: 'Product admin', screen: 'Dashboard', seed: 'admin-app#2' };

describe('BranchThumb, explored screens', () => {
  it('shows the capture and when it was taken on a card', () => {
    const { container } = render(createElement(BranchThumb, { spec: shot, size: 'card' }));
    expect(container.querySelector('img.bt-screen')?.getAttribute('src')).toBe(shot.src);
    expect(container.querySelector('.bt-captured')?.textContent).toBe('Captured 2 h ago');
    expect(container.querySelector('.bt')!.classList.contains('is-shot')).toBe(true);
  });

  it('keeps a row thumbnail to the image only', () => {
    const { container } = render(createElement(BranchThumb, { spec: shot, size: 'row' }));
    expect(container.querySelector('img.bt-screen')).toBeTruthy();
    expect(container.querySelector('.bt-captured')).toBeNull();
  });

  it('falls back to the plate when the image does not load', () => {
    const { container } = render(createElement(BranchThumb, { spec: shot, size: 'card' }));
    fireEvent.error(container.querySelector('img')!);
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.bt-plate-screen')?.textContent).toBe('Dashboard');
    expect(container.querySelector('.bt-plate-product')?.textContent).toBe('Product admin');
  });

  it('draws the plate without a capture, one drawing per exploration', () => {
    const a = render(createElement(BranchThumb, { spec: { kind: 'screen', src: null, product: 'Product admin', screen: null, seed: 'admin-app#2' }, size: 'card' }));
    const first = a.container.querySelector('svg')!.innerHTML;
    expect(a.container.querySelector('.bt-plate-screen')?.textContent).toBe('Product admin');
    cleanup();
    const seeds = ['600', '601', '611', '612', 'admin-app#3'];
    const others = seeds.map((seed) => {
      const r = render(createElement(BranchThumb, { spec: { kind: 'screen', src: null, product: 'Product admin', seed }, size: 'card' }));
      const html = r.container.querySelector('svg')!.innerHTML;
      cleanup();
      return html;
    });
    expect(others.some((h) => h !== first)).toBe(true);
  });
});

describe('BranchThumb, the card corner', () => {
  it('names the product in the corner of a capture; its age goes to the footer', () => {
    const { container } = render(createElement(BranchThumb, { spec: shot, size: 'card', chip: 'Art print shop' }));
    expect(container.querySelector('.bt-chip')?.textContent).toBe('Art print shop');
    expect(container.querySelectorAll('.bt-captured')).toHaveLength(1);
    expect(captureAgeOf(shot)).toBe('2 h ago');
  });

  it('leaves the corner empty on a list of one product', () => {
    const { container } = render(createElement(BranchThumb, { spec: shot, size: 'card', chip: null }));
    expect(container.querySelector('.bt-captured')).toBeNull();
  });

  it('names the product on a plate too, once: the plate keeps the screen only', () => {
    const plate = { kind: 'screen' as const, src: null, product: 'Art print shop', screen: 'Order list', seed: 'a#1' };
    const { container } = render(createElement(BranchThumb, { spec: plate, size: 'card', chip: 'Art print shop' }));
    expect(container.querySelector('.bt-chip')?.textContent).toBe('Art print shop');
    expect(container.querySelector('.bt-plate-screen')?.textContent).toBe('Order list');
    expect(container.querySelector('.bt-plate-product')).toBeNull();
    expect(captureAgeOf(plate)).toBeNull();
  });

  it('never puts a chip on a row thumbnail', () => {
    const { container } = render(createElement(BranchThumb, { spec: shot, size: 'row', chip: 'Art print shop' }));
    expect(container.querySelector('.bt-chip')).toBeNull();
  });
});

describe('BranchThumb, a component change without pictures', () => {
  const spec = { kind: 'component' as const, name: 'Avatar', label: 'Avatar' };
  const previews = (over: Partial<ComponentPreviews> = {}): ComponentPreviews => ({
    components: new Map([['Avatar', { name: 'Avatar', storyId: 'display-avatar--default' }]]),
    storybook: 'https://storybook.example.com',
    ...over,
  });
  const withPreviews = (p: ComponentPreviews | null, size: 'row' | 'card' = 'card') =>
    render(createElement(ComponentPreviewsProvider, { value: p }, createElement(BranchThumb, { spec, size })));

  it("shows the component's first story from the Storybook, light, inert and sandboxed", () => {
    const { container } = withPreviews(previews());
    const stage = container.querySelector('.bt-stage')!;
    expect(stage.classList.contains('stage-checker')).toBe(true);
    expect(stage.getAttribute('data-theme')).toBe('light');
    expect(stage.hasAttribute('inert')).toBe(true);
    const frame = container.querySelector('iframe.bt-frame')!;
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts allow-same-origin');
    expect(frame.getAttribute('loading')).toBe('lazy');
    // jsdom has no IntersectionObserver: the frame starts at once, as a plain lazy frame.
    expect(frame.getAttribute('src')).toContain('id=display-avatar--default');
    expect(frame.getAttribute('src')).toContain('theme:light');
    // Fitted (lib/story-frame): the story asked for its thumbnail canvas, hidden until its posted size places it.
    expect(frame.getAttribute('src')).toContain('embed=bridge-thumb');
    expect(stage.classList.contains('is-fit')).toBe(true);
    expect(frame.classList.contains('stage-fit-frame')).toBe(true);
    expect(frame.classList.contains('is-fitted')).toBe(false);
    expect(container.querySelector('.bt')!.getAttribute('data-label')).toBe('Avatar');
  });

  it('draws the Library example when the page runs the components', () => {
    const Example = ({ node }: { node: unknown }) => createElement('b', { className: 'ex' }, String((node as { c: string }).c));
    const { container } = withPreviews(previews({ components: new Map([['Avatar', { name: 'Avatar', preview: { c: 'Avatar' } }]]), Example }));
    expect(container.querySelector('.bt-stage .ex')?.textContent).toBe('Avatar');
    // Measured in the page, inside the fitted box.
    expect(container.querySelector('.bt-stage > .stage-fit > .ex')).toBeTruthy();
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('keeps the component icon without previews, or without one for this component', () => {
    for (const p of [null, previews({ storybook: undefined }), previews({ components: new Map() })]) {
      const { container } = withPreviews(p, 'row');
      expect(container.querySelector('.bt-stage')).toBeNull();
      expect(container.querySelector('svg')).toBeTruthy();
      cleanup();
    }
  });
});
