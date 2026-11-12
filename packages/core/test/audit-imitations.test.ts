import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'vitest';
import { auditFile, auditMarkdown, buildAuditReport, compareWithBaseline, imitationRules, IMITATION_PATTERNS, isAuditable } from '../src/audit';
import { loadDesignSystem, runAudit } from '../src/node/audit';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const FIX = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/audit');
const ds = () => loadDesignSystem(REPO).index;
const DS = `import { Badge, Button, Link, Tabs, SegmentedControl, Menu, Dialog } from '@bridge-ds/react';\n`;
/** `line:suggestion` of each imitation in a file. */
const found = (path: string, text: string) => (auditFile(path, text, ds()).imitations ?? []).map((x) => `${x.line}:${x.suggestion}`);

describe('imitation rules come from the DS inventory', () => {
  test('a pattern is checked only when the DS exports its component, with a fallback to an alternative it exports', () => {
    const all = imitationRules(ds().components);
    assert.equal(all.byRole.get('tab')?.component, 'Tabs');
    assert.equal(all.byRole.get('radiogroup')?.component, 'SegmentedControl');
    const noTabs = imitationRules(new Set(['Button', 'RadioGroup']));
    assert.equal(noTabs.byRole.get('tab'), undefined, 'no Tabs in the DS: role="tab" is not an imitation');
    assert.equal(noTabs.byRole.get('radiogroup')?.component, 'RadioGroup', 'falls back to RadioGroup without SegmentedControl');
    // Every other exported component covers its own kebab name.
    assert.ok(all.patterns.some((p) => p.component === 'EmptyState' && p.classWords?.includes('empty-state')));
    for (const p of IMITATION_PATTERNS) assert.ok(/^[A-Z]/.test(p.component));
  });
});

