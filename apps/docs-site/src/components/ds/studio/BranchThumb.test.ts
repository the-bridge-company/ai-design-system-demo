// @vitest-environment jsdom
// The screen thumbnail of an exploration: its preview capture with "Captured ... ago" on a card, the plate when there
// is none, and the plate again, in the same box, when the image does not load.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BranchThumb, captureAgeOf } from './BranchThumb';

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
    expect(captureAgeOf(shot)).toBe('Captured 2 h ago');
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
