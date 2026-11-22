// What a warm server keeps between requests (the hosted connector makes a new BridgeContext for every MCP call):
// the files of a repository at one commit, keyed by (owner/name, commit sha). A commit never changes, so an entry is
// never stale; a push moves the branch to a new sha, which is a new key. The bounds only keep memory in check.
//
// Safety: an entry is only read after the caller's own client resolved the branch to that sha in the same request
// (GitHubSource), so a caller who cannot read the repository never gets past that live read, and the key carries the
// repository, so one team's files never answer another's.

/** Files of one repository at one commit: the tree and each file read so far (null: not there at that commit). */
interface Snapshot {
  at: number;
  tree?: Promise<string[]>;
  files: Map<string, Promise<string | null>>;
}

export interface SnapshotCacheOptions {
  /** Commits kept at once (least recently used goes first). */
  maxSnapshots?: number;
  /** How long a commit is kept after its last use (ms). */
  ttlMs?: number;
  /** How long a repository's default branch name is trusted without asking GitHub again (ms). */
  defaultBranchTtlMs?: number;
  now?: () => number;
}

export class SnapshotCache {
  private readonly snapshots = new Map<string, Snapshot>();
  private readonly defaults = new Map<string, { branch: string; at: number }>();
  private readonly max: number;
  private readonly ttl: number;
  private readonly branchTtl: number;
  private readonly now: () => number;
  /** Reads answered from memory and reads that went to GitHub, for tests and logs. */
  readonly stats = { hits: 0, misses: 0 };

  constructor(o: SnapshotCacheOptions = {}) {
    this.max = o.maxSnapshots ?? 16;
    this.ttl = o.ttlMs ?? 15 * 60_000;
    this.branchTtl = o.defaultBranchTtlMs ?? 5 * 60_000;
    this.now = o.now ?? Date.now;
  }

  private key(repo: string, sha: string) {
    return `${repo.toLowerCase()}@${sha}`;
  }

  private entry(repo: string, sha: string): Snapshot {
    const k = this.key(repo, sha);
    const t = this.now();
    let s = this.snapshots.get(k);
    if (s && t - s.at > this.ttl) {
      this.snapshots.delete(k);
      s = undefined;
    }
    if (s) {
      // Most recently used last: Map keeps insertion order, so the first key is the one to drop.
      this.snapshots.delete(k);
    } else {
      s = { at: t, files: new Map() };
    }
    s.at = t;
    this.snapshots.set(k, s);
    while (this.snapshots.size > this.max) this.snapshots.delete(this.snapshots.keys().next().value!);
    return s;
  }

  /** The value at (repo, sha, slot), loaded once; a failed load is forgotten so the next request asks again. */
  private once<T>(map: Map<string, Promise<T>>, slot: string, load: () => Promise<T>): Promise<T> {
    const kept = map.get(slot);
    if (kept) {
      this.stats.hits++;
      return kept;
    }
    this.stats.misses++;
    const p = load();
    map.set(slot, p);
    p.catch(() => {
      if (map.get(slot) === p) map.delete(slot);
    });
    return p;
  }

  /** Every file path of the repository at `sha`. */
  tree(repo: string, sha: string, load: () => Promise<string[]>): Promise<string[]> {
    const s = this.entry(repo, sha);
    if (s.tree) {
      this.stats.hits++;
      return s.tree;
    }
    this.stats.misses++;
    const p = load();
    s.tree = p;
    p.catch(() => {
      if (s.tree === p) delete s.tree;
    });
    return p;
  }

  /** The text of `path` at `sha` (null when the file is not there). */
  file(repo: string, sha: string, path: string, load: () => Promise<string | null>): Promise<string | null> {
    return this.once(this.entry(repo, sha).files, path, load);
  }

  /** The repository's default branch as last read, while recent enough. */
  defaultBranch(repo: string): string | undefined {
    const d = this.defaults.get(repo.toLowerCase());
    if (!d) return undefined;
    if (this.now() - d.at > this.branchTtl) {
      this.defaults.delete(repo.toLowerCase());
      return undefined;
    }
    return d.branch;
  }

  rememberDefaultBranch(repo: string, branch: string): void {
    this.defaults.set(repo.toLowerCase(), { branch, at: this.now() });
    // A handful of teams per function at most; a bound all the same.
    while (this.defaults.size > this.max * 4) this.defaults.delete(this.defaults.keys().next().value!);
  }

  forgetDefaultBranch(repo: string): void {
    this.defaults.delete(repo.toLowerCase());
  }

  clear(): void {
    this.snapshots.clear();
    this.defaults.clear();
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  get size(): number {
    return this.snapshots.size;
  }
}

/** The one cache of this process: a warm hosted function reuses it across requests. */
export const sharedSnapshots = new SnapshotCache();
