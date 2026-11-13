import { describe, expect, it } from 'vitest';
import { explorationPrBody, isInReview, openDecisionOf, parseExplorationBody } from '../src/explorations';
import { askReviewsOnGitHub, designApproveOnGitHub, leadChangesOnGitHub, answerLeadOnGitHub } from '../src/exploration-done-github';
import { decidePieceOnGitHub } from '../src/library-impact-github';
import { GitHubClient } from '../src/github-client';
import { withPiecesRecord, type MissingPiece } from '../src/prod-branch';
import type { ProductConfig } from '../src/products';

const SHOP: ProductConfig = { key: 'prints', name: 'Acme Prints', repo: 'acme/shop', design: { repo: 'acme/shop-design' } };
const NO_RETRY = { attempts: 1, baseDelayMs: 0, sleep: async () => {} };
const timeline: MissingPiece = { id: 'component-timeline', kind: 'component', title: 'New component: Timeline', summary: 'New.', name: 'Timeline', component: 'Timeline', values: [], where: [] };

/** One exploration in the design copy, with Timeline new for the library; every write recorded. */
function setup(pieces: MissingPiece[] = [timeline]) {
  const writes: { method: string; path: string; body: any }[] = [];
  const start = explorationPrBody({ name: 'Order fulfilment timeline', purpose: 'Faster', slug: 'order-timeline', author: 'sofia' }, { owner: 'acme', repo: 'shop-design', packages: [], apps: {}, inProduct: { name: 'Acme Prints', library: 'acme/ds', copyOf: 'acme/shop' } });
  const state = { body: withPiecesRecord(start, { checkedAt: '2026-11-12T09:00:00.000Z', pieces, links: [] }) };
  const res = (status: number, b: unknown) => ({ ok: status < 300, status, headers: { get: () => null }, json: async () => b, text: async () => JSON.stringify(b) });
  const f = (async (url: string, init?: { method?: string; body?: string }) => {
    const path = url.replace('https://api.github.com', '').split('?')[0]!;
    const method = init?.method ?? 'GET';
    const b = init?.body ? JSON.parse(init.body) : {};
    if (method !== 'GET') writes.push({ method, path, body: b });
    if (path === '/repos/acme/shop-design/pulls/4' && method === 'PATCH') state.body = b.body;
    if (path === '/repos/acme/shop-design/pulls/4') return res(200, { number: 4, title: 'Exploration: Order fulfilment timeline', body: state.body, state: 'open', draft: true, html_url: 'https://github.com/acme/shop-design/pull/4', labels: [{ name: 'exploration' }], head: { ref: 'explore/order-timeline', sha: 'h1' }, base: { ref: 'main' }, user: { login: 'sofia' }, created_at: '', updated_at: '' });
    if (path.startsWith('/repos/acme/shop-design/pulls/4/files')) return res(200, [{ filename: 'src/pages/Orders.tsx', status: 'modified' }]);
    if (path.includes('/check-runs') || path.includes('/status')) return res(200, { check_runs: [], statuses: [], state: 'success' });
    if (path === '/repos/acme/shop-design/issues/4/comments') return res(201, { id: 1, body: b.body, user: { login: 'sofia' }, html_url: '', created_at: '' });
    if (path.startsWith('/repos/acme/shop-design/issues/4/labels')) return res(200, []);
    if (path === '/repos/acme/shop/labels') return res(201, {});
    if (path === '/repos/acme/shop/issues') return res(201, { number: 7, title: b.title, body: b.body, html_url: 'https://github.com/acme/shop/issues/7', state: 'open', labels: [], user: { login: 'dana' }, created_at: '', updated_at: '' });
    return res(404, { message: `no route ${method} ${path}` });
  }) as unknown as ConstructorParameters<typeof GitHubClient>[2];
  const gh = new GitHubClient('acme/shop-design', 't', f, NO_RETRY, { etags: false, protectedBranches: ['main'], branchPrefix: 'explore/' });
  const handedOff = () => writes.some((w) => w.method === 'POST' && w.path === '/repos/acme/shop/issues');
  return { gh, writes, state, handedOff };
}