describe('elements', () => {
  test('role="tab", "tablist", "tabpanel" outside DS Tabs, a DS Link with role="tab" included', () => {
    const page = `${DS}export const P = () => (
  <nav className="page-tabs" role="tablist">
    <Link role="tab" href="#a" aria-selected="true">Usage</Link>
  </nav>
);
export const Q = () => <div role="tabpanel" />;
export const OK = () => <Tabs.Tab role="tab" value="a">A</Tabs.Tab>;\n`;
    assert.deepEqual(found('p.tsx', page), ['3:Tabs', '4:Tabs', '7:Tabs']);
  });

  test('an imitation is not adoption: the DS Link dressed as a tab leaves the DS count', () => {
    const f = auditFile('p.tsx', `${DS}export const P = () => <><Link role="tab" href="#a">A</Link><Link href="/b">B</Link></>;\n`, ds());
    assert.equal(f.dsComponents, 1);
    assert.equal(f.otherComponents, 0);
    assert.equal(f.imitations?.length, 1);
  });

  test('a data attribute that wires a tab by hand (data-set-tab) on a DS Link', () => {
    const astro = `---\nimport { Link } from '@bridge-ds/react';\n---\n<nav class="set-groups-nav">\n  <Link variant="subtle" href="#a" data-set-tab="a">A</Link>\n</nav>\n`;
    const f = auditFile('settings.astro', astro, ds());
    assert.deepEqual(f.imitations?.map((x) => [x.line, x.rule, x.suggestion]), [[5, 'data-attr', 'Tabs']]);
    assert.equal(f.dsComponents, 0);
  });

  test('aria-pressed toggles: a group (two, or one per item) is a SegmentedControl, a DS Button toggle is fine', () => {
    const group = `${DS}export const G = ({ v }) => (<div>
  <button aria-pressed={v === 'a'}>A</button>
  <button aria-pressed={v === 'b'}>B</button>
</div>);
export const T = ({ on }) => <Button aria-pressed={on}>Compare</Button>;\n`;
    assert.deepEqual(found('g.tsx', group), ['3:SegmentedControl', '4:SegmentedControl']);
    const mapped = `export const M = ({ xs }) => <div>{xs.map((x) => <button key={x} aria-pressed={false}>{x}</button>)}</div>;\n`;
    assert.deepEqual(found('m.tsx', mapped), ['1:SegmentedControl']);
    const one = `export const O = ({ on }) => <button aria-pressed={on}>Bold</button>;\n`;
    assert.deepEqual(found('o.tsx', one), ['1:Button']);
  });

  test('role="radiogroup", "dialog", "menu", "combobox" outside the DS component that renders them', () => {
    const page = `${DS}export const P = () => (<>
  <div role="radiogroup" />
  <aside role="dialog" aria-modal="true" />
  <div role="menu"><Button role="menuitemradio">A</Button></div>
  <Menu.Popup role="menu" />
  <Dialog.Popup role="dialog" />
</>);\n`;
    assert.deepEqual(found('p.tsx', page), ['3:SegmentedControl', '4:Dialog', '5:Menu', '5:Menu']);
  });

  test('a muted count span instead of the count Badge, a button class on a link, a typed separator', () => {
    const page = `${DS}export const P = ({ n }) => (<p>
  <span className="nav-count">{n}</span>
  <Badge className="tab-count">{n}</Badge>
  <a className="btn btn-primary" href="/x">Go</a>
  <Link href="/a">A</Link>{' · '}<Link href="/b">B</Link>
  <span aria-hidden="true">·</span>
</p>);\n`;
    assert.deepEqual(found('p.tsx', page), ['3:Badge', '5:Button', '6:Divider', '7:Divider']);
  });

  test('Astro markup: role, a count span, a separator between elements, a lone separator span', () => {
    const astro = `---\nconst xs = [1];\n---\n<div class="hp-tablist" role="tablist"></div>\n<span class="st-count">3</span>\n<a href="/a">A</a> · <a href="/b">B</a>\n<span class="dot">·</span>\n`;
    assert.deepEqual(found('p.astro', astro), ['4:Tabs', '5:Badge', '6:Divider', '7:Divider']);
  });

  test('markup built in a string: role, aria-pressed and tab or button classes', () => {
    const script = `export const html = (xs: string[], n: number) => \`<div class="xe-tabs"><div class="xe-tablist" role="tablist" style="--n:\${n}">\${xs
  .map((x) => \`<button type="button" role="tab" aria-selected="\${x === 'a'}">\${x}</button>\`).join('')}</div></div>\`;
export const link = '<a class="btn btn-secondary" href="/x">Open</a>';
export const sel = '[role="tab"]';
export const sep = '<a href="/a">A</a> · <a href="/b">B</a>';\n`;
    const f = auditFile('s.ts', script, ds());
    assert.deepEqual(f.imitations?.map((x) => `${x.line}:${x.rule}:${x.suggestion}`), ['1:html-string:Tabs', '1:html-string:Tabs', '2:html-string:Tabs', '3:html-string:Button', '5:separator:Divider']);
  });
});

describe('style sheets', () => {
  test('a rule that names a DS pattern and draws a border, background or radius; one finding per pattern and file', () => {
    const css = `.page-tabs { display: flex; border-bottom: var(--border-width-default) solid var(--color-border-default); }
.page-tabs a[aria-selected="true"] { border-bottom-color: var(--color-signal-default); }
.nav-count { color: var(--color-text-muted); }
.xp-chip { border-radius: var(--radius-pill); background-color: var(--color-surface-sunken); }
.rv-seg button[aria-pressed="true"] { background-color: var(--color-surface-raised); }
.ad-seg { background-color: var(--c); }
.sp-radius-shape.is-pill { border-radius: var(--radius-pill); }
.cl-tags { display: flex; }
@media (hover: hover) { .btn:hover { background-color: var(--color-action-primary-bg-hover); } }
@keyframes tab-in { from { background-color: transparent; } }
.plain { border: none; background: transparent; }\n`;
    const f = auditFile('s.css', css, ds());
    assert.deepEqual(f.imitations?.map((x) => `${x.line}:${x.suggestion}:${x.pattern.split(' ')[0]}`), ['1:Tabs:.page-tabs', '4:Tag:.xp-chip', '5:SegmentedControl:[aria-pressed]', '9:Button:.btn']);
  });

  test('a class set only on the DS component it names is an override, not an imitation', () => {
    const files = [
      { path: 'Nav.tsx', text: `${DS}export const N = ({ n }) => <Badge className="tab-count">{n}</Badge>;\n` },
      { path: 'nav.css', text: `.tab-count { background-color: var(--color-surface-sunken); }\n.my-pill { border-radius: var(--radius-pill); }\n` },
      { path: 'Pill.tsx', text: `export const P = () => <span className="my-pill">new</span>;\n` },
    ];
    const r = buildAuditReport({ files, target: 'app' }, ds());
    assert.deepEqual(r.files.flatMap((f) => (f.imitations ?? []).map((x) => `${f.path}:${x.line}:${x.suggestion}`)), ['nav.css:2:Badge']);
  });
});

