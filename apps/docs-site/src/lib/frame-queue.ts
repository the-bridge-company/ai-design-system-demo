// Preview frames loaded a few at a time (components/ds/library/ComponentStage `queued`): a frame joins the queue once
// it comes near the screen and starts when fewer than FRAME_SLOTS frames are loading; a slot frees when its frame has
// loaded, or after FRAME_SLOT_MS so one slow Storybook never holds the others. A page of many Storybook previews (a
// Being built board) then boots them one after another instead of all at once. Without IntersectionObserver every
// frame starts, as a plain lazy frame would.

export const FRAME_SLOTS = 3;
export const FRAME_SLOT_MS = 6000;

interface Waiting {
  el: Element;
  start: () => void;
}

let busy = 0;
const waiting: Waiting[] = [];
let observer: IntersectionObserver | null = null;
const near = new Set<Element>();

/** The next waiting frames that are near the screen, while slots are free. */
function pump() {
  while (busy < FRAME_SLOTS) {
    const i = waiting.findIndex((w) => near.has(w.el));
    if (i < 0) return;
    const [w] = waiting.splice(i, 1);
    if (!w) return;
    near.delete(w.el);
    observer?.unobserve(w.el);
    busy++;
    let freed = false;
    const free = () => {
      if (freed) return;
      freed = true;
      busy--;
      clearTimeout(timer);
      w.el.removeEventListener('load', free);
      pump();
    };
    const timer = setTimeout(free, FRAME_SLOT_MS);
    w.el.addEventListener('load', free);
    w.start();
  }
}

/**
 * Starts `start` (setting the frame's address) once the frame is near the screen and a slot is free. Returns the
 * cleanup: a frame that leaves the page before its turn leaves the queue.
 */
export function queueFrame(el: Element, start: () => void): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    start();
    return () => {};
  }
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) near.add(e.target);
        else near.delete(e.target);
      }
      pump();
    },
    { rootMargin: '200px' },
  );
  const w = { el, start };
  waiting.push(w);
  observer.observe(el);
  return () => {
    const i = waiting.indexOf(w);
    if (i >= 0) waiting.splice(i, 1);
    near.delete(el);
    observer?.unobserve(el);
  };
}
