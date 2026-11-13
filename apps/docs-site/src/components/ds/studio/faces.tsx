// Illustrated faces for React islands: the drawings (@bridge-ds/react/avatar-illustrated, about 120 kB gzipped) load
// after the first paint, once per page, so the island stays light. Until then the Avatar shows initials.
import { useEffect, useState } from 'react';
import { Avatar } from '@bridge-ds/react';
import type { Person } from '../../../lib/home-model';
import { safeUrl } from '../../../lib/html';
import { avatarLogin } from '../../../lib/github-photo';
import { FACES_EVENT, faceUri } from '../../../scripts/team-faces';
import { isCastLogin } from '../../../lib/demo-cast';

/** A GitHub account's photo address as Studio writes it (github.com/<login>.png): Who checks it for a drawn face. */
export const githubPhoto = (login: string, size = 48): string => `https://github.com/${encodeURIComponent(login)}.png?size=${size}`;

/** A person as the home (`avatar`) or the branch review (`avatarUrl`) knows them; `agent` for Claude. */
export type Face = Pick<Person, 'login' | 'name' | 'agent'> & { avatar?: string | null; avatarUrl?: string | null };

type Draw = (seed: string) => string;
let loading: Promise<Draw> | null = null;
let loaded: Draw | null = null;

/** The face drawer once loaded, else null (the Avatar falls back to initials meanwhile). */
export function useFaces(): Draw | null {
  const [draw, setDraw] = useState<Draw | null>(() => loaded);
  useEffect(() => {
    let live = true;
    // A saved face, or the team read, changed: every face draws again (a new function, so React repaints).
    const again = () => loaded && live && setDraw(() => (seed: string) => loaded!(seed));
    document.addEventListener(FACES_EVENT, again);
    // Every face of a React island draws through faceUri (scripts/team-faces), so one person keeps one drawing.
    if (!loaded) {
      loading ??= import('@bridge-ds/react/avatar-illustrated').then((m) => (loaded = (seed: string) => faceUri(m, seed)));
      loading.then((d) => live && setDraw(() => d)).catch(() => {});
    }
    return () => {
      live = false;
      document.removeEventListener(FACES_EVENT, again);
    };
  }, []);
  return draw;
}

/** True once Bridge knows this GitHub avatar is the generated pattern, not a photo (scripts/github-photo). */
function useDrawnFace(photo: string | null | undefined, who?: string | null): boolean {
  const login = avatarLogin(photo, who);
  const [drawn, setDrawn] = useState<boolean>(false);
  useEffect(() => {
    if (!login) return setDrawn(false);
    let live = true;
    void import('../../../scripts/github-photo').then(({ knownDrawn, drawnFace }) => {
      const known = knownDrawn(login);
      if (known !== null) return live && setDrawn(known);
      void drawnFace(login).then((d) => live && setDrawn(d));
    });
    return () => {
      live = false;
    };
  }, [login]);
  return drawn;
}

/**
 * A person (their photo, else their drawn face seeded by login) or Claude (its own identity), as the DS Avatar. Shared
 * by the home, the Branches list rows (BranchRow `who`) and Settings (Members, Review rules), so the same person looks
 * the same everywhere.
 */
export function Who({ p, size = 'md', decorative = true, className }: { p: Face; size?: 'xs' | 'sm' | 'md'; decorative?: boolean; className?: string; /** For AvatarGroup's "+N" names. */ name?: string }) {
  const draw = useFaces();
  // A sample person's GitHub account (the developer, acme-malik) is drawn, never his GitHub picture (lib/demo-cast).
  const photo = isCastLogin(p.login) ? undefined : safeUrl(p.avatar ?? p.avatarUrl) || undefined;
  const drawn = useDrawnFace(p.agent ? null : photo, p.login);
  if (p.agent) return <Avatar kind="agent" brand="claude" name={p.name} size={size} decorative={decorative} className={className} />;
  // A GitHub account without a photo of its own shows the drawn face, never GitHub's generated pattern.
  const src = drawn ? undefined : photo;
  return <Avatar name={p.name} src={src} size={size} decorative={decorative} className={className} fallback="illustrated" seed={p.login} illustration={draw?.(p.login)} />;
}
