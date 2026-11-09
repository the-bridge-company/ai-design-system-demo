// The plan scripts/seed-demo-explorations.mjs sends: each item's files read from its branch in a local clone.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { args, buildPlan, printSeed } from './seed-demo-explorations.mjs';

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

    // Notes go to the site as written: it checks them and saves them as the member.
    const notes = { decisions: ['Gift wrap sits under the total.'], nextStep: 'Ann takes a look.' };
    writeFileSync(planPath, JSON.stringify({ items: [{ clone: 'copy', branch: 'explore/gift-wrap', product: 'prints', member: 'Sofia', name: 'Gift wrap at checkout', notes }] }));
    expect(buildPlan(planPath).plan.items[0].notes).toEqual(notes);
  });

  it('says what happened to the notes', () => {
    const lines = [];
    const log = console.log;
    console.log = (s) => lines.push(s);
    try {
      printSeed({
        dryRun: false,
        items: [
          { copy: 'acme/prints-design', branch: 'explore/a', member: 'Sofia', files: 2, status: 'exists', state: 'done', notes: 'saved' },
          { copy: 'acme/prints-design', branch: 'explore/b', member: 'Leo', files: 1, status: 'exists', state: 'exploring', notes: 'same' },
          { copy: 'acme/prints-design', branch: 'explore/c', member: 'Ann', files: 1, status: 'exists', state: 'exploring' },
        ],
      });
    } finally {
      console.log = log;
    }
    expect(lines).toEqual([
      'acme/prints-design explore/a: as Sofia, 2 files, already there, notes saved',
      'acme/prints-design explore/b: as Leo, 1 file, already there, notes already say this',
      'acme/prints-design explore/c: as Ann, 1 file, already there, left as it is',
    ]);
  });

  it('says how many files of an exploration already there it updates', () => {
    const lines = [];
    const log = console.log;
    console.log = (s) => lines.push(s);
    try {
      const items = [{ copy: 'acme/prints-design', branch: 'explore/a', member: 'Leo', files: 4, status: 'exists', state: 'exploring', updates: 2, screen: 'writes' }];
      printSeed({ dryRun: true, items });
      printSeed({ dryRun: false, items: [{ ...items[0], updates: 1, screen: 'saved' }] });
    } finally {
      console.log = log;
    }
    expect(lines).toEqual([
      'acme/prints-design explore/a: as Leo, 4 files, already there, updates 2 files, sets its screen',
      'acme/prints-design explore/a: as Leo, 4 files, already there, updated 1 file, screen set',
    ]);
  });
});
