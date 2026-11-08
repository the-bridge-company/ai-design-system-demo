// Whether a GitHub account has a photo of its own, or GitHub's generated pattern (the identicon every new account gets).
// A person without a photo gets Bridge's drawn face instead, the same as an email member, never the pattern.
// GitHub says which is which only through the image's Last-Modified date: every identicon is stamped within a few
// seconds of 2016-11-05 20:57 UTC, a photo with the day it was uploaded.

const STAMP_FROM = Date.UTC(2016, 10, 5, 20, 0, 0);
const STAMP_TO = Date.UTC(2016, 10, 5, 22, 0, 0);

/** True when an avatar's Last-Modified header is GitHub's identicon stamp. An unknown date reads as a photo. */
export function isIdenticonStamp(lastModified: string | null | undefined): boolean {
  if (!lastModified) return false;
  const t = Date.parse(lastModified);
  return Number.isFinite(t) && t >= STAMP_FROM && t < STAMP_TO;
}

const GITHUB_PNG = /^https:\/\/github\.com\/([A-Za-z0-9-]{1,39})\.png(?:\?|$)/;
const AVATARS = /^https:\/\/avatars\.githubusercontent\.com\/([A-Za-z0-9-]{1,39})(?:\?|$)/;

/** The login of a GitHub avatar address Bridge writes (github.com/<login>.png), else null. */
export function loginOfAvatar(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = GITHUB_PNG.exec(url) ?? AVATARS.exec(url);
  return m ? m[1]!.toLowerCase() : null;
}

/** Where the check reads (CORS open, Last-Modified readable), smallest size. */
export const photoProbeUrl = (login: string): string => `https://avatars.githubusercontent.com/${encodeURIComponent(login)}?s=8`;

/** How long an answer is kept in this browser: a week, like profile names. */
export const PHOTO_TTL_MS = 7 * 24 * 3600 * 1000;

export type PhotoCache = Record<string, { drawn: boolean; at: number }>;

/** The kept answers still fresh at `now`, from what localStorage held (anything unreadable is dropped). */
export function readPhotoCache(raw: string | null, now: number): PhotoCache {
  const out: PhotoCache = {};
  if (!raw) return out;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return out;
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      const e = v as { drawn?: unknown; at?: unknown };
      if (typeof e?.drawn === 'boolean' && typeof e.at === 'number' && now - e.at < PHOTO_TTL_MS) out[k] = { drawn: e.drawn, at: e.at };
    }
  } catch {
    /* corrupt: asked again */
  }
  return out;
}
