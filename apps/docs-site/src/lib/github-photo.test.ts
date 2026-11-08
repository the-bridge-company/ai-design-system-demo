import { describe, expect, it } from 'vitest';
import { isIdenticonStamp, loginOfAvatar, PHOTO_TTL_MS, readPhotoCache } from './github-photo';

describe('GitHub photo or generated pattern', () => {
  it('reads GitHub identicon stamps as no photo, any other date as a photo', () => {
    expect(isIdenticonStamp('Sat, 05 Nov 2016 20:57:49 GMT')).toBe(true);
    expect(isIdenticonStamp('Sat, 05 Nov 2016 20:57:52 GMT')).toBe(true);
    expect(isIdenticonStamp('Mon, 01 Feb 2021 14:23:05 GMT')).toBe(false);
    expect(isIdenticonStamp(null)).toBe(false);
    expect(isIdenticonStamp('not a date')).toBe(false);
  });

  it('finds the login of the avatar addresses Bridge writes, nothing else', () => {
    expect(loginOfAvatar('https://github.com/Acme-Malik.png?size=64')).toBe('acme-malik');
    expect(loginOfAvatar('https://avatars.githubusercontent.com/peterbono?s=8')).toBe('peterbono');
    expect(loginOfAvatar('https://example.com/a.png')).toBeNull();
    expect(loginOfAvatar('data:image/svg+xml,x')).toBeNull();
    expect(loginOfAvatar(null)).toBeNull();
  });

  it('keeps answers for a week and drops anything unreadable', () => {
    const now = 10 * PHOTO_TTL_MS;
    const raw = JSON.stringify({ a: { drawn: true, at: now - 1000 }, old: { drawn: false, at: now - PHOTO_TTL_MS - 1 }, bad: { drawn: 'yes', at: now } });
    expect(readPhotoCache(raw, now)).toEqual({ a: { drawn: true, at: now - 1000 } });
    expect(readPhotoCache('{', now)).toEqual({});
  });
});
