// Who is signed in on this browser, for the sample team (lib/sample-member.ts says what it changes there): read
// synchronously, so the sample team's first paint already shows the person. Their Bridge account first (kept by
// scripts/account-session.ts under SAMPLE_SELF_KEY each time the server says who is signed in), else their GitHub
// sign-in (its token and the last check of it, which names the GitHub account). No token is ever read out or kept
// here: only whether one is saved, and the name GitHub gave with it.
import { OLD_APP_SLOT, slotKey, STORAGE_SLOTS } from '../lib/github-signin';
import { checkFor, type TokenCheck } from '../lib/token-session';
import { isContribAuth } from '../lib/contribute';
import { parseSampleSelf, SAMPLE_SELF_KEY, selfOfAccount, selfOfGitHub, type SampleSelf } from '../lib/sample-member';

const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

/** The GitHub account of a GitHub sign-in saved in this browser (any app's slot but the retired one), from its check. */
function gitHubSelf(): SampleSelf | null {
  for (const slot of STORAGE_SLOTS) {
    if (slot === OLD_APP_SLOT) continue;
    const token = read(slotKey('bridge.github.token', slot));
    if (!token || isContribAuth(token)) continue;
    let check: TokenCheck | null = null;
    try {
      check = JSON.parse(read(slotKey('bridge.github.check', slot)) ?? 'null') as TokenCheck | null;
    } catch {
      check = null;
    }
    const mine = checkFor(check, token);
    if (mine?.ok && mine.viewer) return selfOfGitHub(mine.viewer);
  }
  return null;
}

/** The person signed in on this browser (their Bridge account, else their GitHub sign-in), or null signed out. */
export function sampleSelf(): SampleSelf | null {
  try {
    const kept = parseSampleSelf(JSON.parse(read(SAMPLE_SELF_KEY) ?? 'null'));
    if (kept) return { ...kept, avatar: kept.avatar ?? gitHubSelf()?.avatar ?? null };
  } catch {
    /* unreadable: the GitHub sign-in decides */
  }
  return gitHubSelf();
}

/**
 * Keeps who the Bridge account is (null: the server said nobody is signed in), for the sample team's next first paint.
 * True when it changed.
 */
export function noteAccountSelf(a: { name: string | null; email: string; github: { login: string } | null } | null): boolean {
  const next = a ? JSON.stringify(selfOfAccount(a)) : null;
  if (read(SAMPLE_SELF_KEY) === next) return false;
  try {
    if (next) localStorage.setItem(SAMPLE_SELF_KEY, next);
    else localStorage.removeItem(SAMPLE_SELF_KEY);
  } catch {
    return false;
  }
  return true;
}