describe('two reviews on GitHub', () => {
  it('asks both at once and tells each on GitHub by hat', async () => {
    const { gh, writes, state } = setup();
    const r = await askReviewsOnGitHub(gh, 4, { openedBy: 'sofia', design: { to: ['dana'] }, library: { to: ['flo'] } });
    expect(r.design).toEqual(['dana']);
    expect(r.library).toEqual({ owners: ['flo'], pieces: ['component-timeline'] });
    const e = parseExplorationBody(state.body)!;
    expect(e.designAskedAt).toBeTruthy();
    expect(e.library?.askedAt).toBeTruthy();
    const comment = writes.find((w) => w.path.endsWith('/comments'))!.body.body as string;
    expect(comment).toMatch(/@dana ready for your design review/);
    expect(comment).toMatch(/@flo a library decision waits/);
  });

  it('never asks the library when nothing is new for it', async () => {
    const { gh, state } = setup([]);
    const r = await askReviewsOnGitHub(gh, 4, { openedBy: 'leo', design: { to: ['dana'] }, library: { to: ['dana'] } });
    expect(r.library).toBeNull();
    expect(parseExplorationBody(state.body)?.library?.askedAt).toBeUndefined();
    await expect(askReviewsOnGitHub(setup([]).gh, 4, { library: { to: ['dana'] } })).rejects.toThrow(/Nothing to review/);
  });

  it('design yes first: waits for the library; the last library answer hands it off', async () => {
    const { gh, state, handedOff } = setup();
    await askReviewsOnGitHub(gh, 4, { openedBy: 'sofia', design: { to: ['dana'] }, library: { to: ['dana'] } });
    const yes = await designApproveOnGitHub(gh, 4, { products: [SHOP], lead: 'dana' });
    expect(yes.done).toBeNull();
    expect(yes.libraryPending).toEqual(['component-timeline']);
    expect(isInReview(state.body)).toBe(true);
    expect(handedOff()).toBe(false);
    expect(parseExplorationBody(state.body)?.decisions?.at(-1)).toMatchObject({ kind: 'looks-right', hat: 'design' });
    const answer = await decidePieceOnGitHub(gh, 4, { piece: 'component-timeline', verdict: 'local', by: 'dana', products: [SHOP] });
    expect(answer.done).not.toBeNull();
    expect(handedOff()).toBe(true);
    const after = parseExplorationBody(state.body)!;
    expect(after.doneAt).toBeTruthy();
    expect(after.doneBy).toBe('sofia');
    expect(after.designOkBy).toBe('dana');
  });

  it('library answer first: the design yes hands it off', async () => {
    const { gh, handedOff } = setup();
    await askReviewsOnGitHub(gh, 4, { openedBy: 'sofia', design: { to: ['dana'] }, library: { to: ['flo'] } });
    const answer = await decidePieceOnGitHub(gh, 4, { piece: 'component-timeline', verdict: 'local', by: 'flo', products: [SHOP] });
    expect(answer.done).toBeNull();
    const yes = await designApproveOnGitHub(gh, 4, { products: [SHOP], lead: 'dana' });
    expect(yes.done).not.toBeNull();
    expect(handedOff()).toBe(true);
  });

  it('library only: the last answer makes it Ready to build', async () => {
    const { gh, handedOff } = setup();
    await askReviewsOnGitHub(gh, 4, { openedBy: 'sofia', library: { to: ['flo'] } });
    await expect(designApproveOnGitHub(gh, 4, { products: [SHOP], lead: 'dana' })).rejects.toThrow(/already answered/);
    const answer = await decidePieceOnGitHub(gh, 4, { piece: 'component-timeline', verdict: 'local', by: 'flo', products: [SHOP] });
    expect(answer.done).not.toBeNull();
    expect(handedOff()).toBe(true);
  });

  it('library Ask for changes: back to Exploring, the design yes stays and is not asked again', async () => {
    const { gh, state, handedOff } = setup();
    await askReviewsOnGitHub(gh, 4, { openedBy: 'sofia', design: { to: ['dana'] }, library: { to: ['flo'] } });
    await designApproveOnGitHub(gh, 4, { products: [SHOP], lead: 'dana' });
    await decidePieceOnGitHub(gh, 4, { piece: 'component-timeline', verdict: 'changes', text: 'Use the Stepper', by: 'flo', products: [SHOP] });
    expect(isInReview(state.body)).toBe(false);
    expect(openDecisionOf(state.body)).toMatchObject({ kind: 'changes', hat: 'library', text: 'Use the Stepper' });
    expect(parseExplorationBody(state.body)?.designOkAt).toBeTruthy();
    // The designer answers: only the library decision is asked again.
    await answerLeadOnGitHub(gh, 4, { text: 'Done', by: 'sofia' });
    const e = parseExplorationBody(state.body)!;
    expect(e.library?.askedAt).toBeTruthy();
    expect(isInReview(state.body)).toBe(true);
    const done = await decidePieceOnGitHub(gh, 4, { piece: 'component-timeline', verdict: 'local', by: 'flo', products: [SHOP] });
    expect(done.done).not.toBeNull();
    expect(handedOff()).toBe(true);
  });

  it('library Ask for changes answered in the same millisecond: the library decision is asked again', async () => {
    // Fast automation (an agent answering at once) can write the changes and the new ask with one timestamp.
    const { gh, state, handedOff } = setup();
    const now = new Date('2026-11-13T10:00:00.000Z');
    await askReviewsOnGitHub(gh, 4, { openedBy: 'sofia', design: { to: ['dana'] }, library: { to: ['flo'] }, date: now });
    await designApproveOnGitHub(gh, 4, { products: [SHOP], lead: 'dana', date: now });
    await decidePieceOnGitHub(gh, 4, { piece: 'component-timeline', verdict: 'changes', text: 'Use the Stepper', by: 'flo', products: [SHOP], date: now });
    expect(isInReview(state.body)).toBe(false);
    await answerLeadOnGitHub(gh, 4, { text: 'Done', by: 'sofia', date: now });
    const e = parseExplorationBody(state.body)!;
    expect(e.library?.askedAt).toBe(e.library?.decisions?.[0]?.at);
    expect(isInReview(state.body)).toBe(true);
    const done = await decidePieceOnGitHub(gh, 4, { piece: 'component-timeline', verdict: 'local', by: 'flo', products: [SHOP], date: now });
    expect(done.done).not.toBeNull();
    expect(handedOff()).toBe(true);
  });

  it('design Needs changes: back to Exploring, library answers already given stay', async () => {
    const { gh, state } = setup();
    await askReviewsOnGitHub(gh, 4, { openedBy: 'sofia', design: { to: ['dana'] }, library: { to: ['flo'] } });
    await decidePieceOnGitHub(gh, 4, { piece: 'component-timeline', verdict: 'local', by: 'flo', products: [SHOP] });
    await leadChangesOnGitHub(gh, 4, { note: 'Tighter rows', lead: 'dana' });
    expect(isInReview(state.body)).toBe(false);
    expect(openDecisionOf(state.body)).toMatchObject({ kind: 'changes', hat: 'design' });
    expect(parseExplorationBody(state.body)?.library?.decisions?.[0]?.verdict).toBe('local');
    // Answered: the design review is asked again, the library answer is not re-asked.
    await answerLeadOnGitHub(gh, 4, { text: 'Tightened', by: 'sofia', leads: ['dana'] });
    expect(isInReview(state.body)).toBe(true);
    const yes = await designApproveOnGitHub(gh, 4, { products: [SHOP], lead: 'dana' });
    expect(yes.libraryPending).toEqual([]);
    expect(yes.done).not.toBeNull();
  });
});
