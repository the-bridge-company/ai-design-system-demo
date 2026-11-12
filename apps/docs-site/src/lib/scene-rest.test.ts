// @vitest-environment jsdom
// The Field Guide scenes rest within 5 seconds (WCAG 2.2.2): their root carries data-still once the time is up, and
// styles/*-scene.css pause every moving part under it.
import '../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCENE_MOTION_MS } from './scene-rest';
import { QuietScene } from '../components/ds/studio/QuietScene';
import { SignInScene } from '../components/ds/account/SignInScene';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('scenes rest within 5 seconds', () => {
  it('moves for less than the 5 seconds WCAG 2.2.2 allows', () => {
    expect(SCENE_MOTION_MS).toBeLessThanOrEqual(5000);
  });

  it.each([
    ['the sign-in story', () => createElement(SignInScene), '.ss'],
    ['a Studio header scene (inline)', () => createElement(QuietScene, { scene: 'harbor' }), '.qs'],
    ['a Studio header scene (window)', () => createElement(QuietScene, { scene: 'harbor', layout: 'window' }), '.qs'],
    ['the Quality lighthouse', () => createElement(QuietScene, { scene: 'lighthouse', mood: 'clear' }), '.qs'],
  ])('%s moves at first, then rests', (_, el, sel) => {
    const { container } = render(el());
    const root = container.querySelector(sel)!;
    expect(root).not.toBeNull();
    expect(root).not.toHaveAttribute('data-still');
    act(() => {
      vi.advanceTimersByTime(SCENE_MOTION_MS - 1);
    });
    expect(root).not.toHaveAttribute('data-still');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(root).toHaveAttribute('data-still', '');
  });
});
