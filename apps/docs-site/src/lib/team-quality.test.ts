import { studioHref } from './team-path';
import { describe, expect, it } from 'vitest';
import { loadRepoModel, memorySource, type ProductConfig, type SnapshotAudit } from '@bridge-ds/core';
import { repoModel } from './model';
import { dashboard } from './stats';
import { auditAskMessage, auditStep, guidanceLead, pctLabel, teamQuality } from './team-quality';
import { HOSTED_DOCS_URL } from './team-load';

const SHA = 'b'.repeat(40);
const team = { owner: 'acme', repo: 'ds', sha: SHA };

/** Every link a team page would show. */
const hrefs = (q: ReturnType<typeof teamQuality>) => [
  ...(q.verdict.action ? [q.verdict.action.href] : []),
  ...q.pillars.map((p) => p.next.href),
  q.unusedHref,
  ...q.figures.map((f) => f.href),
  ...[q.gate, ...q.tokenFindings, ...q.guidanceFindings].flatMap((f) => (f.action ? [f.action.href] : [])),
  ...q.cleanup.map((i) => i.href),
  ...q.guidance.rows.map((r) => r.href),
  ...(q.adoption ? [...q.adoption.products.map((p) => p.latest), ...q.adoption.earlier] : []).map((r) => r.href),
];

