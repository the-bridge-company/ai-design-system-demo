// People in Studio rows built by plain scripts: personHtml() writes the DS Avatar (initials at first) and the name
// as the login; paintPeople() then swaps in the illustrated face (the drawings load on demand, so pages that show no
// people never pay for them) and the profile name, looked up once a week per person (lib/people). The same on every
// team, the sample team included: its people are real members, named as Bridge knows them.
import { avatarHtml, type AvatarSize } from '@bridge-ds/react/dom';
import { authorLine, isClaudeLogin, isEmailAddress, loginKey, nameFace, loginsToFetch, nameBudget, personName, readNameCache, type NameCache } from '../lib/people';
import { isNameAuthor, nameOfAuthor } from '../lib/author';
import { currentViewer, esc, ghGet, hasWorkingToken } from './github-session';
import { drawingSeed } from '../lib/cast-faces';

const STORE = 'bridge.people.names.v1';

let cache: NameCache | null = null;
function names(): NameCache {
  if (cache) return cache;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORE);
  } catch {
    /* storage blocked: names stay logins */
  }
  cache = readNameCache(raw, Date.now());
  const v = currentViewer();
  if (v?.name) cache[loginKey(v.login)] = { name: v.name, at: Date.now() };
  return cache;
}

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify(cache ?? {}));
  } catch {
    /* quota or blocked: names are looked up again next time */
  }
}

/**
 * What a designer reads for a login on this page: the profile name (lib/people personName), and "Claude AI, with Ana"
 * when Claude worked from someone's account (`agent`).
 */
export function displayName(login: string, agent = false): string {
  return agent ? authorLine(login, true, names()) : personName(login, names());
}

/** The key a row keeps for a login: its face seed and data-person. */
const personKey = (login: string): string => loginKey(login);

/** The profile names known so far (cached or the viewer's), for labels that are not repainted (select options). */
export const knownNames = (): NameCache => names();

export interface PersonOptions {
  size?: AvatarSize;
  /** Claude made it (lib/work-nature agentMade): Claude's identity, crediting the account it worked from. */
  agent?: boolean;
  /** Write the name next to the avatar (default). Without it, the name is for screen readers only. */
  withName?: boolean;
  /**
   * The person's name when Bridge knows them by name only (an email member: the "Requested by" line), for an author
   * recorded as an address: shown as written, face drawn from it (lib/people nameFace), never looked up on GitHub.
   */
  name?: string | null;
}

/** The avatar and the name of a person (or Claude) for plain-script markup. Call paintPeople() after inserting it. */
export function personHtml(login: string, { size = 'xs', agent = false, withName = true, name = null }: PersonOptions = {}): string {
  const claude = agent || isClaudeLogin(login);
  // A name instead of a login (an email member Bridge recorded as "Requested by Priya Shah", or an address with its
  // name given): shown as written, never looked up on GitHub, its face the name's (the same as on cards and in Members).
  const email = !claude && isEmailAddress(login);
  const writtenName = claude ? null : name?.trim() || (email ? login.trim().split('@')[0]! : isNameAuthor(login) ? nameOfAuthor(login.trim()) : /\s/.test(login.trim()) ? login.trim() : null);
  const written = writtenName !== null;
  const label = written ? writtenName : displayName(login, claude);
  const face = written ? nameFace(writtenName) : personKey(login);
  const avatar = claude
    ? avatarHtml({ kind: 'agent', brand: 'claude', size, decorative: true, className: 'person-avatar' })
    : avatarHtml({ name: label, size, decorative: true, fallback: 'illustrated', className: 'person-avatar', attributes: { 'data-face': face, 'data-face-size': size } });
  const nameAttrs = written || (claude && isClaudeLogin(login)) ? '' : ` data-person="${esc(personKey(login))}"${claude ? ' data-person-agent' : ''}`;
  // Without a written name (dense rows) the avatar stays decorative and screen readers hear ", by <name>".
  if (!withName) return `${avatar}<span class="sr-only">, by <span${nameAttrs}>${esc(label)}</span></span>`;
  return `<span class="person">${avatar}<span class="person-name"${nameAttrs}>${esc(label)}</span></span>`;
}

let illustrator: Promise<(seed: string) => string> | null = null;
const loadIllustrator = () => (illustrator ??= import('@bridge-ds/react/avatar-illustrated').then((m) => (seed: string) => m.illustratedAvatarUri(drawingSeed(seed))));

/**
 * The profile names of these logins, read from GitHub when not known yet (within the name budget), for text written
 * once (a sentence such as "Ana is on it"): the same names as paintPeople puts on avatars and rows.
 */
export async function lookUpNames(logins: string[]): Promise<NameCache> {
  const want = loginsToFetch(logins, names(), nameBudget(hasWorkingToken()));
  if (want.length) {
    await Promise.all(
      want.map(async (login) => {
        try {
          const { data } = await ghGet<{ name?: string | null }>(`/users/${encodeURIComponent(login)}`);
          names()[login] = { name: data.name?.trim() || null, at: Date.now() };
        } catch {
          /* rate limit or offline: the login stays */
        }
      }),
    );
    save();
  }
  return names();
}

/** Swaps illustrated faces and profile names into every person under `root`. Safe to call after each repaint. */
export async function paintPeople(root: ParentNode = document): Promise<void> {
  const faces = [...root.querySelectorAll<HTMLElement>('[data-face]:not([data-face-done])')];
  if (faces.length) {
    const uri = await loadIllustrator().catch(() => null);
    if (uri) {
      for (const el of faces) {
        if (!el.isConnected) continue;
        const login = el.dataset.face!;
        const decorative = el.getAttribute('aria-hidden') === 'true';
        el.outerHTML = avatarHtml({
          name: el.getAttribute('aria-label') ?? displayName(login),
          size: (el.dataset.faceSize as AvatarSize) || 'xs',
          decorative,
          fallback: 'illustrated',
          illustration: uri(login),
          className: 'person-avatar',
          attributes: { 'data-face': login, 'data-face-size': el.dataset.faceSize, 'data-face-done': true },
        });
      }
    }
  }
  const people = [...root.querySelectorAll<HTMLElement>('[data-person]')];
  if (!people.length) return;
  await lookUpNames(people.map((el) => el.dataset.person!));
  for (const el of people) {
    if (!el.isConnected) continue;
    const login = el.dataset.person!;
    el.textContent = displayName(login, el.hasAttribute('data-person-agent'));
  }
}
