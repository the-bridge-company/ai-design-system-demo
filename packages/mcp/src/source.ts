// Where the repo comes from: the local working tree, a local git ref, or GitHub over the REST API.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { GitHubClient } from '@bridge-ds/core';
import { listFilesAt, showFile } from '@bridge-ds/core/node';
import type { SnapshotCache } from './snapshot-cache.js';

export interface RepoSource {
  kind: 'local' | 'git-ref' | 'github';
  /** Human label: a path, `ref` or `owner/repo@ref`. */
  label: string;
  /** Repo-relative file paths under `prefix` ('' for everything). */
  list(prefix?: string): Promise<string[]>;
  read(path: string): Promise<string | null>;
}

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'storybook-static', '.turbo', '.next', '.astro']);
const under = (prefix: string) => (f: string) => !prefix || prefix === '.' || f === prefix || f.startsWith(`${prefix.replace(/\/$/, '')}/`);

export class LocalSource implements RepoSource {
  readonly kind = 'local' as const;
  constructor(readonly root: string) {}
  get label() {
    return this.root;
  }
  async list(prefix = ''): Promise<string[]> {
    const out: string[] = [];
    const start = prefix && prefix !== '.' ? prefix.replace(/\/$/, '') : '';
    const walk = async (rel: string) => {
      let entries;
      try {
        entries = await readdir(join(this.root, rel), { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (SKIP.has(e.name)) continue;
        const p = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) await walk(p);
        else if (e.isFile()) out.push(p);
      }
    };
    await walk(start);
    return out.sort();
  }
  async read(path: string): Promise<string | null> {
    try {
      return await readFile(join(this.root, path), 'utf8');
    } catch {
      return null;
    }
  }
}

/** A local git ref (branch, tag, sha): reviews of local proposal branches and `bridge diff <base>`. */
export class GitRefSource implements RepoSource {
  readonly kind = 'git-ref' as const;
  private files?: Promise<string[]>;
  constructor(
    readonly root: string,
    readonly ref: string,
  ) {}
  get label() {
    return this.ref;
  }
  async list(prefix = ''): Promise<string[]> {
    this.files ??= listFilesAt(this.root, this.ref);
    return (await this.files).filter(under(prefix));
  }
  read(path: string) {
    return showFile(this.root, this.ref, path);
  }
}

export class GitHubSource implements RepoSource {
  readonly kind = 'github' as const;
  private tree?: Promise<string[]>;
  private cache = new Map<string, Promise<string | null>>();
  private pinned?: Promise<string | undefined>;
  /**
   * `shared`: reads across requests (the hosted connector). On the first read the branch is resolved to its commit
   * with this source's own client (one live read, the caller's access check), then the tree and files come from the
   * shared cache for that (repo, commit), and the ones it lacks are read at the commit. When the branch cannot be
   * resolved, reads go to the branch as without it. `onMissing`: the branch is gone (a stale default branch name).
   */
  constructor(
    readonly client: GitHubClient,
    readonly ref: string,
    readonly shared?: { cache: SnapshotCache; onMissing?: () => void },
  ) {}
  get label() {
    return `${this.client.fullName}@${this.ref}`;
  }
  /** The commit reads are pinned to, or undefined (no shared cache, or the branch did not resolve). */
  sha(): Promise<string | undefined> {
    if (!this.shared) return Promise.resolve(undefined);
    this.pinned ??= this.client.getBranchSha(this.ref).then(
      (sha) => {
        if (!sha) this.shared!.onMissing?.();
        return sha;
      },
      () => undefined,
    );
    return this.pinned;
  }
  async list(prefix = ''): Promise<string[]> {
    this.tree ??= this.sha().then((sha) => (sha ? this.shared!.cache.tree(this.client.fullName, sha, () => this.client.listFiles(sha)) : this.client.listFiles(this.ref)));
    return (await this.tree).filter(under(prefix));
  }
  read(path: string): Promise<string | null> {
    let p = this.cache.get(path);
    if (!p) {
      p = this.sha().then((sha) =>
        sha ? this.shared!.cache.file(this.client.fullName, sha, path, () => this.client.readFile(path, sha).then((t) => t ?? null)) : this.client.readFile(path, this.ref).then((t) => t ?? null),
      );
      this.cache.set(path, p);
    }
    return p;
  }
}
