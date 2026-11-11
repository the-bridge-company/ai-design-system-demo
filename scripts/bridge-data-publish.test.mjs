// The "Publish to the bridge-data branch" step of .github/workflows/bridge-data.yml and templates/bridge-data.yml, run
// for real against local repositories: the branch is replaced on every run, yet a "Not a problem" decision saved from
// Studio (audit-ignores.json) while the snapshot ran is never lost. The step carries the branch's latest file forward
// and replaces only the tip it read; a save after that read makes the push fail and the next attempt carry it.
import { execFileSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKFLOWS = ['.github/workflows/bridge-data.yml', 'templates/bridge-data.yml'];
const GIT = execFileSync('/bin/sh', ['-c', 'command -v git'], { encoding: 'utf8' }).trim();

/** The `run: |` script of the publish step, as the runner gets it. */
function publishScript(file) {
  const lines = readFileSync(join(ROOT, file), 'utf8').split('\n');
  const step = lines.findIndex((l) => /- name: Publish to the bridge-data branch\s*$/.test(l));
  expect(step, file).toBeGreaterThan(-1);
  const run = lines.findIndex((l, i) => i > step && /^\s+run: \|\s*$/.test(l));
  const indent = /^(\s*)/.exec(lines[run + 1])[1].length;
  const body = [];
  for (const l of lines.slice(run + 1)) {
    if (l.trim() && /^(\s*)/.exec(l)[1].length < indent) break;
    body.push(l.slice(indent));
  }
  return body.join('\n');
}

const decisions = (...groups) => `${JSON.stringify({ version: 1, ignores: groups.map((group) => ({ product: 'crm', group, reason: 'On purpose', at: '2026-11-11T00:00:00Z', places: [] })) }, null, 2)}\n`;

let dirs = [];
afterEach(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
  dirs = [];
});

function world() {
  const base = mkdtempSync(join(tmpdir(), 'bridge-data-'));
  dirs.push(base);
  const env = { ...process.env, GIT_CONFIG_GLOBAL: join(base, 'gitconfig'), GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' };
  writeFileSync(env.GIT_CONFIG_GLOBAL, '[init]\n\tdefaultBranch = main\n');
  const git = (cwd, ...args) => execFileSync(GIT, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const remote = join(base, 'remote.git');
  git(base, 'init', '-q', '--bare', remote);
  const work = join(base, 'work');
  git(base, 'clone', '-q', remote, work);
  writeFileSync(join(work, 'README.md'), 'design system\n');
  git(work, 'add', '-A');
  git(work, 'commit', '-qm', 'init');
  git(work, 'push', '-q', 'origin', 'HEAD:refs/heads/main');
  /** Studio saving decisions on the data branch (the contents API makes one commit on its tip). */
  const studio = join(base, 'studio');
  const save = (text) => {
    rmSync(studio, { recursive: true, force: true });
    git(base, 'clone', '-q', remote, studio);
    const has = git(studio, 'ls-remote', 'origin', 'refs/heads/bridge-data');
    if (has) git(studio, 'checkout', '-q', 'bridge-data');
    else git(studio, 'checkout', '-q', '--orphan', 'bridge-data');
    writeFileSync(join(studio, 'audit-ignores.json'), text);
    git(studio, 'add', '-A');
    git(studio, 'commit', '-qm', 'Bridge: not a problem');
    git(studio, 'push', '-q', 'origin', 'HEAD:refs/heads/bridge-data');
  };
  /** What this run's snapshot wrote: the decisions as the run read them at its start. */
  const out = join(base, 'out');
  mkdirSync(out);
  const publish = (file, opts = {}) => {
    const script = join(base, 'publish.sh');
    writeFileSync(script, publishScript(file));
    const pathEnv = opts.path ? `${opts.path}:${env.PATH}` : env.PATH;
    return execFileSync('bash', [script], { cwd: work, env: { ...env, PATH: pathEnv, OUT: out, RUNNER_TEMP: join(base, 'runner'), DATA_BRANCH: 'bridge-data', GITHUB_REPOSITORY: 'acme/design' }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  };
  const show = (path) => git(base, `--git-dir=${remote}`, 'show', `bridge-data:${path}`);
  return { base, env, git, save, out, publish, show };
}

describe.each(WORKFLOWS)('%s: publish the bridge-data branch', (file) => {
  it('a first run publishes what the snapshot wrote', () => {
    const w = world();
    writeFileSync(join(w.out, 'snapshot.json'), '{"run":2}\n');
    w.publish(file);
    expect(w.show('snapshot.json')).toBe('{"run":2}');
  });

  it("carries forward a decision saved while the snapshot ran (the branch's file wins)", () => {
    const w = world();
    w.save(decisions('piece:Menu'));
    // The run read Menu at its start; Button was saved from Studio before it published.
    writeFileSync(join(w.out, 'snapshot.json'), '{"run":2}\n');
    writeFileSync(join(w.out, 'audit-ignores.json'), decisions('piece:Menu'));
    w.save(decisions('piece:Menu', 'piece:Button'));
    w.publish(file);
    expect(w.show('snapshot.json')).toBe('{"run":2}');
    expect(JSON.parse(w.show('audit-ignores.json')).ignores.map((x) => x.group)).toEqual(['piece:Menu', 'piece:Button']);
  });

  it('a decision saved between the read and the push makes the push fail, and the next attempt carries it', () => {
    const w = world();
    w.save(decisions('piece:Menu'));
    writeFileSync(join(w.out, 'snapshot.json'), '{"run":2}\n');
    // A git that lets Studio save once right before the first push.
    const bin = join(w.base, 'bin');
    mkdirSync(bin);
    const mark = join(w.base, 'saved');
    writeFileSync(
      join(bin, 'git'),
      `#!/bin/sh\ncase " $* " in *" push "*) if [ ! -f "${mark}" ]; then touch "${mark}"; "${process.execPath}" "${join(w.base, 'studio-save.mjs')}" || exit 9; fi ;; esac\nexec "${GIT}" "$@"\n`,
    );
    chmodSync(join(bin, 'git'), 0o755);
    writeFileSync(
      join(w.base, 'studio-save.mjs'),
      `import { execFileSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
const studio = ${JSON.stringify(join(w.base, 'studio'))};
const g = (cwd, ...a) => execFileSync(${JSON.stringify(GIT)}, a, { cwd, stdio: 'ignore' });
rmSync(studio, { recursive: true, force: true });
g(${JSON.stringify(w.base)}, 'clone', '-q', '-b', 'bridge-data', ${JSON.stringify(join(w.base, 'remote.git'))}, studio);
writeFileSync(studio + '/audit-ignores.json', ${JSON.stringify(decisions('piece:Menu', 'piece:Button'))});
g(studio, 'add', '-A');
g(studio, 'commit', '-qm', 'Bridge: not a problem');
g(studio, 'push', '-q', 'origin', 'HEAD:refs/heads/bridge-data');
`,
    );
    w.publish(file, { path: bin });
    expect(w.show('snapshot.json')).toBe('{"run":2}');
    expect(JSON.parse(w.show('audit-ignores.json')).ignores.map((x) => x.group)).toEqual(['piece:Menu', 'piece:Button']);
  }, 30000);
});