describe('the DS components themselves', () => {
  test('no imitation in the DS component sources and DOM renderers', () => {
    const root = join(REPO, 'packages/react/src');
    const files: { path: string; text: string }[] = [];
    const walk = (d: string) => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else {
          const rel = `react/src/${relative(root, p).split('\\').join('/')}`;
          if (isAuditable(rel)) files.push({ path: rel, text: readFileSync(p, 'utf8') });
        }
      }
    };
    walk(root);
    assert.ok(files.length > 50);
    const r = buildAuditReport({ files, target: 'packages' }, ds());
    assert.deepEqual(r.files.flatMap((f) => (f.imitations ?? []).map((x) => `${f.path}:${x.line} ${x.pattern}`)), []);
    assert.equal(r.metrics.imitations, 0);
  });
});

describe('report', () => {
  test('imitations count next to component adoption, top fixes, ignore comments with a reason, baseline delta', () => {
    const r = runAudit(join(FIX, 'imitations-app'), { ds: REPO, displayPath: 'imitations-app' });
    assert.equal(r.metrics.imitations, r.imitations!.total);
    assert.ok(r.metrics.imitations! >= 4, String(r.metrics.imitations));
    assert.equal(r.metrics.componentAdoption, 100, 'the Link dressed as a tab is not adoption, and not a miss either');
    assert.ok(r.imitations!.byComponent.Tabs! >= 2);
    assert.ok(r.imitations!.topFixes.some((f) => f.suggestion === 'Tabs'));
    // The ignore comment with a reason keeps its line out; the one without a reason ignores nothing.
    const page = r.files.find((f) => f.path === 'src/Page.tsx')!;
    assert.ok(r.ignored!.items.some((x) => x.kind === 'imitation' && x.file === 'src/Page.tsx' && /vertical step tabs/.test(x.reason)));
    assert.ok(page.ignoreErrors!.some((e) => /needs a reason/.test(e.message)));
    assert.ok(page.imitations!.some((x) => x.pattern === 'role="tabpanel"'));
    const md = auditMarkdown(r);
    assert.match(md, /\| Component imitations \(not adoption\) \| \*\*\d+\*\* \|/);
    assert.match(md, /### Component imitations/);
    assert.match(md, /`src\/Page.tsx:\d+` \| role="tab" on `Link` \| Tabs/);
    // A baseline written before imitation detection: no delta; a newer one: the delta.
    const old = { ...r, metrics: { ...r.metrics } };
    delete old.metrics.imitations;
    assert.deepEqual(compareWithBaseline(r, old).baseline!.imitations, { before: null, after: r.metrics.imitations, delta: null });
    const fewer = { ...r, metrics: { ...r.metrics, imitations: r.metrics.imitations! - 1 } };
    assert.equal(compareWithBaseline(r, fewer).baseline!.imitations!.delta, 1);
  });

  test('the allowlist covers imitations by element or pattern', () => {
    const r = runAudit(join(FIX, 'imitations-app'), { ds: REPO, displayPath: 'imitations-app', allowlist: [{ file: 'src/styles.css', line: 1, what: '.page-tabs', reason: 'kept until the sweep' }] });
    assert.ok(r.ignored!.items.some((x) => x.kind === 'imitation' && x.via === 'allowlist'));
    assert.equal(r.ignored!.staleAllowlist.length, 0);
  });
});
