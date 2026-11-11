// Check the build, region by region, in the browser (components/ds/studio/BuildReview.tsx): the team of the page, who
// reads (an email member through their session, else their GitHub token), the server's answers (scripts/
// contribute-session buildReview, sayBuildItem, buildNote, sayBuild) and the measured pictures. A picture Bridge keeps
// is read with the person's GitHub token when they signed in with GitHub (an <img> cannot carry it), else as is.
import type { ItemState, NoteThread, ReviewRead, SizeKey, Side, Tick, Verdict } from '../lib/build-review-view';

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
  if (!r.ready) return null;
  const d = r as ReviewRead;
  return (await demoVisit()) ? withDemo(d, readDemo(team, t, d.head)) : d;
}

// --- The sample team's visitor: their answers stay in this browser ----------------------------------------------------
// A signed-out visitor of the demo reads as its lead and may answer the check like them, but nothing is sent: what they
// say per difference and the handover notes they tick are kept here, per build (its head), and laid over each read.

export interface DemoCheck {
  items: Record<string, Verdict>;
  ticks: Tick[];
}
const demoKey = (team: string, t: ReviewTarget, head: string) => `bridge.demo.check.${team}#${t.product}#${t.number}#${head}`;

async function demoVisit(): Promise<boolean> {
  try {
    const { currentContributor } = await import('./github-session');
    return currentContributor()?.visitor === true;
  } catch {
    return false;
  }
}

function readDemo(team: string, t: ReviewTarget, head: string): DemoCheck {
  try {
    const v = JSON.parse(localStorage.getItem(demoKey(team, t, head)) ?? 'null') as Partial<DemoCheck> | null;
    return { items: v?.items && typeof v.items === 'object' ? v.items : {}, ticks: Array.isArray(v?.ticks) ? v.ticks : [] };
  } catch {
    return { items: {}, ticks: [] };
  }
}

function writeDemo(team: string, t: ReviewTarget, head: string, c: DemoCheck): void {
  try {
    localStorage.setItem(demoKey(team, t, head), JSON.stringify(c));
  } catch {
    /* private window: the answer lives as long as the page */
  }
}

/** A read with the visitor's own answers and ticks laid over it. Pure. */
export function withDemo(d: ReviewRead, c: DemoCheck): ReviewRead {
  return { ...d, items: d.items.map((s) => (s.sig in c.items ? { ...s, mine: c.items[s.sig] ?? null } : s)), ticks: [...(d.ticks ?? []).filter((x) => !c.ticks.some((y) => y.key === x.key)), ...c.ticks] };
}

/** A handover note found (or not any more) in the build: one tick for the check, saved like the words per difference. */
export async function sayHandover(t: ReviewTarget, key: string, found: boolean): Promise<Tick[]> {
  const { team, token } = await who();
  if (await demoVisit()) {
    const d = await loadReviewKept(t);
    if (!d) return [];
    const c = readDemo(team, t, d.head);
    const ticks = c.ticks.filter((x) => x.key !== key);
    const next = { ...c, ticks: found ? [...ticks, { key, byName: d.me, role: d.role ?? 'lead', at: new Date().toISOString() }] : ticks };
    writeDemo(team, t, d.head, next);
    kept.delete(`${t.product}#${t.number}`);
    return next.ticks;
  }
  const { sayBuildTick } = await import('./contribute-session');
  const r = await sayBuildTick(team, { product: t.product, copy: '', number: t.number, handover: key, found }, token);
  kept.delete(`${t.product}#${t.number}`);
  return r.ticks;
}

const kept = new Map<string, { at: number; read: Promise<ReviewRead | null> }>();
/** The same read for the parts of one page (the exploration page's entry and its zone's actions), kept 30 seconds. */
export function loadReviewKept(t: ReviewTarget): Promise<ReviewRead | null> {
  const k = `${t.product}#${t.number}`;
  const held = kept.get(k);
  if (held && Date.now() - held.at < 30_000) return held.read;
  const read = loadReview(t);
  kept.set(k, { at: Date.now(), read });
  read.catch(() => kept.delete(k));
  return read;
}

export async function sayItem(t: ReviewTarget, sig: string, verdict: Verdict | null): Promise<ItemState[]> {
  const { team, token } = await who();
  kept.delete(`${t.product}#${t.number}`);
  if (await demoVisit()) {
    const d = await loadReview(t);
    if (!d) return [];
    const c = readDemo(team, t, d.head);
    const { [sig]: _was, ...rest } = c.items;
    const next = { ...c, items: verdict ? { ...rest, [sig]: verdict } : rest };
    writeDemo(team, t, d.head, next);
    return withDemo(d, next).items;
  }
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
