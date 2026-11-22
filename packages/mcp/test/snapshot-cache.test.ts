// The hosted connector's context cache (snapshot-cache.ts): a new BridgeContext per MCP call reads an unchanged
// repository with one live read (the branch's commit), a push is a new commit and so a new read, a named branch reads
// that branch, the key carries the repository, and a caller whose live read fails never gets the kept files.
import { describe, expect, it } from 'vitest';
import { BridgeContext, ops, SnapshotCache } from '../dist/lib.js';
import { addCodeTo, fakeGitHub, pinStart, readTree, REAL_PATHS, REPO } from './helpers.js';

const files = () => pinStart(readTree(REPO, REAL_PATHS));
const reads = (gh: ReturnType<typeof fakeGitHub>) => gh.log.filter((l) => l.method === 'GET').map((l) => l.path);
/** One MCP call as the hosted connector makes it: a new context, the tool that reads the most (the whole token set). */
const call = async (gh: ReturnType<typeof fakeGitHub>, cache: SnapshotCache, o: { ref?: string; fetch?: typeof fetch } = {}) => {
  const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 'test-token', fetch: o.fetch ?? gh.fetch, snapshots: cache, ...(o.ref ? { ref: o.ref } : {}) });
  return ops.getToken(ctx, { path: 'color.text.muted' });
};

describe('context cache by commit (hosted connector)', () => {
  it('a second call on an unchanged repository reads only the branch commit', async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const cache = new SnapshotCache();
    const first = await call(gh, cache);
    const cold = reads(gh);
    // Cold: the default branch, its commit, then the config, the tree and every token file at that commit.
    expect(cold[0]).toBe('');
    expect(cold[1]).toBe('/git/ref/heads/main');
    expect(cold.length).toBeGreaterThan(10);
    gh.log.length = 0;
    const second = await call(gh, cache);
    expect(second).toEqual(first);
    expect(reads(gh)).toEqual(['/git/ref/heads/main']);
    expect(cache.stats.hits).toBeGreaterThan(cache.stats.misses / 2);
  });

  it('a push moves the branch: the next call reads the new commit, never the kept files', async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const cache = new SnapshotCache();
    await call(gh, cache);
    const path = 'packages/tokens/src/semantic/light.tokens.json';
    const before = gh.fileAt('main', path)!;
    const head = gh.refs.get('main')!;
    const next = new Map(gh.commits.get(head)!.files);
    next.set(path, before.replace('{palette.neutral.600}', '{palette.neutral.800}'));
    const sha = gh.id();
    gh.commits.set(sha, { files: next, parents: [head] });
    gh.refs.set('main', sha);
    gh.log.length = 0;
    const after = (await call(gh, cache)) as { values: { value: string }[] };
    const r = reads(gh);
    expect(r[0]).toBe('/git/ref/heads/main');
    expect(r.length).toBeGreaterThan(5);
    expect(JSON.stringify(after.values)).toContain('neutral.800');
    expect(cache.size).toBe(2);
  });

  it('a context on a named branch reads that branch live, not the default branch cache', async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const cache = new SnapshotCache();
    await call(gh, cache);
    gh.refs.set('bridge/try', gh.refs.get('main')!);
    addCodeTo(gh, 'bridge/try');
    gh.log.length = 0;
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 'test-token', fetch: gh.fetch, snapshots: cache, ref: 'bridge/try' });
    expect(ctx.ref).toBe('bridge/try');
    expect(await ctx.source.read('packages/react/src/components/Button/notes.ts')).toContain('notes');
    const r = reads(gh);
    expect(r).not.toContain('/git/ref/heads/main');
    expect(r.some((p) => p.startsWith('/contents/'))).toBe(true);
  });

  it('keys by repository: another repository at the same commit reads its own files', async () => {
    const cache = new SnapshotCache();
    const a = fakeGitHub('acme', 'ds', files());
    const b = fakeGitHub('other', 'ds', { 'bridge.config.json': '{}' });
    // Same commit id in both fakes (their counters start alike): only the repository tells them apart.
    expect(b.refs.get('main')).toBe(a.refs.get('main'));
    await call(a, cache);
    const ctx = await BridgeContext.create({ repo: 'other/ds', token: 't', fetch: b.fetch, snapshots: cache });
    expect(await ctx.source.read('AGENTS.md')).toBeNull();
    expect(b.log.some((l) => l.path === '/contents/AGENTS.md')).toBe(true);
  });

  it('a caller whose live read is refused never gets the kept files', async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const cache = new SnapshotCache();
    await call(gh, cache);
    // Default branch still remembered; the branch read and every other read are refused for this caller.
    const refused = (async () => new Response(JSON.stringify({ message: 'Bridge does not read this from GitHub.' }), { status: 403, headers: { 'content-type': 'application/json' } })) as typeof fetch;
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 'test-token', fetch: refused, snapshots: cache });
    await expect(ctx.source.read('bridge.config.json')).rejects.toThrow();
  });

  it('a renamed default branch: the stale name is forgotten, the next call asks GitHub again', async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const cache = new SnapshotCache();
    await call(gh, cache);
    expect(cache.defaultBranch('acme/ds')).toBe('main');
    gh.refs.delete('main');
    const ctx = await BridgeContext.create({ repo: 'acme/ds', token: 'test-token', fetch: gh.fetch, snapshots: cache });
    await ctx.source.read('bridge.config.json');
    expect(cache.defaultBranch('acme/ds')).toBeUndefined();
  });

  it('bounds: least recently used commit goes first, and an old one expires', () => {
    let t = 0;
    const cache = new SnapshotCache({ maxSnapshots: 2, ttlMs: 1000, now: () => t });
    const load = (v: string) => () => Promise.resolve(v);
    void cache.file('a/b', '1', 'x', load('one'));
    void cache.file('a/b', '2', 'x', load('two'));
    void cache.file('a/b', '1', 'x', load('again'));
    void cache.file('a/b', '3', 'x', load('three'));
    expect(cache.size).toBe(2);
    return Promise.all([cache.file('a/b', '1', 'x', load('reloaded')), cache.file('a/b', '2', 'x', load('reloaded'))]).then(([one, two]) => {
      expect(one).toBe('one');
      expect(two).toBe('reloaded');
      t = 5000;
      return cache.file('a/b', '1', 'x', load('fresh')).then((v) => expect(v).toBe('fresh'));
    });
  });

  it('a failed read is not kept', async () => {
    const cache = new SnapshotCache();
    await expect(cache.file('a/b', '1', 'x', () => Promise.reject(new Error('busy')))).rejects.toThrow('busy');
    expect(await cache.file('a/b', '1', 'x', () => Promise.resolve('ok'))).toBe('ok');
  });

  it('without the option, every context reads everything again (the CLI and the local server)', async () => {
    const gh = fakeGitHub('acme', 'ds', files());
    const plain = async () => ops.getToken(await BridgeContext.create({ repo: 'acme/ds', token: 'test-token', fetch: gh.fetch }), { path: 'color.text.muted' });
    await plain();
    const once = reads(gh).length;
    gh.log.length = 0;
    await plain();
    expect(reads(gh).length).toBe(once);
    expect(reads(gh)).not.toContain('/git/ref/heads/main');
  });
});
