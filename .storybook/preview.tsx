import type { Decorator, Preview } from '@storybook/react-vite';
import { useEffect } from 'react';
import '@bridge-ds/tokens/fonts.css';
import '@bridge-ds/tokens/tokens.css';
import '../packages/react/src/styles/base.css';
import './preview.css';
import { ThemeProvider } from '../packages/react/src/theme';
import { ToastProvider } from '../packages/react/src/components/Toast';
import { TooltipProvider } from '../packages/react/src/components/Tooltip';
import { type Brand, type Density, type Theme, brands, defaults } from '@bridge-ds/tokens';

// Embedded in a Bridge Studio drawer (iframe.html?...&embed=bridge, apps/docs-site/src/lib/story-frame.ts): the
// canvas sizes to the story instead of the viewport, the story is centered, and the document height is posted to the
// parent so the drawer frame fits it with no inner scrollbar. The full Storybook and the measure pipeline never pass
// the parameter, so their canvas is unchanged.
if (typeof window !== 'undefined' && window.parent !== window && new URLSearchParams(window.location.search).get('embed') === 'bridge') {
  document.documentElement.classList.add('sb-embed');
  let last = 0;
  // The story's own height plus the canvas padding: never the viewport, so a taller frame does not grow the report.
  const post = () => {
    const story = document.getElementById('storybook-root');
    if (!story) return;
    const pad = getComputedStyle(document.body);
    const height = Math.ceil(story.getBoundingClientRect().height + parseFloat(pad.paddingTop) + parseFloat(pad.paddingBottom));
    if (height === last) return;
    last = height;
    window.parent.postMessage({ type: 'bridge:story-height', height }, '*');
  };
  const watch = () => {
    const story = document.getElementById('storybook-root');
    if (story) new ResizeObserver(post).observe(story);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch, { once: true });
  else watch();
  window.addEventListener('load', post);
}

// Embedded as a Bridge Studio thumbnail (iframe.html?...&embed=bridge-thumb, apps/docs-site/src/lib/story-frame.ts
// thumbStoryUrl): the story at its own size on a transparent canvas, and the box everything it draws takes (portals
// included) posted to the parent, which scales and centers that box in the thumbnail so nothing is cut at its edge.
if (typeof window !== 'undefined' && window.parent !== window && new URLSearchParams(window.location.search).get('embed') === 'bridge-thumb') {
  document.documentElement.classList.add('sb-thumb');
  let last = '';
  let queued = false;
  // What paints something a viewer can see: text of its own, a replaced or form element, a fill, a border or a shadow.
  // Empty wrappers and hidden layers (a toast region waiting for its first toast) do not count, so they never stretch
  // the box away from the story.
  const REPLACED = new Set(['IMG', 'SVG', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'CANVAS', 'VIDEO', 'PROGRESS', 'METER']);
  const paints = (el: Element) => {
    const v = el as Element & { checkVisibility?: (o: object) => boolean };
    if (v.checkVisibility && !v.checkVisibility({ opacityProperty: true, visibilityProperty: true })) return false;
    if (REPLACED.has(el.tagName.toUpperCase())) return true;
    if (Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '')) return true;
    const cs = getComputedStyle(el);
    if (cs.backgroundImage !== 'none' || cs.boxShadow !== 'none') return true;
    if (!/^(transparent|rgba\(0, 0, 0, 0\))$/.test(cs.backgroundColor)) return true;
    return ['Top', 'Right', 'Bottom', 'Left'].some((s) => parseFloat(cs.getPropertyValue(`border-${s.toLowerCase()}-width`)) > 0 && cs.getPropertyValue(`border-${s.toLowerCase()}-style`) !== 'none');
  };
  // The union of every painted box under <body>, in page coordinates. Wrappers that only hold the story, and fixed
  // layers as large as the viewport (a toast or dialog region), do not count: their content does.
  const measure = () => {
    queued = false;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const el of Array.from(document.body.querySelectorAll('*'))) {
      if (el.id === 'storybook-root' || el.classList.contains('sb-theme-root') || el instanceof HTMLScriptElement || el instanceof HTMLStyleElement) continue;
      if (el.closest('#storybook-docs, .sb-wrapper, .sb-errordisplay, .sb-nopreview, .sb-preparing-story, .sb-preparing-docs')) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (getComputedStyle(el).position === 'fixed' && r.width >= vw * 0.95 && r.height >= vh * 0.95) continue;
      if (!paints(el)) continue;
      left = Math.min(left, r.left + window.scrollX);
      top = Math.min(top, r.top + window.scrollY);
      right = Math.max(right, r.right + window.scrollX);
      bottom = Math.max(bottom, r.bottom + window.scrollY);
    }
    if (!Number.isFinite(left)) return;
    const box = { left: Math.floor(left), top: Math.floor(top), width: Math.ceil(right - Math.floor(left)), height: Math.ceil(bottom - Math.floor(top)) };
    const key = JSON.stringify(box);
    if (key === last) return;
    last = key;
    window.parent.postMessage({ type: 'bridge:story-size', ...box }, '*');
  };
  const soon = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(measure);
  };
  const watch = () => {
    new MutationObserver(soon).observe(document.body, { childList: true, subtree: true });
    const sizes = new ResizeObserver(soon);
    sizes.observe(document.body);
    const story = document.getElementById('storybook-root');
    if (story) sizes.observe(story);
    soon();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watch, { once: true });
  else watch();
  window.addEventListener('load', soon);
  void document.fonts?.ready.then(soon);
}

// Brands come from bridge.config.json through the token build, so a merged brand shows up in the toolbar.
const brandTitle = (b: string) => b.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

// Applies the scope the way a product does: all three attributes on <html> (for portaled overlays and the
// page background) and a ThemeProvider around the story.
const withScope: Decorator = (Story, context) => {
  const theme = (context.globals.theme ?? 'light') as Theme;
  const brand = (context.globals.brand ?? 'bridge') as Brand;
  const density = (context.globals.density ?? 'comfortable') as Density;
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-brand', brand);
    root.setAttribute('data-density', density);
  }, [theme, brand, density]);
  return (
    <ThemeProvider theme={theme} brand={brand} density={density} className="sb-theme-root">
      <TooltipProvider>
        <ToastProvider>
          <Story />
        </ToastProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
};

const preview: Preview = {
  decorators: [withScope],
  globalTypes: {
    theme: {
      description: 'Color theme',
      toolbar: {
        title: 'Theme',
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
        dynamicTitle: true,
      },
    },
    brand: {
      description: 'Brand',
      toolbar: {
        title: 'Brand',
        icon: 'paintbrush',
        items: brands.map((b) => ({ value: b, title: brandTitle(b) })),
        dynamicTitle: true,
      },
    },
    density: {
      description: 'Density',
      toolbar: {
        title: 'Density',
        icon: 'component',
        items: [
          { value: 'comfortable', title: 'Comfortable' },
          { value: 'compact', title: 'Compact' },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: 'light', brand: defaults.brand, density: 'comfortable' },
  parameters: {
    layout: 'padded',
    controls: { expanded: true },
    options: {
      storySort: { order: ['Foundations', 'Actions', 'Forms', 'Feedback', 'Overlays', 'Navigation', 'Data display', 'Layout', '*'] },
    },
    // Accessibility violations fail story tests instead of only showing as warnings.
    a11y: { test: 'error' },
  },
};

export default preview;
