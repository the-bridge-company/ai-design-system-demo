import { afterEach, describe, expect, it } from 'vitest';
import { bottomBars, createRoom, roomFor, scrollerUnder } from './room';

afterEach(() => {
  document.body.innerHTML = '';
  document.body.removeAttribute('style');
});

describe('the room the toolbar takes', () => {
  it('is the bar, its offset from the bottom edge and a gap', () => {
    expect(roomFor({ height: 44, bottom: 16, gap: 16 })).toBe(76);
    // Phone, open: docked to the edge, the safe area is inside the bar's own height.
    expect(roomFor({ height: 52.4, bottom: 0, gap: 8 })).toBe(61);
    expect(roomFor({ height: 44, bottom: -4, gap: -1 })).toBe(44);
  });

  it('adds to the element padding, follows the bar, and gives the padding back', () => {
    const main = document.createElement('main');
    main.style.paddingBottom = '24px';
    document.body.appendChild(main);
    const room = createRoom();
    room.reserve(main, 76);
    expect(main.style.paddingBottom).toBe('100px');
    room.reserve(main, 60);
    expect(main.style.paddingBottom).toBe('84px');
    // The scroller changes (another screen): the first one gets its own padding back.
    room.reserve(document.body, 60);
    expect(main.style.paddingBottom).toBe('24px');
    expect(document.body.style.paddingBottom).toBe('60px');
    room.release();
    expect(document.body.style.paddingBottom).toBe('');
  });

  it('finds the product own bottom bar to stand on, and leaves the rest of the page alone', () => {
    const save = document.createElement('div');
    save.style.position = 'sticky';
    save.style.bottom = '0px';
    const header = document.createElement('header');
    header.style.position = 'sticky';
    header.style.top = '0px';
    document.body.append(header, save);
    const rect = (el: Element, r: { left: number; top: number; width: number; height: number }) =>
      Object.defineProperty(el, 'getBoundingClientRect', { configurable: true, value: () => ({ ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top }) });
    rect(save, { left: 272, top: 831, width: 792, height: 69 });
    rect(header, { left: 240, top: 0, width: 1200, height: 56 });
    const found = bottomBars({ left: 256, right: 1424 }, 900, null);
    expect(found.bars).toEqual([save]);
    expect(found.floor).toBe(69);
    // A narrow toast or chip at the bottom is not a floor.
    rect(save, { left: 1200, top: 860, width: 120, height: 40 });
    expect(bottomBars({ left: 256, right: 1424 }, 900, null).floor).toBe(0);
  });

  it('counts the floor in the room it takes', () => {
    expect(roomFor({ height: 46, bottom: 16, gap: 16, floor: 69 })).toBe(147);
  });

  it('pads the document when nothing under the bar scrolls by itself', () => {
    expect(scrollerUnder({ top: 500, left: 0, right: 300, bottom: 544, width: 300, height: 44 } as DOMRect, null)).toBe(document.body);
  });
});
