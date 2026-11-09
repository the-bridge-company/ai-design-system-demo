import { afterEach, describe, expect, it } from 'vitest';
import { createRoom, roomFor, scrollerUnder } from './room';

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

  it('pads the document when nothing under the bar scrolls by itself', () => {
    expect(scrollerUnder({ top: 500, left: 0, right: 300, bottom: 544, width: 300, height: 44 } as DOMRect, null)).toBe(document.body);
  });
});
