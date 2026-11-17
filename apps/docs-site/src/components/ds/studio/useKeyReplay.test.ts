// @vitest-environment jsdom
// Play both plays the sides one after another: a page has one focus, and a frame that focuses its story while the other
// still plays takes the focus away from it (request #1202: "the focus left it" on one side only, a replay artifact).
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { READY_MESSAGE, RESULT_MESSAGE } from '../../../lib/story-replay';
import { useKeyReplay, type ReplayFrame } from './BehaviorReplay';

const frames: ReplayFrame[] = [
  { side: 'today', src: 'https://sb.acme.com/iframe.html?id=s&embed=bridge-keys' },
  { side: 'preview', src: 'https://p.acme.com/iframe.html?id=s&embed=bridge-keys' },
];

const say = (source: Window, data: unknown) => window.dispatchEvent(new MessageEvent('message', { data, source }));

describe('useKeyReplay', () => {
  it('asks the second side only once the first one answered', async () => {
    const { result } = renderHook(() => useKeyReplay(frames));
    const posted: string[] = [];
    const wins = new Map<string, Window>();
    for (const f of frames) {
      const el = document.createElement('iframe');
      document.body.appendChild(el);
      const win = el.contentWindow!;
      wins.set(f.side, win);
      vi.spyOn(win, 'postMessage').mockImplementation(((msg: { id: string }) => posted.push(msg.id)) as Window['postMessage']);
      result.current.frameRef(f.side)(el);
    }
    let done: Promise<Map<string, unknown>> | undefined;
    await act(async () => {
      done = result.current.play(['Enter', 'ArrowDown']);
    });
    await act(async () => {
      say(wins.get('today')!, { type: READY_MESSAGE });
      say(wins.get('preview')!, { type: READY_MESSAGE });
    });
    // Both frames are ready, only the first one was asked.
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatch(/^today-/);
    await act(async () => {
      say(wins.get('today')!, { type: RESULT_MESSAGE, id: posted[0], result: { open: 'listbox', focus: 'Light', shows: 'No theme' } });
    });
    expect(posted).toHaveLength(2);
    expect(posted[1]).toMatch(/^preview-/);
    await act(async () => {
      say(wins.get('preview')!, { type: RESULT_MESSAGE, id: posted[1], result: { open: 'listbox', focus: 'Light', shows: 'No theme' } });
    });
    const out = await done!;
    expect(out.get('today')).toEqual({ open: 'list', focus: 'Light', shows: 'No theme' });
    expect(out.get('preview')).toEqual({ open: 'list', focus: 'Light', shows: 'No theme' });
  });
});
