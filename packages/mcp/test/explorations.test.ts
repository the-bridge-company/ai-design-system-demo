// Explorations over an in-memory GitHub and a throwaway local repo: start (draft pull request labeled exploration),
// list with linked requests, token edits and request briefs aimed at the exploration branch, promote and close.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseExplorationBody, withPiecesRecord } from '@bridge-ds/core';
import { BridgeContext, branches, explorations, ops, requests, studio } from '../dist/lib.js';
import { fakeGitHub, git, pinStart, readTree, REAL_PATHS, REPO, tempGitRepo } from './helpers.js';

// pinStart: muted text starts at 600, so the edit to 700 is a real change whatever main says.
const files = () => pinStart(readTree(REPO, REAL_PATHS));
/** The token's owner ("owner" in the fake) as the design lead: Done exploring goes straight to the developers. */
const asLead = (tree: Record<string, string>) => {
  const cfg = JSON.parse(tree['bridge.config.json']!);
  cfg.governance.owners.design = ['owner'];
  return { ...tree, 'bridge.config.json': `${JSON.stringify(cfg, null, 2)}\n` };
};
/**
 * The two reviews in bridge.config.json: the library owners (governance.owners.design), and the Library product's own
 * design review (off when not given, as for every Library). Products with their own repository are left out.
 */
const withReviews = (tree: Record<string, string>, x: { owners: string[]; library?: { reviewers: string[] } | false }) => {
  const cfg = JSON.parse(tree['bridge.config.json']!);
  cfg.governance.owners.design = x.owners;
  cfg.products = (cfg.products ?? []).filter((p: any) => !p.repo).map((p: any) => (p.key === 'library' && x.library !== undefined ? { ...p, designReview: x.library } : p));
  return { ...tree, 'bridge.config.json': `${JSON.stringify(cfg, null, 2)}\n` };
};
/** The library check found a new component, Timeline, on the first exploration. */
const withTimeline = (gh: ReturnType<typeof fakeGitHub>) => {
  const piece = { id: 'timeline', kind: 'component', title: 'New component: Timeline', summary: 'A timeline of the order steps.', name: 'Timeline', component: 'Timeline', values: [], where: [] };
  gh.pulls[0]!.body = withPiecesRecord(gh.pulls[0]!.body, { checkedAt: '2026-11-12T00:00:00Z', pieces: [piece as any], links: [] });
};
const edit = { op: 'set' as const, path: 'color.text.muted', value: '{palette.neutral.700}', mode: { theme: 'light' } };
const LIGHT = 'packages/tokens/src/semantic/light.tokens.json';

