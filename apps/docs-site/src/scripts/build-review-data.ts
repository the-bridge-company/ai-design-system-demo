// Check the build, region by region, in the browser (components/ds/studio/BuildReview.tsx): the team of the page, who
// reads (an email member through their session, else their GitHub token), the server's answers (scripts/
// contribute-session buildReview, sayBuildItem, buildNote, sayBuild) and the measured pictures. A picture Bridge keeps
// is read with the person's GitHub token when they signed in with GitHub (an <img> cannot carry it), else as is.
import type { ItemState, NoteThread, ReviewRead, SizeKey, Side, Verdict } from '../lib/build-review-view';

export interface ReviewTarget {
  product: string;
  number: number;
}

/** The page's team ("owner/repo") and the token a GitHub reader sends (null for an email member or a visitor). */
async function who(): Promise<{ team: string; token: string | null }> {
  const { readRepo, getToken, currentContributor } = await import('./github-session');
  const r = readRepo();
  let token: string | null = null;
  try {
    token = currentContributor() ? null : getToken();
  } catch {
    token = null;
  }
  return { team: `${r.owner}/${r.repo}`, token };
}

export async function teamOfPage(): Promise<string> {
  return (await who()).team;
}

export async function loadReview(t: ReviewTarget): Promise<ReviewRead | null> {
  const { team, token } = await who();
  const { buildReview } = await import('./contribute-session');
  const r = await buildReview(team, { product: t.product, copy: '', number: t.number }, token);
  return r.ready ? (r as ReviewRead) : null;
}

export async function sayItem(t: ReviewTarget, sig: string, verdict: Verdict | null): Promise<ItemState[]> {
  const { team, token } = await who();
  const { sayBuildItem } = await import('./contribute-session');
  return (await sayBuildItem(team, { product: t.product, copy: '', number: t.number, sig, verdict }, token)).items;
}

export async function addNote(t: ReviewTarget, x: { sig: string; size: SizeKey; side: Side; x: number; y: number; text: string }): Promise<NoteThread[]> {
  const { team, token } = await who();
  const { buildNote } = await import('./contribute-session');
  return (await buildNote(team, { product: t.product, copy: '', number: t.number, op: 'add', ...x }, token)).notes;
}

export async function replyNote(t: ReviewTarget, id: string, text: string): Promise<NoteThread[]> {
  const { team, token } = await who();
  const { buildNote } = await import('./contribute-session');
  return (await buildNote(team, { product: t.product, copy: '', number: t.number, op: 'reply', id, text }, token)).notes;
}

export async function resolveNote(t: ReviewTarget, id: string, resolved: boolean): Promise<NoteThread[]> {
  const { team, token } = await who();
  const { buildNote } = await import('./contribute-session');
  return (await buildNote(team, { product: t.product, copy: '', number: t.number, op: 'resolve', id, resolved }, token)).notes;
}

/** The overall answer: Looks right, or Needs changes (the build, with the things to fix posted on the task; or the design). */
export async function sendAnswer(t: ReviewTarget, a: { kind: 'looks-right' } | { kind: 'changes'; why: 'build' | 'design'; text: string }): Promise<void> {
  const { team, token } = await who();
  const { sayBuild } = await import('./contribute-session');
  await sayBuild(team, { product: t.product, copy: '', number: t.number, ...a, ...(a.kind === 'changes' && a.why === 'build' ? { fixes: true } : {}) }, token);
}

/** The address of one measured picture, for a reader of the team. */
export function imageUrl(team: string, code: string, pull: number, run: string, name: string): string {
  const q = new URLSearchParams({ repo: team, buildImage: '1', code, pull: String(pull), run, name });
  return `/api/contribute?${q}`;
}

const blobs = new Map<string, Promise<string>>();
/** A picture's address the page can show: as is, or read with the GitHub token into a local copy. */
export function imageSrc(url: string): Promise<string> {
  const held = blobs.get(url);
  if (held) return held;
  const p = who().then(async ({ token }) => {
    if (!token) return url;
    const r = await fetch(url, { credentials: 'same-origin', headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(String(r.status));
    return URL.createObjectURL(await r.blob());
  });
  blobs.set(url, p);
  p.catch(() => blobs.delete(url));
  return p;
}
