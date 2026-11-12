import { describe, expect, it } from 'vitest';
import { embedStoryUrl, fitCss, fitTransform, postedStoryHeight, postedStorySize, thumbStoryUrl } from './story-frame';

describe('story frame', () => {
  it('appends the embed parameter to a story URL', () => {
    expect(embedStoryUrl('https://sb.example.com/iframe.html?id=a--b&viewMode=story')).toBe('https://sb.example.com/iframe.html?id=a--b&viewMode=story&embed=bridge');
    expect(embedStoryUrl('https://sb.example.com/iframe.html')).toBe('https://sb.example.com/iframe.html?embed=bridge');
  });

  it('reads only a sane posted story height', () => {
    expect(postedStoryHeight({ type: 'bridge:story-height', height: 211.4 })).toBe(212);
    expect(postedStoryHeight({ type: 'bridge:story-height', height: 1e9 })).toBe(10000);
    expect(postedStoryHeight({ type: 'storybook-channel', height: 200 })).toBeNull();
    expect(postedStoryHeight({ type: 'bridge:story-height', height: '200' })).toBeNull();
    expect(postedStoryHeight({ type: 'bridge:story-height', height: 0 })).toBeNull();
    expect(postedStoryHeight({ type: 'bridge:story-height', height: Number.NaN })).toBeNull();
    expect(postedStoryHeight(null)).toBeNull();
    expect(postedStoryHeight('bridge:story-height')).toBeNull();
  });
});

describe('story frame as a thumbnail', () => {
  it('asks the story for the thumbnail canvas', () => {
    expect(thumbStoryUrl('https://sb.example.com/iframe.html?id=a--b')).toBe('https://sb.example.com/iframe.html?id=a--b&embed=bridge-thumb');
  });

  it('reads only a sane posted content box', () => {
    expect(postedStorySize({ type: 'bridge:story-size', left: 16, top: 16, width: 400, height: 120 })).toEqual({ left: 16, top: 16, width: 400, height: 120 });
    expect(postedStorySize({ type: 'bridge:story-height', height: 10 })).toBeNull();
    expect(postedStorySize({ type: 'bridge:story-size', left: 0, top: 0, width: 0, height: 10 })).toBeNull();
    expect(postedStorySize({ type: 'bridge:story-size', left: 0, top: 0, width: '9', height: 10 })).toBeNull();
    expect(postedStorySize(null)).toBeNull();
  });

  it('shrinks a large story until all of it shows inside the padding, centered', () => {
    // A 600 by 200 table in a 262 by 136 card with 16px inside: the width decides.
    const f = fitTransform({ left: 16, top: 16, width: 600, height: 200 }, { width: 262, height: 136 }, 16);
    expect(f.scale).toBeCloseTo(230 / 600);
    const shown = { left: f.x + 16 * f.scale, top: f.y + 16 * f.scale, width: 600 * f.scale, height: 200 * f.scale };
    expect(shown.left).toBeCloseTo(16);
    expect(shown.left + shown.width).toBeCloseTo(262 - 16);
    // Centered vertically: the same room above and below.
    expect(shown.top).toBeCloseTo(136 - (shown.top + shown.height));
  });

  it('never enlarges a small one: a button stays at its own size, centered', () => {
    const f = fitTransform({ left: 0, top: 0, width: 100, height: 40 }, { width: 262, height: 136 }, 16);
    expect(f.scale).toBe(1);
    expect(f.x).toBe(81);
    expect(f.y).toBe(48);
    expect(fitCss(f)).toBe('translate(81px, 48px) scale(1)');
  });
});
