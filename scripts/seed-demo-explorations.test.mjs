// The plan scripts/seed-demo-explorations.mjs sends: each item's files read from its branch in a local clone.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { args, buildPlan } from './seed-demo-explorations.mjs';

const dir = mkdtempSync(join(tmpdir(), 'seed-plan-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, '-c', 'user.name=t', '-c', 'user.email=t@t.invalid', ...a], { encoding: 'utf8' });
const write = (root, path, content) => {
  mkdirSync(join(root, path, '..'), { recursive: true });
  writeFileSync(join(root, path), content);
};

describe('seed-demo-explorations plan', () => {
  it('reads the options, a dry run by default', () => {
    expect(args(['--plan', 'p.json'])).toEqual({ base: 'https://bridge.floriangouloubi.com', apply: false, plan: 'p.json' });
    expect(args(['--plan', 'p.json', '--apply', '--base', 'http://localhost:4321/'])).toMatchObject({ apply: true, base: 'http://localhost:4321' });
  });

  it('sends the files the branch adds or changes, never deleted ones, binaries or Bridge note', () => {
    const clone = join(dir, 'copy');
    mkdirSync(clone);
    git(clone, 'init', '-q', '-b', 'main');
    write(clone, 'src/App.tsx', 'app\n');
    write(clone, 'src/Old.tsx', 'old\n');
    git(clone, 'add', '.');
    git(clone, 'commit', '-q', '-m', 'init');
    git(clone, 'checkout', '-q', '-b', 'explore/gift-wrap');
    write(clone, 'src/App.tsx', 'app with gift\n');
    write(clone, 'src/checkout/GiftWrap.tsx', 'export const GiftWrap = () => null;\n');
    write(clone, '.bridge/explorations/gift-wrap.md', 'note\n');
    writeFileSync(join(clone, 'logo.png'), Buffer.from([0x89, 0x50, 0x00, 0x01]));
    rmSync(join(clone, 'src/Old.tsx'));
    git(clone, 'add', '-A');
    git(clone, 'commit', '-q', '-m', 'gift');
    git(clone, 'checkout', '-q', 'main');
    const planPath = join(dir, 'plan.json');
    writeFileSync(planPath, JSON.stringify({ items: [{ clone: 'copy', branch: 'explore/gift-wrap', product: 'prints', member: 'Sofia', name: 'Gift wrap at checkout', state: 'done' }] }));
    const { plan, skipped } = buildPlan(planPath);
    expect(plan.items).toEqual([
      {
        branch: 'explore/gift-wrap',
        product: 'prints',
        member: 'Sofia',
        name: 'Gift wrap at checkout',
        state: 'done',
        files: [
          { path: 'src/App.tsx', content: 'app with gift\n' },
          { path: 'src/checkout/GiftWrap.tsx', content: 'export const GiftWrap = () => null;\n' },
        ],
      },
    ]);
    expect(skipped).toEqual(['explore/gift-wrap: logo.png (not text)']);
  });
});
