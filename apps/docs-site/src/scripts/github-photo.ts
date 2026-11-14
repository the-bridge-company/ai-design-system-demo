// The one place that decides whether a GitHub account shows its photo or Bridge's drawn face (lib/github-photo
// showsDrawn): drawn when the person chose it in Settings > You (scripts/team-faces.ts choseDrawn), or when their
// avatar is GitHub's generated pattern. Whether it is a photo is asked once a week per person and kept in this
// browser. One HEAD request per person, no API call, no quota.
import { isIdenticonStamp, photoProbeUrl, readPhotoCache, showsDrawn, type PhotoCache } from '../lib/github-photo';
import { choseDrawn } from './team-faces';

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

/** Whether GitHub only has the generated pattern for this login (no photo). A failed check reads as a photo. */
function identicon(login: string): Promise<boolean> {
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

/** The answer already known for a login: true when Bridge draws the face, false for a photo, null when not asked yet. */
export const knownDrawn = (login: string): boolean | null => showsDrawn(choseDrawn(login), kept()[login.toLowerCase()]?.drawn ?? null);

/** Whether this login shows Bridge's drawn face (chosen, or no photo on GitHub). A failed check keeps the photo. */
export function drawnFace(login: string): Promise<boolean> {
  return choseDrawn(login) ? Promise.resolve(true) : identicon(login);
}

/** Whether this login has a photo of its own on GitHub: Settings > You offers the photo or drawn face choice only then. */
export const hasPhoto = (login: string): Promise<boolean> => identicon(login).then((i) => !i);
