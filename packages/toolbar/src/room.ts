// Room for the toolbar: it floats over the bottom of the page, so the end of whatever scrolls under it gets extra
// padding the height of the bar, its offset from the bottom edge (safe area included) and a gap. Then the last row of
// the page can always scroll clear of the bar, open or collapsed. The page scrolls in the document most of the time; an
// app shell that scrolls inside a container (a main column with overflow auto) gets the padding on that container.

/** Whether an element scrolls vertically: its overflow lets it, and its content is taller than its box. */
function scrollsY(el: Element): boolean {
  const { overflowY } = getComputedStyle(el);
  return (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && el.scrollHeight > el.clientHeight + 1;
}

/**
 * The element whose end the bar covers: the nearest scrolling container under the bar (an app shell's main column),
 * else the document (its body). Measured at points just above the bar, so the bar itself is never the answer.
 */
export function scrollerUnder(bar: DOMRect, own: Element | null): HTMLElement {
  const doc = document.scrollingElement ?? document.documentElement;
  const y = Math.max(0, bar.top - 1);
  const xs = [bar.left + bar.width / 2, bar.left + 8, bar.right - 8];
  for (const x of xs) {
    const hits = typeof document.elementsFromPoint === 'function' ? document.elementsFromPoint(x, y) : [];
    for (const hit of hits) {
      if (own?.contains(hit) || hit.closest('[data-bridge-toolbar], [data-bridge-pin]')) continue;
      for (let el: Element | null = hit; el && el !== doc && el !== document.body; el = el.parentElement) {
        if (scrollsY(el)) return el as HTMLElement;
      }
      break;
    }
  }
  return document.body;
}

/** The room the bar takes at the bottom of the viewport: its height, its offset from the bottom edge, and a gap above. */
export function roomFor(input: { height: number; bottom: number; gap: number }): number {
  return Math.ceil(input.height + Math.max(0, input.bottom) + Math.max(0, input.gap));
}

/**
 * Keeps one element padded at its end by `room` pixels on top of its own padding, and gives the padding back when the
 * element changes or the toolbar goes away. Its own padding is read once, before the toolbar adds to it.
 */
export function createRoom() {
  let el: HTMLElement | null = null;
  let inline = '';
  let base = 0;
  let applied = -1;
  const release = () => {
    if (el) el.style.paddingBottom = inline;
    el = null;
    applied = -1;
  };
  return {
    reserve(target: HTMLElement, room: number) {
      if (target !== el) {
        release();
        el = target;
        inline = target.style.paddingBottom;
        base = parseFloat(getComputedStyle(target).paddingBottom) || 0;
      }
      if (room === applied) return;
      applied = room;
      target.style.paddingBottom = `${base + room}px`;
    },
    release,
  };
}
