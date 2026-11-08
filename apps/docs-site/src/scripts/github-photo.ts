// Asks GitHub once a week per person whether their avatar is a photo or the generated pattern (lib/github-photo), and
// keeps the answer in this browser. One HEAD request per person, no API call, no quota.
import { isIdenticonStamp, photoProbeUrl, readPhotoCache, type PhotoCache } from '../lib/github-photo';

const STORE = 'bridge.people.photos.v1';
let cache: PhotoCache | null = null;
const asking = new Map<string, Promise<boolean>>();

function kept(): PhotoCache {
  if (cache) return cache;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORE);
  } catch {
    /* storage blocked: asked each page */
  }
  return (cache = readPhotoCache(raw, Date.now()));
}

/** The answer already known for a login: true when Bridge draws the face, false for a photo, null when not asked yet. */
export const knownDrawn = (login: string): boolean | null => kept()[login.toLowerCase()]?.drawn ?? null;

/** Whether this login shows Bridge's drawn face (no photo on GitHub). A failed check keeps the photo. */
export function drawnFace(login: string): Promise<boolean> {
  const key = login.toLowerCase();
  const known = kept()[key];
  if (known) return Promise.resolve(known.drawn);
  let p = asking.get(key);
  if (!p) {
    p = fetch(photoProbeUrl(key), { method: 'HEAD' })
      .then((r) => (r.ok ? isIdenticonStamp(r.headers.get('last-modified')) : false))
      .catch(() => false)
      .then((drawn) => {
        kept()[key] = { drawn, at: Date.now() };
        try {
          localStorage.setItem(STORE, JSON.stringify(cache));
        } catch {
          /* quota or blocked */
        }
        return drawn;
      });
    asking.set(key, p);
  }
  return p;
}