describe('teamQuality on this repository (parity with the build-time dashboard)', () => {
  const q = teamQuality({ model: repoModel, ...team, audits: null });
  const s = dashboard();

  it('counts the same contrast checks, per brand and theme', () => {
    expect(q.hasChecks).toBe(true);
    expect(q.contrast.total).toBe(s.contrast.total);
    expect(q.contrast.fail).toBe(s.contrast.fail);
    expect(q.contrast.combos.map((c) => [c.pass, c.total])).toEqual(s.contrast.byCombo.map((c) => [c.pass, c.total]));
    expect(q.failRows).toHaveLength(s.contrast.failing.length);
  });

  it('finds the same guidance state and deprecated tokens', () => {
    expect(q.guidance.total).toBe(s.components);
    expect(q.guidance.total - q.guidance.missing).toBe(s.documented);
    const deprecated = s.issues.filter((i) => i.kind === 'deprecated').length;
    expect(q.tokenFindings.filter((f) => f.title.endsWith('is deprecated'))).toHaveLength(deprecated);
  });

  it('links only to the team: Studio pages and GitHub, never the demo Library', () => {
    for (const h of hrefs(q)) expect(h).toMatch(/^(\/studio\/|#|https:\/\/github\.com\/acme\/ds\/)/);
    expect(q.gate.action?.href).toBe(`https://github.com/acme/ds/blob/${SHA}/${repoModel.contrast.path}`);
  });

  it('counts the same unused tokens, global stylesheets included', () => {
    expect(q.unusedTotal).toBe(s.unusedSemantic.length + s.orphanPrimitives.length);
    // By kind, each against the total the page and Studio Tokens count (the self-hosted page's numbers).
    expect(q.unused).toEqual({ tokens: { total: s.semantic, unused: s.unusedSemantic.length }, primitives: { total: s.primitives, unused: s.orphanPrimitives.length } });
    // Without the global stylesheets (a model cached before they were read), base.css readers would look unused.
    const { styles: _styles, ...older } = repoModel;
    const without = teamQuality({ model: older as typeof repoModel, ...team, audits: null });
    expect(without.unusedTotal).toBeGreaterThan(q.unusedTotal);
  });

  it('says there is no audit instead of a number, without a snapshot', () => {
    expect(q.adoption).toBeNull();
    expect(q.figures.map((f) => f.id)).toEqual(['contrast', 'adoption', 'guidance']);
    expect(q.figures[1]!.value).toBe('Not measured yet');
  });
});

describe('teamQuality on a repository Bridge cannot read much from', () => {
  it('no checks file is not a pass, no components is said plainly', async () => {
    const model = await loadRepoModel(memorySource({ 'README.md': '# hi' }, { owner: 'acme', repo: 'ds', sha: SHA }));
    const q = teamQuality({ model, ...team, audits: null });
    expect(q.hasChecks).toBe(false);
    expect(q.gate.title).toBe('No contrast checks yet');
    expect(q.gate.action?.href).toBe(HOSTED_DOCS_URL);
    expect(q.figures[0]!.value).toBe('No checks yet');
    expect(q.figures[0]!.tone).toBeNull();
    expect(q.figures.find((f) => f.id === 'guidance')?.value).toBe('No components');
    expect(q.sentence).not.toMatch(/All 0/);
    expect(q.cleanup).toEqual([]);
    expect(guidanceLead(q.guidance)).toBe('Bridge found no components in this repository.');
    for (const h of hrefs(q)) expect(h).toMatch(/^(\/studio\/|#|https:\/\/github\.com\/)/);
  });
});

describe('teamQuality for a designer (anyone but a tech owner)', () => {
  it('says a developer turns things on, never a config file, a workflow or what Bridge could not parse', async () => {
    const model = await loadRepoModel(memorySource({ 'README.md': '# hi', 'bridge.config.json': '{ not json' }, { owner: 'acme', repo: 'ds', sha: SHA }));
    const dev = teamQuality({ model, ...team, audits: null });
    const q = teamQuality({ model, ...team, audits: null, audience: 'designer' });
    expect(dev.problems.length).toBeGreaterThan(0);
    expect(q.problems).toEqual([]);
    expect(q.gate.action).toBeUndefined();
    expect(q.verdict.action).toBeNull();
    const words = [q.gate.detail, ...q.figures.map((f) => f.detail)].join(' ');
    expect(words).not.toMatch(/bridge\.config|snapshot|workflow|contrast\.path|components\.dir/i);
    expect(q.gate.detail).toMatch(/A developer of your team turns them on/);
    expect(q.figures.find((f) => f.id === 'adoption')?.detail).toBe('A developer of your team turns it on.');
  });
});

describe('teamQuality contrast link', () => {
  it('links the checks on GitHub only for a viewer with GitHub', () => {
    const gh = teamQuality({ model: repoModel, ...team, audits: null });
    const email = teamQuality({ model: repoModel, ...team, audits: null, github: false });
    expect(gh.gate.action?.label).toBe('Open on GitHub');
    expect(email.gate.action).toBeUndefined();
    expect(JSON.stringify(email.gate)).not.toMatch(/GitHub/);
  });
});

describe('adoption from the snapshot audits', () => {
  const audit = (id: string, ds: number, ui: number, label?: string): SnapshotAudit => ({
    id,
    path: `audits/${id}.json`,
    ...(label ? { label } : {}),
    generatedAt: '2026-10-20T10:00:00Z',
    target: { path: `apps/${id}/src`, files: 10 },
    metrics: { tokenAdoption: 91.24, componentAdoption: ui ? (ds / ui) * 100 : null, tokenUsages: 10, hardcoded: 1, themeRefs: 0, dsComponentInstances: ds, uiComponentInstances: ui },
  });

  // A team whose config lists its products: one in a folder of the repository, one in its own, the library last.
  const withProducts = (products: ProductConfig[]) => ({ ...repoModel, config: { ...repoModel.config, products } });
  const folders = withProducts([
    { key: 'web', name: 'Web app', path: 'apps/web' },
    { key: 'admin', name: 'Admin', path: 'apps/admin' },
    { key: 'site', name: 'Bridge docs site', path: 'apps/docs-site' },
    { key: 'library', name: 'Library', path: 'packages', default: true },
  ]);

  it('one row per listed product, named as the config names it, the report inside Bridge, the combined figure', () => {
    const q = teamQuality({ model: withProducts(folders.config.products.filter((p) => p.key !== 'site')), ...team, audits: [audit('web', 30, 40, 'Web app, main'), audit('admin', 10, 10)] });
    expect(q.adoption!.products.map((p) => [p.name, p.latest.component, p.latest.href])).toEqual([
      ['Admin', 100, studioHref('quality/report/?product=admin')],
      ['Web app', 75, studioHref('quality/report/?product=web')],
    ]);
    expect(q.adoption!.earlier).toEqual([]);
    expect(q.unmeasured).toEqual([]);
    expect(q.figures[1]!.value).toBe('80%');
    expect(q.pillars[1]).toMatchObject({ name: 'Adoption', value: '80%', meter: 80 });
    expect(pctLabel(91.24)).toBe('91.2%');
    expect(pctLabel(null)).toBe('n/a');
  });

  it("carries the run's biggest gain to the row when the snapshot has it", () => {
    const web = { ...audit('web', 30, 40, 'Web app, main'), topGain: { component: 'Button', gain: 90 } };
    const q = teamQuality({ model: withProducts(folders.config.products.filter((p) => p.key !== 'site')), ...team, audits: [web, audit('admin', 10, 10)] });
    expect(q.adoption!.products.map((p) => p.latest.topGain ?? null)).toEqual([null, { component: 'Button', gain: 90 }]);
  });

  it('the runs of this snapshot lead; earlier runs of a listed product wait under earlier runs, other apps are dropped', () => {
    const run = (id: string, path: string, at: string, ds: number, ui: number, label: string): SnapshotAudit => ({
      ...audit(id, ds, ui, label),
      generatedAt: at,
      target: { path, files: 10 },
    });
    // This repository's own snapshot: a migration's before and after carried as files, then the workflow's own runs.
    const audits = [
      run('admin-after', 'apps/admin/src', '2026-10-16T17:25:17Z', 239, 265, 'Bridge admin, after migration'),
      run('admin-before', 'apps/admin/_original', '2026-10-16T17:25:13Z', 0, 526, 'react-admin demo, original MUI source'),
      run('site-after', 'apps/docs-site/src', '2026-10-19T13:13:18Z', 895, 895, 'Bridge docs site, after'),
      run('site-before', 'apps/docs-site/src', '2026-10-16T22:47:20Z', 47, 89, 'Bridge docs site, before'),
      run('admin-main', 'apps/admin/src', '2026-10-31T14:08:08Z', 239, 262, 'Bridge admin, main'),
      run('site-main', 'apps/docs-site/src', '2026-10-31T14:08:09Z', 1818, 1818, 'Bridge docs site, main'),
    ];
    const q = teamQuality({ model: folders, ...team, audits, snapshotAt: '2026-10-31T14:08:10Z' });
    expect(q.adoption!.products.map((p) => [p.name, p.latest.id, p.previous?.id, p.runs])).toEqual([
      ['Admin', 'admin-main', 'admin-after', 3],
      ['Bridge docs site', 'site-main', 'site-after', 3],
    ]);
    // The original MUI source (apps/admin/_original) belongs to the Admin folder, so it stays its earlier run.
    expect(q.adoption!.earlier.map((r) => r.id)).toEqual(['site-after', 'site-before', 'admin-after', 'admin-before']);
    expect(q.unmeasured.map((p) => p.name)).toEqual(['Web app']);
    expect(q.figures[1]!.value).toBe('98.9%');
  });

  it('an empty audit list counts as no audit', () => {
    expect(teamQuality({ model: repoModel, ...team, audits: [] }).adoption).toBeNull();
  });

  // The sample team: Account app was audited, then removed from bridge.config.json; Acme Prints and Acme CRM live in
  // their own repositories and have no audit yet.
  const sample = withProducts([
    { key: 'library', name: 'Library', path: 'packages', framework: 'react', default: true },
    { key: 'prints', name: 'Acme Prints', repo: 'acme-design-demo/acme-prints', framework: 'react' },
    { key: 'crm', name: 'Acme CRM', repo: 'acme-design-demo/acme-crm', framework: 'react' },
  ]);
  const account: SnapshotAudit = { ...audit('account-app', 38, 38, 'Account app'), target: { path: 'apps/account/src', files: 6 } };

  it('a product removed from the config does not linger: its audit is dropped, the listed products are not measured yet', () => {
    const q = teamQuality({ model: sample, ...team, audits: [account], snapshotAt: '2026-10-20T10:00:01Z' });
    expect(q.adoption).toBeNull();
    expect(q.unmeasured).toEqual([
      { key: 'prints', name: 'Acme Prints', repo: 'acme-design-demo/acme-prints' },
      { key: 'crm', name: 'Acme CRM', repo: 'acme-design-demo/acme-crm' },
    ]);
    const fig = q.figures.find((f) => f.id === 'adoption')!;
    expect(fig.value).toBe('Not measured yet');
    expect(fig.detail).toBe('Turn it on for Acme Prints and Acme CRM.');
    expect(q.pillars[1]).toMatchObject({ value: 'Not measured yet', meter: null, viz: null });
    expect(JSON.stringify(q)).not.toContain('Account app');
  });

  it('a config that lists no products keeps every run, grouped by folder, and names nothing to measure', async () => {
    const model = await loadRepoModel(memorySource({ 'README.md': '# hi' }, { owner: 'acme', repo: 'ds', sha: SHA }));
    const q = teamQuality({ model, ...team, audits: [audit('web', 30, 40, 'Web app, main')] });
    expect(q.adoption!.products.map((p) => p.name)).toEqual(['Web app']);
    expect(q.unmeasured).toEqual([]);
  });

  it('a removed product key recorded by bridge snapshot is dropped too; a listed one is matched by its key or its label', () => {
    const q = teamQuality({
      model: sample,
      ...team,
      audits: [
        { ...account, product: 'account' },
        { ...audit('prints', 45, 60, 'Acme Prints, main'), target: { path: 'products/prints/src', files: 20 } },
        { ...audit('crm', 9, 10), product: 'crm', target: { path: 'products/crm/src', files: 8 } },
      ],
    });
    expect(q.adoption!.products.map((p) => [p.name, p.latest.component])).toEqual([
      ['Acme CRM', 90],
      ['Acme Prints', 75],
    ]);
    expect(q.adoption!.earlier).toEqual([]);
    expect(q.unmeasured).toEqual([]);
  });

  it('says how to measure each product: a checkout for its own repository, its folder otherwise', () => {
    expect(auditStep({ key: 'prints', name: 'Acme Prints', repo: 'acme-design-demo/acme-prints' })).toEqual({ checkout: 'acme-design-demo/acme-prints', flag: '--audit "products/prints=Acme Prints"' });
    expect(auditStep({ key: 'web', name: 'Web app', path: 'apps/web' })).toEqual({ checkout: null, flag: '--audit "apps/web=Web app"' });
    const msg = auditAskMessage('acme-design-demo/bridge-demo-ds', [{ key: 'prints', name: 'Acme Prints', repo: 'acme-design-demo/acme-prints' }, { key: 'web', name: 'Web app', path: 'apps/web' }], 'T', 'D');
    expect(msg).toBe(
      'Could you turn on the adoption audit in Bridge for Acme Prints and Web app for acme-design-demo/bridge-demo-ds? Copy the Bridge data workflow (T) into .github/workflows/, then in its bridge snapshot step check out acme-design-demo/acme-prints into products/prints and add --audit "products/prints=Acme Prints"; add --audit "apps/web=Web app". How it works: D',
    );
    expect(msg).not.toContain('\u2014');
  });
});