describe('Done exploring: the two reviews', () => {
  it('asks both: the library decision on the new piece and the product design review', async () => {
    const gh = fakeGitHub('acme', 'ds', withReviews(files(), { owners: ['dana'], library: { reviewers: ['sam'] } }));
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch });
    await explorations.startExploration(ctx, { name: 'Order timeline' });
    withTimeline(gh);
    const dry = (await explorations.doneExploring(ctx, { ref: 'order-timeline', dryRun: true })) as any;
    expect(dry).toMatchObject({ status: 'dry-run', reviews: { design: { reviewers: [{ id: 'sam' }] }, library: { owners: [{ id: 'dana' }], pieces: ['Timeline'] } } });
    expect(gh.pulls[0]!.body).not.toContain('designAskedAt');
    const r = (await explorations.doneExploring(ctx, { ref: 'order-timeline', pieces: ['timeline'] })) as any;
    expect(r).toMatchObject({ status: 'in-review', branch: 'explore/order-timeline', reviews: { design: { reviewers: [{ id: 'sam', name: 'sam' }] }, library: { owners: [{ id: 'dana' }], pieces: ['Timeline'] } } });
    expect(r.waitingFor).toBe("Waiting for sam's design review and dana's library decision on Timeline");
    expect(r.next).toContain(r.waitingFor);
    // Still running: nothing reached the developers.
    expect(gh.pulls[0]!.labels.map((l: { name: string }) => l.name)).toEqual(['exploration']);
    expect(gh.pulls[0]!.body).toContain('designAskedAt');
    expect(parseExplorationBody(gh.pulls[0]!.body)!.library).toMatchObject({ askedTo: ['dana'] });

    // Every list names who and why.
    const list = await explorations.listExplorations(ctx, {});
    expect(list.explorations[0]).toMatchObject({ ref: '#1', waitingFor: "Waiting for sam's design review and dana's library decision on Timeline" });
    const reviews = (await ops.listReviews(ctx, {})) as any;
    expect(reviews.pullRequests[0].waitingFor).toBe("Waiting for sam's design review and dana's library decision on Timeline");

    // The reviewers' queue names the hat. Sam: the design review. Dana: the library decision.
    gh.viewer.login = 'sam';
    const sam = (await branches.whatNeedsMe(ctx, {})) as any;
    expect(sam.explorations).toEqual([expect.objectContaining({ ref: '#1', hat: 'design-review', hats: ['design-review'], line: "agent's screen: your design review", waitingFor: "Waiting for your design review and dana's library decision on Timeline" })]);
    expect(sam.summary).toMatch(/^1 exploration asks for your review/);
    gh.viewer.login = 'dana';
    const dana = (await branches.whatNeedsMe(ctx, {})) as any;
    expect(dana.explorations).toEqual([expect.objectContaining({ hat: 'library', hats: ['library'], line: "agent's screen: a library decision" })]);
    gh.viewer.login = 'owner';
    expect(((await branches.whatNeedsMe(ctx, {})) as any).explorations).toEqual([]);
  });

  it('one person holding both hats: one line, one queue item with both hats', async () => {
    const gh = fakeGitHub('acme', 'ds', withReviews(files(), { owners: ['dana'], library: { reviewers: ['dana'] } }));
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch });
    await explorations.startExploration(ctx, { name: 'Order timeline' });
    withTimeline(gh);
    const r = (await explorations.doneExploring(ctx, { ref: 'order-timeline' })) as any;
    expect(r.waitingFor).toBe("Waiting for dana's design review and library decision on Timeline");
    gh.viewer.login = 'dana';
    const dana = (await branches.whatNeedsMe(ctx, {})) as any;
    expect(dana.explorations[0]).toMatchObject({ hat: 'design-review', hats: ['design-review', 'library'], line: "agent's screen: your design review and a library decision" });
  });

  it('design review only: nothing new for the library', async () => {
    const gh = fakeGitHub('acme', 'ds', withReviews(files(), { owners: ['dana'], library: { reviewers: ['sam'] } }));
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch });
    await explorations.startExploration(ctx, { name: 'Pill buttons' });
    const r = (await explorations.doneExploring(ctx, { ref: 'pill-buttons' })) as any;
    expect(r).toMatchObject({ status: 'in-review', legacyStatus: 'waiting-for-lead', reviews: { design: { reviewers: [{ id: 'sam' }] }, library: null }, waitingFor: "Waiting for sam's design review" });
    expect(parseExplorationBody(gh.pulls[0]!.body)!.library?.askedAt).toBeUndefined();
  });

  it('library decision only: the product has no design review', async () => {
    const gh = fakeGitHub('acme', 'ds', withReviews(files(), { owners: ['dana'] }));
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch });
    await explorations.startExploration(ctx, { name: 'Order timeline' });
    withTimeline(gh);
    const r = (await explorations.doneExploring(ctx, { ref: 'order-timeline' })) as any;
    expect(r).toMatchObject({ status: 'in-review', reviews: { design: null, library: { owners: [{ id: 'dana' }], pieces: ['Timeline'] } }, waitingFor: "Waiting for dana's library decision on Timeline" });
    expect(gh.pulls[0]!.body).not.toContain('designAskedAt');
  });

  it('nothing to review: straight to Ready to build, the line says why', async () => {
    const gh = fakeGitHub('acme', 'ds', withReviews(files(), { owners: ['dana'] }));
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch });
    await explorations.startExploration(ctx, { name: 'Pill buttons' });
    const r = (await explorations.doneExploring(ctx, { ref: 'pill-buttons' })) as any;
    expect(r).toMatchObject({ status: 'ready-to-build', legacyStatus: 'done-exploring', exploration: 'ready', reviews: { design: null, library: null }, waitingFor: 'No review needed: nothing new for the library, and Library has no design review' });
    expect(gh.pulls[0]!.labels.map((l: { name: string }) => l.name)).toEqual(['ready-for-devs']);
    expect((await explorations.listExplorations(ctx, {})).explorations[0]).toMatchObject({ status: 'ready', waitingFor: null });
  });

  it('continue: the design review words (leadWords kept as a deprecated alias) and the library answer per piece', async () => {
    const gh = fakeGitHub('acme', 'ds', withReviews(files(), { owners: ['dana'], library: { reviewers: ['sam'] } }));
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch });
    await explorations.startExploration(ctx, { name: 'Order timeline' });
    withTimeline(gh);
    await explorations.doneExploring(ctx, { ref: 'order-timeline' });
    // Sam asks for changes on the screen (back to exploring); Dana keeps the Timeline in the screen only.
    const e = parseExplorationBody(gh.pulls[0]!.body)!;
    const at = '2030-01-01T00:00:00.000Z';
    const next = { ...e, designAskedAt: undefined, decisions: [{ kind: 'changes', at, round: 1, by: 'sam', text: 'Tighter rows, please.', hat: 'design' }], library: { ...e.library, decisions: [{ piece: 'timeline', verdict: 'local', at, by: 'dana' }] } };
    gh.pulls[0]!.body = gh.pulls[0]!.body.replace(/<!-- bridge-exploration [\s\S]*? -->/, `<!-- bridge-exploration ${JSON.stringify(next)} -->`);
    const r = (await explorations.continueExploration(ctx, { ref: '#1', checkout: false })) as any;
    expect(r.designReviewWords).toBe('sam asked for changes: Tighter rows, please.');
    expect(r.leadWords).toBe(r.designReviewWords);
    expect(r.libraryAnswers).toEqual([expect.objectContaining({ piece: 'timeline', title: 'Timeline', verdict: 'local', answer: 'Keep in the screen only', by: 'dana' })]);
    expect(r.next).toContain('designReviewWords');
    expect(r.next).toContain('libraryAnswers');
  });

  it('settings and config name both roles', async () => {
    const gh = fakeGitHub('acme', 'ds', withReviews(files(), { owners: ['dana'], library: { reviewers: ['sam'] } }));
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch });
    const s = (await studio.getSettings(ctx)) as any;
    expect(s.reviews.library).toMatchObject({ role: 'Decides what the library keeps', who: ['@dana'] });
    expect(s.reviews.designReview.role).toBe('Reviews the design before developers');
    expect(s.reviews.designReview.products.find((p: any) => p.key === 'library')).toMatchObject({ on: true, reviewers: ['@sam'] });
    expect(((await ops.getConfig(ctx)) as any).reviews).toEqual(s.reviews);
  });
});

