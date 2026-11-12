// The homepage's behaviour (pages/index.astro), framework free; the pure parts are in lib/homepage.ts.
//   - The closing panorama, a fixed-size drawing, scaled to its band. (The hero drawing is CSS only.)
// The step tabs are the DS Tabs (components/home/HpSteps.tsx). Without this script the page is complete.
import { panoramaFit } from '../lib/homepage';

const $ = <T extends Element = HTMLElement>(s: string, r: ParentNode = document) => r.querySelector<T>(s);

export function initHomepage() {
  /* ---------- fit the closing panorama ---------- */
  const pano = $('[data-pano]');
  const panoStage = $('[data-pano-stage]');
  const fitPano = () => {
    if (!pano || !panoStage) return;
    const { x, y, scale, height } = panoramaFit(pano.clientWidth);
    panoStage.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    pano.style.height = `${height}px`;
  };

  /* ---------- init ---------- */
  new ResizeObserver(fitPano).observe(document.documentElement);
  fitPano();
  document.fonts?.ready.then(fitPano);
}
