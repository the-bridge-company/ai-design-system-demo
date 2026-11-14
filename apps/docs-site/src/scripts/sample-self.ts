// Who is signed in on this browser, for the sample team (lib/sample-member.ts says what it changes there): read
// synchronously, so the sample team's first paint already shows the person. Their Bridge account first (kept by
// scripts/account-session.ts under SAMPLE_SELF_KEY each time the server says who is signed in), else their GitHub
// sign-in (its token and the last check of it, which names the GitHub account). No token is ever shown or kept here:
// only whether one is saved, the name GitHub gave with it, and one check of it (GET /user) when it was never checked.
// While a sign-in may be there but is not known yet, the sample team waits (sampleSelfPending, resolveSampleSelf).
import { OLD_APP_SLOT, slotKey, STORAGE_SLOTS } from '../lib/github-signin';
import { checkFor, okCheck, rejectedCheck, type CheckedViewer, type TokenCheck } from '../lib/token-session';
import { isContribAuth } from '../lib/contribute';
import { SAMPLE_REPO } from '../lib/demo';
import { parseSampleSelf, SAMPLE_SELF_KEY, sampleIdentity, selfOfAccount, selfOfGitHub, type SampleSelf } from '../lib/sample-member';

type Slot = (typeof STORAGE_SLOTS)[number];

const read = (k: string): string | null => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};

/** Every GitHub sign-in saved in this browser (any app's slot but the retired one), with its check when it is for it. */
function gitHubSignIns(): { slot: Slot; token: string; check: TokenCheck | null }[] {
  const out: { slot: Slot; token: string; check: TokenCheck | null }[] = [];
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
    out.push({ slot, token, check: checkFor(check, token) });
  }
  return out;
}

/** The GitHub account of a GitHub sign-in saved in this browser, from its check. */
function gitHubSelf(): SampleSelf | null {
  for (const s of gitHubSignIns()) if (s.check?.ok && s.check.viewer) return selfOfGitHub(s.check.viewer);
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

let settled = false;

/**
 * What this browser says about the person before any request (the same hints as the layout's showcase guard): known
 * (`self`), a signed-out visitor (`out`, Dana at once), or not known yet (`pending`).
 */
export function sampleIdentityNow(): 'self' | 'out' | 'pending' {
  if (sampleSelf()) return 'self';
  if (settled) return 'out';
  let signingIn = false;
  let accountTrace = false;
  try {
    signingIn = Boolean(sessionStorage.getItem('bridge.github.signin') || sessionStorage.getItem('bridge.account.github'));
  } catch {
    /* storage blocked: no sign-in under way */
  }
  try {
    accountTrace = Object.keys(localStorage).some((k) => (k.startsWith('bridge.contribute.member:') && k.slice('bridge.contribute.member:'.length).toLowerCase() !== SAMPLE_REPO) || k === 'bridge.accountTeamNames');
  } catch {
    /* storage blocked: nothing kept */
  }
  return sampleIdentity({ self: false, uncheckedGitHub: gitHubSignIns().some((s) => !s.check), signingIn, accountTrace });
}

/** A sign-in may be there and is not known yet: the sample team's identity parts wait (resolveSampleSelf). */
export const sampleSelfPending = (): boolean => sampleIdentityNow() === 'pending';

/** How long the sample team waits for the account or GitHub before it paints a signed-out visitor's view. */
const WAIT_MS = 4000;

/** Checks a GitHub sign-in never checked here, as the real team does (GET /user), and keeps the check next to it. */
async function checkGitHub(s: { slot: Slot; token: string }): Promise<void> {
  const res = await fetch('https://api.github.com/user', { headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${s.token}` } });
  const key = slotKey('bridge.github.check', s.slot);
  try {
    if (res.ok) localStorage.setItem(key, JSON.stringify(okCheck(s.token, (await res.json()) as CheckedViewer, Date.now())));
    // A refused pasted token is kept refused; a refused sign-in is renewed by the real team's session, which can.
    else if (res.status === 401 && !read(slotKey('bridge.github.app', s.slot))) localStorage.setItem(key, JSON.stringify(rejectedCheck(s.token, Date.now())));
  } catch {
    /* storage blocked: asked again on the next page */
  }
}

let resolving: Promise<SampleSelf | null> | null = null;

/**
 * Finds out who is signed in when this browser does not say yet: the Bridge account (one GET, shared with the page),
 * then a GitHub sign-in never checked here. At most WAIT_MS, then the page goes on as a signed-out visitor. Afterwards
 * sampleIdentityNow never says `pending` again on this page.
 */
export function resolveSampleSelf(): Promise<SampleSelf | null> {
  resolving ??= (async () => {
    const work = (async () => {
      const { getAccount } = await import('./account-session');
      const { account } = await getAccount().catch(() => ({ account: null }));
      if (account) {
        noteAccountSelf(account);
        return;
      }
      const unchecked = gitHubSignIns().find((s) => !s.check);
      if (unchecked) await checkGitHub(unchecked).catch(() => undefined);
    })();
    await Promise.race([work, new Promise((r) => setTimeout(r, WAIT_MS))]);
    settled = true;
    return sampleSelf();
  })();
  return resolving;
}

/** Forgets what this page found out, for tests. */
export function forgetSampleSelf(): void {
  settled = false;
  resolving = null;
}