describe('explorations on GitHub', () => {
  it('start: dry run and refusal without a token; branch, note and draft pull request labeled exploration with one', async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const ro = await BridgeContext.create({ repo: 'acme/ds', fetch: gh.fetch });
    const dry = (await explorations.startExploration(ro, { name: 'Pill buttons', purpose: 'Do rounder buttons feel friendlier in checkout?', useCase: 'user-test', dryRun: true })) as any;
    expect(dry).toMatchObject({ status: 'dry-run', branch: 'explore/pill-buttons', title: 'Exploration: Pill buttons', label: 'exploration' });
    expect(dry.note.path).toBe('.bridge/explorations/pill-buttons.md');
    await expect(explorations.startExploration(ro, { name: 'Pill buttons', purpose: 'x' })).rejects.toThrow(/GITHUB_TOKEN/);
    await expect(explorations.startExploration(ro, { name: '', purpose: '' })).rejects.toThrow(/Name the exploration/);
    await expect(explorations.startExploration(ro, { name: 'X1', purpose: 'y', useCase: 'nope' })).rejects.toThrow(/Unknown use case/);
    expect(gh.pulls).toHaveLength(0);

    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch });
    const r = (await explorations.startExploration(ctx, { name: 'Pill buttons', purpose: 'Do rounder buttons feel friendlier in checkout?', useCase: 'user-test' })) as any;
    expect(r).toMatchObject({ status: 'started', branch: 'explore/pill-buttons', pr: 1 });
    // Nothing built yet: no guessed pkg.pr.new command, the note says where it will appear.
    expect(r.install).toMatchObject({ state: 'building', command: null });
    expect(JSON.stringify(r)).not.toContain('pkg.pr.new');
    expect(r.next).toContain('"branch": "explore/pill-buttons"');
    expect(r.next).toContain('data-bridge-change="<short plain label>"');
    expect(gh.pulls[0]).toMatchObject({ draft: true, base: { ref: 'main' }, title: 'Exploration: Pill buttons' });
    expect(gh.pulls[0]!.labels.map((l: any) => l.name)).toEqual(['exploration']);
    expect(gh.fileAt('explore/pill-buttons', '.bridge/explorations/pill-buttons.md')).toContain('Do rounder buttons');
    expect(gh.fileAt('main', '.bridge/explorations/pill-buttons.md')).toBeUndefined();
  });

  it('start without a purpose: nothing asked, no empty purpose line', async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch });
    const r = (await explorations.startExploration(ctx, { name: 'Billing screen' })) as any;
    expect(r).toMatchObject({ status: 'started', branch: 'explore/billing-screen', inProductRepo: false });
    expect(gh.pulls[0]!.body).not.toContain('**Purpose.**');
    expect(gh.fileAt('explore/billing-screen', '.bridge/explorations/billing-screen.md')).toMatch(/^# Exploration: Billing screen\n\n- Branch:/);
  });

  it('a product with its own repository: the exploration starts there; without access, a plain error and the library on request', async () => {
    const tree = files();
    const cfg = JSON.parse(tree['bridge.config.json']!);
    cfg.products = [
      { key: 'admin', name: 'Admin demo', path: 'apps/admin' },
      { key: 'shop', name: 'Shop', repo: 'acme/shop', preview: 'https://shop-git-{branch}-acme.vercel.app' },
      { key: 'library', name: 'Library', default: true },
    ];
    const ds = fakeGitHub('acme', 'ds', { ...tree, 'bridge.config.json': `${JSON.stringify(cfg, null, 2)}\n` });
    const shop = fakeGitHub('acme', 'shop', { 'package.json': '{"name":"shop"}' });
    const both = ((url: string, init?: RequestInit) => (String(url).includes('/repos/acme/shop') ? shop.fetch(url, init) : ds.fetch(url, init))) as typeof fetch;
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: both });

    const dry = (await explorations.startExploration(ctx, { name: 'Billing screen', product: 'shop', dryRun: true })) as any;
    expect(dry).toMatchObject({ status: 'dry-run', repo: 'acme/shop', inProductRepo: true, base: 'main' });
    expect(dry.prBody).toContain('The library comes from npm');

    const r = (await explorations.startExploration(ctx, { name: 'Billing screen', product: 'shop', source: 'mcp' })) as any;
    expect(r).toMatchObject({ status: 'started', repo: 'acme/shop', inProductRepo: true, branch: 'explore/billing-screen', pr: 1 });
    expect(r.next).toContain('git switch explore/billing-screen');
    expect(shop.pulls).toHaveLength(1);
    expect(ds.pulls).toHaveLength(0);
    expect(shop.pulls[0]).toMatchObject({ draft: true, base: { ref: 'main' } });
    expect(shop.pulls[0]!.labels.map((l: any) => l.name)).toEqual(['exploration', 'product: shop']);
    expect(shop.pulls[0]!.body).toContain('| Shop | https://shop-git-explore-billing-screen-acme.vercel.app/ |');
    expect(shop.fileAt('explore/billing-screen', '.bridge/explorations/billing-screen.md')).toContain('# Exploration: Billing screen');

    // The Admin demo lives in the design system repository: its explorations stay there.
    const admin = (await explorations.startExploration(ctx, { name: 'Admin table', product: 'admin' })) as any;
    expect(admin).toMatchObject({ status: 'started', repo: 'acme/ds', inProductRepo: false });
    expect(ds.pulls).toHaveLength(1);

    // Bridge cannot reach the product repository: nothing written, the admin action, the library only on request.
    const hidden = ((url: string, init?: RequestInit) => (String(url).includes('/repos/acme/shop') ? Promise.resolve(new Response('{"message":"Not Found"}', { status: 404 })) : ds.fetch(url, init))) as typeof fetch;
    const off = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: hidden });
    await expect(explorations.startExploration(off, { name: 'Checkout', product: 'shop' })).rejects.toThrow(/Ask an admin to connect Shop to Bridge[\s\S]*where: "library"/);
    expect(ds.pulls).toHaveLength(1);
    const fallback = (await explorations.startExploration(off, { name: 'Checkout', product: 'shop', where: 'library' })) as any;
    expect(fallback).toMatchObject({ status: 'started', repo: 'acme/ds', inProductRepo: false });
    expect(ds.pulls[1]!.labels.map((l: any) => l.name)).toEqual(['exploration', 'product: shop']);
  });

  it("a product with a design copy: the exploration starts in the copy, never in the developers' repository", async () => {
    const tree = files();
    const cfg = JSON.parse(tree['bridge.config.json']!);
    cfg.products = [
      { key: 'shop', name: 'Shop', repo: 'acme/shop', design: { repo: 'acme/shop-design', preview: 'https://shop-design-git-{branch}-acme.vercel.app' }, preview: 'https://shop-git-{branch}-acme.vercel.app' },
      { key: 'library', name: 'Library', default: true },
    ];
    const ds = fakeGitHub('acme', 'ds', { ...tree, 'bridge.config.json': `${JSON.stringify(cfg, null, 2)}\n` });
    const copy = fakeGitHub('acme', 'shop-design', { 'package.json': '{"name":"shop"}' });
    const shop = fakeGitHub('acme', 'shop', { 'package.json': '{"name":"shop"}' });
    const route = ((url: string, init?: RequestInit) =>
      String(url).includes('/repos/acme/shop-design') ? copy.fetch(url, init) : String(url).includes('/repos/acme/shop') ? shop.fetch(url, init) : ds.fetch(url, init)) as typeof fetch;
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: route });
    const r = (await explorations.startExploration(ctx, { name: 'Billing screen', product: 'shop', source: 'mcp' })) as any;
    expect(r).toMatchObject({ status: 'started', repo: 'acme/shop-design', inProductRepo: true, branch: 'explore/billing-screen' });
    expect(copy.pulls).toHaveLength(1);
    expect(shop.pulls).toHaveLength(0);
    expect(copy.pulls[0]!.body).toContain("design team's copy of Shop, never in the developers' repository (acme/shop)");
    expect(copy.pulls[0]!.body).toContain('| Shop | https://shop-design-git-explore-billing-screen-acme.vercel.app/ |');

    // No copy yet: nothing written anywhere, and the way to make it.
    const none = ((url: string, init?: RequestInit) =>
      String(url).includes('/repos/acme/shop-design') ? Promise.resolve(new Response('{"message":"Not Found"}', { status: 404 })) : String(url).includes('/repos/acme/shop') ? shop.fetch(url, init) : ds.fetch(url, init)) as typeof fetch;
    const off = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: none });
    await expect(explorations.startExploration(off, { name: 'Checkout', product: 'shop' })).rejects.toThrow(/design team's copy of Shop \(acme\/shop-design\)[\s\S]*starts the first exploration of Shop/);
    expect(shop.pulls).toHaveLength(0);
  });

  it('token edits, requests and docs drafts aimed at the exploration branch; list; promote', async () => {
    const gh = fakeGitHub('acme', 'ds', asLead(files()));
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch });
    await explorations.startExploration(ctx, { name: 'Pill buttons', purpose: 'Rounder buttons.' });
    const mainLight = gh.fileAt('main', LIGHT);

    // Token edit: one commit on the exploration, no new pull request, main untouched.
    const p = (await ops.proposeTokenChange(ctx, { title: 'Darken muted text', edits: [edit], branch: 'explore/pill-buttons' })) as any;
    expect(p).toMatchObject({ status: 'committed', branch: 'explore/pill-buttons', exploration: true, pr: 1 });
    expect(gh.pulls).toHaveLength(1);
    expect(gh.fileAt('explore/pill-buttons', LIGHT)).not.toBe(mainLight);
    expect(gh.fileAt('main', LIGHT)).toBe(mainLight);
    await expect(ops.proposeTokenChange(ctx, { title: 'x', edits: [edit], branch: 'agent/x' })).rejects.toThrow(/not an exploration branch/);
    await expect(ops.proposeTokenChange(ctx, { title: 'x', edits: [edit], branch: 'explore/missing' })).rejects.toThrow(/not found/);
    await expect(ops.proposeTokenChange(ctx, { title: 'x', edits: [edit], branch: 'main' })).rejects.toThrow(/not an exploration branch|protected/);

    // A request on the exploration: labeled, and its brief says to work there.
    const req = (await requests.createRequest(ctx, { component: 'Button', kind: 'visual', title: 'Pill radius', summary: 'Try a pill radius.', exploration: 'pill-buttons' })) as any;
    expect(req.labels).toContain('exploration');
    expect(req.next).toContain('explore/pill-buttons');
    const got = await requests.getRequest(ctx, { number: req.number });
    expect(got.exploration).toBe('explore/pill-buttons');
    expect(got.brief).toContain('Work on the existing branch explore/pill-buttons');
    expect(got.brief).toContain('Do not open a pull request to main');
    expect(got.next).toContain('Do not open a pull request to main');
    const plain = await requests.createRequest(ctx, { component: 'Switch', kind: 'visual', title: 'Bigger', summary: 'Bigger.' });
    const aimed = await requests.getRequest(ctx, { number: (plain as any).number, branch: 'explore/pill-buttons' });
    expect(aimed.brief).toContain('explore/pill-buttons');
    expect((await requests.listRequests(ctx, {})).requests.find((r) => r.number === req.number)!.exploration).toBe('explore/pill-buttons');

    // Docs draft on the exploration: read there, saved there.
    const d = (await ops.draftDocsOp(ctx, { name: 'Button', branch: 'explore/pill-buttons' })) as any;
    expect(d.branch).toBe('explore/pill-buttons');
    expect(d.instruction).toContain('on the exploration branch explore/pill-buttons');

    const list = await explorations.listExplorations(ctx, {});
    expect(list).toMatchObject({ running: 1, total: 1, summary: '1 exploration running.' });
    expect(list.explorations[0]).toMatchObject({ number: 1, slug: 'pill-buttons', status: 'active', purpose: 'Rounder buttons.' });
    expect(list.explorations[0]!.requests.map((r) => r.number)).toEqual([req.number]);

    const dry = (await explorations.doneExploring(ctx, { ref: 'pill-buttons', dryRun: true })) as any;
    expect(dry).toMatchObject({ status: 'dry-run', labels: { add: ['ready-for-devs'], remove: ['exploration'] }, requests: [] });
    expect(gh.pulls[0]!.labels.map((l: any) => l.name)).toContain('exploration');

    // The old tool name runs Done exploring: nothing closes, merges or turns ready for review.
    const done = (await explorations.promoteExploration(ctx, { ref: 'explore/pill-buttons' })) as any;
    expect(done).toMatchObject({ status: 'ready-to-build', number: 1, exploration: 'ready', warnings: [] });
    expect(done.forDevelopers.take).toEqual(['git fetch origin', 'git checkout explore/pill-buttons']);
    expect(done.forDevelopers.note).toMatch(/starting point/);
    expect(done.next).toMatch(/not checked against the library/);
    expect(gh.pulls[0]!.draft).toBe(true);
    expect(gh.pulls[0]!.state).toBe('open');
    expect(gh.pulls[0]!.labels.map((l: any) => l.name)).toEqual(['ready-for-devs']);
    expect(gh.pulls[0]!.body).toContain('### For developers');
    expect(gh.fileAt('explore/pill-buttons', '.bridge/explorations/pill-buttons.md')).toBeUndefined();
    const after = await explorations.listExplorations(ctx, {});
    expect(after.summary).toBe('No exploration running, 1 with the developers.');
    expect(after.explorations[0]).toMatchObject({ number: 1, status: 'ready', archived: false });

    // Archive keeps it open, out of the default list; unarchive brings it back.
    expect(await explorations.archiveExploration(ctx, { ref: '#1' })).toMatchObject({ status: 'archived', number: 1 });
    expect(gh.pulls[0]!.state).toBe('open');
    expect((await explorations.listExplorations(ctx, {})).total).toBe(0);
    expect((await explorations.listExplorations(ctx, { archived: true })).summary).toBe('1 archived exploration.');
    expect(await explorations.archiveExploration(ctx, { ref: '#1', archived: false })).toMatchObject({ status: 'unarchived' });
  });

  it('list: the install command from the preview comment and the preview URLs Vercel reports, never guessed', async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch });
    await explorations.startExploration(ctx, { name: 'Button normal again', purpose: 'Back to the regular button.' });
    const before = (await explorations.listExplorations(ctx, {})).explorations[0] as any;
    expect(before.install).toMatchObject({ state: 'building', command: null });
    // The admin template would be 64 characters: Vercel shortens it, so it stays unknown until Vercel reports it.
    expect(before.previews.map((p: any) => [p.app, p.url])).toEqual([
      ['docs', 'https://bridge-docs-git-explore-button-normal-again-peterbonos-projects.vercel.app/'],
      ['storybook', null],
      ['admin', null],
    ]);
    const admin = 'bridge-admin-git-explore-button-norm-0ed5ba-peterbonos-projects.vercel.app';
    const storybook = 'bridge-storybook-git-explore-button-8a43de-peterbonos-projects.vercel.app';
    const vc = Buffer.from(JSON.stringify({ projects: [{ name: 'bridge-admin', previewUrl: admin, nextCommitStatus: 'DEPLOYED' }, { name: 'bridge-storybook', previewUrl: storybook, nextCommitStatus: 'BUILDING' }] })).toString('base64');
    const command = 'npm i @bridge-ds/react@https://github.com/acme/ds/releases/download/preview-pr-1/bridge-ds-react-abc1234.tgz';
    gh.comments.set(1, [`[vc]: #abc:${vc}\nThe latest updates on your projects.`, `<!-- bridge-branch-preview -->\n## Try this exploration in your product\n\n\`\`\`sh\n${command}\n\`\`\`\n`]);
    const after = (await explorations.listExplorations(ctx, {})).explorations[0] as any;
    expect(after.install).toMatchObject({ state: 'ready', command });
    expect(after.previews.find((p: any) => p.app === 'admin')).toMatchObject({ url: `https://${admin}/`, state: 'ready' });
    expect(after.previews.find((p: any) => p.app === 'storybook')).toMatchObject({ url: `https://${storybook}/`, state: 'building' });
    expect(JSON.stringify(after)).not.toContain('pkg.pr.new');
  });

  it('close, and read-only refusals', async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch });
    await explorations.startExploration(ctx, { name: 'Dense tables', purpose: 'Compact rows.' });
    const ro = await BridgeContext.create({ repo: 'acme/ds', fetch: gh.fetch });
    await expect(explorations.promoteExploration(ro, { ref: 'dense-tables' })).rejects.toThrow(/GITHUB_TOKEN/);
    await expect(explorations.archiveExploration(ro, { ref: 'dense-tables' })).rejects.toThrow(/GITHUB_TOKEN/);
    await expect(explorations.closeExploration(ro, { ref: 'dense-tables' })).rejects.toThrow(/GITHUB_TOKEN/);
    expect(await explorations.closeExploration(ctx, { ref: '#1' })).toMatchObject({ status: 'closed', number: 1, branch: 'explore/dense-tables' });
    expect(gh.pulls[0]!.state).toBe('closed');
    expect((await explorations.listExplorations(ctx, { state: 'all' })).explorations[0]!.status).toBe('closed');
  });
});

