// "See it as" in the browser (lib/demo-cast.ts says what it is): which person of the sample team this page plays.
// The address (?as=sofia) wins and is kept for the next pages; else this browser's pick; else Dana. Read only on the
// sample team: on any other team nobody is played, whatever the address or the storage say.
import { CAST_PARAM, CAST_STORAGE_KEY, castPerson, chooseCast, type CastKey, type CastPerson } from '../lib/demo-cast';
import { isSampleTeam } from '../lib/demo';

const stored = (): string | null => {
  try {
    return localStorage.getItem(CAST_STORAGE_KEY);
  } catch {
    return null;
  }
};

const store = (key: CastKey) => {
  try {
    localStorage.setItem(CAST_STORAGE_KEY, key);
  } catch {
    /* storage blocked: the address still picks */
  }
};

const queryPick = (): string | null => {
  if (typeof location === 'undefined') return null;
  try {
    return new URLSearchParams(location.search).get(CAST_PARAM);
  } catch {
    return null;
  }
};

/** The person this page plays on `repo` ("owner/repo"), or null when `repo` is not the sample team. */
export function castOn(repo: string | null | undefined): CastPerson | null {
  if (!isSampleTeam(repo)) return null;
  const q = queryPick();
  const person = chooseCast({ query: q, stored: stored() });
  // Picked by the address: kept, so the next page of the visit plays the same person.
  if (castPerson(q) && stored() !== person.key) store(person.key);
  return person;
}

/**
 * Plays `key` from now on and shows the page again as them: every script reads who the page is for once, at load, so
 * the page reloads. An ?as= in the address is replaced so it never overrides the new pick.
 */
export function playCast(key: CastKey): void {
  store(key);
  const url = new URL(location.href);
  if (url.searchParams.has(CAST_PARAM)) url.searchParams.set(CAST_PARAM, key);
  location.assign(url.toString());
}
