// The Field Guide scenes move for a moment, then rest (WCAG 2.2.2, pause, stop, hide): motion that starts by itself,
// next to other content, stops within 5 seconds, so no scene needs a pause button. The sign-in story and the Studio
// quiet scenes (styles/sign-in-scene.css, styles/quiet-scene.css) pause every moving part once their root carries
// data-still; reduced motion never starts them.
import { useEffect, useState } from 'react';

/** How long a scene moves before it rests, in ms: under the 5 seconds WCAG 2.2.2 allows. */
export const SCENE_MOTION_MS = 4800;

/** False while the scene may move, true once it rests. Counts from the scene's first paint. */
export function useSceneRest(ms: number = SCENE_MOTION_MS): boolean {
  const [still, setStill] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setStill(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return still;
}