describe('explorations in a local repo', () => {
  it('start makes a local branch only; token edits need the branch checked out and land in the working tree', async () => {
    const dir = tempGitRepo(REPO, REAL_PATHS);
    const ctx = await BridgeContext.create({ root: dir });
    const r = (await explorations.startExploration(ctx, { name: 'Warm neutrals', purpose: 'Do warmer greys calm the dashboard?' })) as any;
    expect(r).toMatchObject({ status: 'branch-created', branch: 'explore/warm-neutrals' });
    expect(r.next).toContain('git push -u origin explore/warm-neutrals');
    expect(git(dir, 'show', 'explore/warm-neutrals:.bridge/explorations/warm-neutrals.md')).toContain('# Exploration: Warm neutrals');
    expect(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD').trim()).toBe('main');
    await expect(explorations.startExploration(ctx, { name: 'Warm neutrals', purpose: 'Again.' })).rejects.toThrow(/already exists/);

    await expect(ops.proposeTokenChange(ctx, { title: 'Darken muted text', edits: [edit], branch: 'explore/warm-neutrals' })).rejects.toThrow(/git switch explore\/warm-neutrals/);
    execFileSync('git', ['switch', '-q', 'explore/warm-neutrals'], { cwd: dir });
    const before = readFileSync(join(dir, LIGHT), 'utf8');
    const p = (await ops.proposeTokenChange(ctx, { title: 'Darken muted text', edits: [edit], branch: 'explore/warm-neutrals' })) as any;
    expect(p).toMatchObject({ status: 'written', branch: 'explore/warm-neutrals' });
    expect(p.next).toContain('Do not open a pull request to main');
    expect(readFileSync(join(dir, LIGHT), 'utf8')).not.toBe(before);
    // No bridge/* branch was created: the edits stay on the exploration.
    expect(git(dir, 'branch', '--list', 'bridge/*').trim()).toBe('');
  });
});

describe('continue an exploration', () => {
  it('resolves "Continue Bridge exploration #n", says where it stands, then what changed', async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch });
    await explorations.startExploration(ctx, { name: 'Orders bulk actions' });
    const first = (await explorations.continueExploration(ctx, { ref: 'Continue Bridge exploration #1 "Orders bulk actions" in Library and use the Bridge library.' })) as any;
    expect(first).toMatchObject({ ref: '#1', number: 1, name: 'Orders bulk actions', branch: 'explore/orders-bulk-actions', stage: 'not-started', status: 'active' });
    expect(first.whereItStands).toBe('"Orders bulk actions" is started but nothing is built yet.');
    expect(first.continueLines.terminal).toBe('claude "Continue Bridge exploration #1"');
    // Remote: nothing to switch, the write tools take the branch.
    expect(first.checkout).toMatchObject({ status: 'not-switched' });
    expect(first.next).toMatch(/^Start by telling the designer where it stands/);

    const client = (await ctx.github())!.withBranchPrefix('explore/');
    await client.commitToBranch({ branch: 'explore/orders-bulk-actions', message: 'feat: add a Bulk actions bar\n\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>', files: [{ path: 'apps/admin/src/BulkActionsBar.tsx', content: 'export {}\n' }] });
    const then = (await explorations.continueExploration(ctx, { ref: '#1' })) as any;
    expect(then.stage).toBe('exploring');
    expect(then.activity[0]).toMatchObject({ who: 'owner with Claude', what: 'added a Bulk actions bar' });
    expect(then.activity.at(-1)).toMatchObject({ what: 'started the exploration' });
    expect(then.whereItStands).toMatch(/^So far it changes Bulk actions bar\. Last: owner with Claude added a Bulk actions bar/);
    expect(then.whereItStands).not.toMatch(/commit|pull request|—/);
  });

  it('continue an exploration started from a page of a live product: the brief rebuilds that page with the library first', async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch });
    await explorations.startExploration(ctx, { name: 'Gift option' });
    const client = (await ctx.github())!;
    const pr = await client.getPullRequest(1);
    await client.withBranchPrefix('explore/').updatePullRequest(1, { body: pr.body.replace('"slug":', '"startPage":"https://posterstudio.com/checkout","slug":') });
    const r = (await explorations.continueExploration(ctx, { ref: '#1' })) as any;
    expect(r.stage).toBe('not-started');
    expect(r.startFrom).toBe('https://posterstudio.com/checkout');
    expect(r.next).toMatch(/^Start from https:\/\/posterstudio\.com\/checkout/);
    expect(r.next).toMatch(/Claude in Chrome/);
    expect(r.next).toMatch(/ONLY the library's components and tokens/);
    expect(r.next).toMatch(/Never copy the site's CSS/);
  });

  it('continue an exploration started from a mockup: the brief rebuilds it with the library, measures, never invents a token', async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch });
    await explorations.startExploration(ctx, { name: 'Contacts quick filter' });
    const client = (await ctx.github())!;
    const pr = await client.getPullRequest(1);
    const link = 'https://www.figma.com/design/k3P9xQab/CRM-screens?node-id=212-4180';
    await client.withBranchPrefix('explore/').updatePullRequest(1, { body: pr.body.replace('"slug":', `"mockup":"${link}","slug":`) });
    const r = (await explorations.continueExploration(ctx, { ref: '#1' })) as any;
    expect(r.mockup).toEqual({ kind: 'figma', url: link, label: 'the Figma frame 212:4180 in CRM screens' });
    expect(r.next).toMatch(/^Start from the Figma frame 212:4180 in CRM screens/);
    expect(r.next).toMatch(/ONLY the library's components and tokens/);
    expect(r.next).toMatch(/measure your build against the mockup/);
    expect(r.next).toMatch(/Never invent a token name: check each one with bridge_get_token or bridge_search_tokens/);
    expect(r.next).toMatch(/list what the mockup uses that the library does not have/);
  });

  it('starts from a mockup link with its name, and asks for the missing pieces once it is read; a page link is refused', async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch });
    await expect(explorations.startExploration(ctx, { name: 'Contacts', mockup: 'https://www.figma.com/design/k3P9xQab/CRM-screens' })).rejects.toThrow(/mockup: This link opens a whole Figma page/);
    await explorations.startExploration(ctx, { name: 'Contacts quick filter', mockup: 'https://www.figma.com/design/k3P9xQab/CRM-screens?node-id=212-4180&t=x', mockupName: 'Contacts v3' });
    const client = (await ctx.github())!;
    const body = (await client.getPullRequest(1)).body;
    expect(body).toContain('"mockup":"https://www.figma.com/design/k3P9xQab/CRM-screens?node-id=212-4180"');
    expect(body).toContain('"mockupName":"Contacts v3"');
    const r = (await explorations.continueExploration(ctx, { ref: '#1' })) as any;
    expect(r.next).toMatch(/record what the library lacks with bridge_missing_pieces \{ pr: "#1", record: true \}/);
    expect(r.next).not.toMatch(/pass its own name in mockupName/);
  });

  it('lists only the ones the person started with mine', async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch });
    await explorations.startExploration(ctx, { name: 'Pill buttons' });
    expect(((await explorations.listExplorations(ctx, { mine: true })) as any).explorations).toHaveLength(0);
    gh.viewer.login = 'agent';
    expect(((await explorations.listExplorations(ctx, { mine: true })) as any).explorations.map((x: any) => x.ref)).toEqual(['#1']);
  });

  it("counts as mine what Bridge's app opened for the person (owned), though GitHub names the app", async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const start = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch });
    const made = (await explorations.startExploration(start, { name: 'Pill buttons' })) as any;
    gh.viewer.login = 'someone-else';
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch, owned: async () => [{ repo: 'ACME/ds', branch: made.branch }] });
    expect(((await explorations.listExplorations(ctx, { mine: true })) as any).explorations.map((x: any) => x.ref)).toEqual(['#1']);
    const none = await BridgeContext.create({ repo: 'acme/ds', token: 't', fetch: gh.fetch, owned: async () => [] });
    expect(((await explorations.listExplorations(none, { mine: true })) as any).explorations).toHaveLength(0);
  });
});
