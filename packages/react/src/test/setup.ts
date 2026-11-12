import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// findBy* and waitFor give up after 1s by default. Studio islands load their React parts on first use (a dynamic
// import of a dialog and its component graph): cold, under a full parallel run or on a small machine, that first
// import alone can take 1 to 3s, and the test failed although the UI was right (demo-gate, AskToJoin,
// settings-faces). 5s keeps a real hang failing well inside the 15s test timeout.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
});

// jsdom gaps that Base UI and Floating UI touch.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
const g = globalThis as Record<string, unknown>;
g.ResizeObserver ??= ResizeObserverStub;
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false;
if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {};
if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {};
if (!g.PointerEvent) g.PointerEvent = MouseEvent;
if (!document.elementFromPoint) document.elementFromPoint = () => null;
