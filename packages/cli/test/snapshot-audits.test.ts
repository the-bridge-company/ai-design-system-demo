// bridge snapshot --audit / --audit-report: each audit names the bridge.config.json product it measured, so Studio's
// "Used in" lists the team's products, never other apps of the repository or the library itself.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RepoSnapshot } from '@bridge-ds/core';
import type { AuditReport } from '@bridge-ds/core/audit';
import { writeSnapshot } from '../src/snapshot.js';
import { REPO } from '../../mcp/test/helpers.js';

const CLEAN_APP = join(REPO, 'packages/core/test/fixtures/audit/clean-app');

describe('bridge snapshot audits name their product', () => {
  it('a product checkout next to the repo is named by its git origin; other folders name none', async () => {
    // This repository's config: Art print shop (key admin-app) lives in the-bridge-company/art-print-shop.
    const shop = mkdtempSync(join(tmpdir(), 'bridge-test-shop-'));
    cpSync(CLEAN_APP, shop, { recursive: true });
    execFileSync('git', ['init', '-q'], { cwd: shop });
    execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/the-bridge-company/art-print-shop.git'], { cwd: shop });
    // A carried report of an app of this repository that is no listed product (the admin demo).
    const reports = mkdtempSync(join(tmpdir(), 'bridge-test-reports-'));
    const report = JSON.parse(readFileSync(join(REPO, 'apps/docs-site/src/data/audits/admin-after.json'), 'utf8')) as Record<string, unknown>;
    writeFileSync(join(reports, 'admin-after.json'), JSON.stringify(report));

    const out = mkdtempSync(join(tmpdir(), 'bridge-test-snapshot-'));
    await writeSnapshot({ root: REPO, out, version: '9.9.9', generatedAt: '2026-11-03T10:00:00.000Z', auditReports: [reports], audit: [`${shop}=Art print shop, main`, 'packages/core/test/fixtures/audit/clean-app=Library fixture'] });
    const snap = JSON.parse(readFileSync(join(out, 'snapshot.json'), 'utf8')) as RepoSnapshot;
    const byId = Object.fromEntries(snap.audits.map((a) => [a.id, a.product ?? null]));
    expect(byId).toEqual({ 'admin-after': null, 'art-print-shop-main': 'admin-app', 'library-fixture': null });
  });

  it("a product's report lists its screens and the files that make each one (its screens map in bridge.config.json)", async () => {
    // This repository's config maps Art print shop's screens: "/#/orders" is resources/orders/**.
    const shop = mkdtempSync(join(tmpdir(), 'bridge-test-shop-'));
    cpSync(join(REPO, 'packages/core/test/fixtures/audit/tailwind-app'), shop, { recursive: true });
    mkdirSync(join(shop, 'resources/orders'), { recursive: true });
    writeFileSync(join(shop, 'resources/orders/OrderList.tsx'), 'export const OrderList = () => <button className="p-[13px]">Ship</button>;\n');
    execFileSync('git', ['init', '-q'], { cwd: shop });
    execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/the-bridge-company/art-print-shop.git'], { cwd: shop });
    const out = mkdtempSync(join(tmpdir(), 'bridge-test-snapshot-'));
    await writeSnapshot({ root: REPO, out, version: '9.9.9', audit: [`${shop}=Art print shop`], previous: async () => null });
    const report = JSON.parse(readFileSync(join(out, 'audits/art-print-shop.json'), 'utf8')) as AuditReport;
    // The map wins over the file routes (app/page.tsx is no screen here); screens without files are left out.
    expect(report.screens).toEqual([{ route: '/#/orders', name: 'Orders', files: ['resources/orders/OrderList.tsx'] }]);
  });

  it('a product checkout inside the repo (actions/checkout path:) is named by its own git origin', async () => {
    // Under node_modules (ignored by git): a nested repository, as the bridge-data workflow checks the product out.
    const cache = join(REPO, 'node_modules/.cache');
    mkdirSync(cache, { recursive: true });
    const shop = mkdtempSync(join(cache, 'bridge-test-nested-shop-'));
    try {
      cpSync(CLEAN_APP, shop, { recursive: true });
      execFileSync('git', ['init', '-q'], { cwd: shop });
      execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/the-bridge-company/art-print-shop'], { cwd: shop });
      const out = mkdtempSync(join(tmpdir(), 'bridge-test-snapshot-'));
      await writeSnapshot({ root: REPO, out, version: '9.9.9', generatedAt: '2026-11-03T10:00:00.000Z', audit: [`${relative(REPO, shop)}=Art print shop, main`] });
      const snap = JSON.parse(readFileSync(join(out, 'snapshot.json'), 'utf8')) as RepoSnapshot;
      expect(snap.audits.map((a) => a.product ?? null)).toEqual(['admin-app']);
    } finally {
      rmSync(shop, { recursive: true, force: true });
    }
  });
});

describe('bridge snapshot keeps the trend, where the code is, and the decisions taken in Studio', () => {
  it('records the repository, commit and folder, carries the history and honours audit-ignores.json', async () => {
    const shop = mkdtempSync(join(tmpdir(), 'bridge-test-shop-'));
    cpSync(join(REPO, 'packages/core/test/fixtures/audit/mui-app'), shop, { recursive: true });
    const run = (args: string[]) => execFileSync('git', args, { cwd: shop, stdio: 'ignore' });
    run(['init', '-q']);
    run(['remote', 'add', 'origin', 'https://github.com/the-bridge-company/art-print-shop.git']);
    run(['add', '-A']);
    run(['-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'init']);
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: shop, encoding: 'utf8' }).trim();
    try {
      // A first run with nothing published before: no history yet.
      const out1 = mkdtempSync(join(tmpdir(), 'bridge-test-snapshot-'));
      await writeSnapshot({ root: REPO, out: out1, version: '9.9.9', audit: [`${join(shop, 'src')}=Art print shop`], previous: async () => null });
      const first = JSON.parse(readFileSync(join(out1, 'audits/art-print-shop.json'), 'utf8')) as AuditReport;
      expect(first.target).toMatchObject({ repo: 'the-bridge-company/art-print-shop', ref: head, root: 'src' });
      expect(first.history).toEqual([]);
      const place = first.files.find((f) => f.findings.length)!;
      const finding = place.findings[0]!;

      // The next run of another commit reads what was published: the first run becomes a point, and the decision taken
      // in Studio leaves its place out of the counts, with its reason, and is published again.
      const ignores = { version: 1, ignores: [{ product: 'admin-app', group: 'value:color:none', reason: 'Brand color of the print shop', by: 'dana', at: '2026-11-11', places: [{ file: place.path, line: finding.line, what: finding.value }] }] };
      const earlier = { ...first, target: { ...first.target, ref: '0000000000000000000000000000000000000000' }, metrics: { ...first.metrics, hardcoded: first.metrics.hardcoded + 3 } };
      const published: Record<string, string> = { 'audit-ignores.json': JSON.stringify(ignores), 'audits/art-print-shop.json': JSON.stringify(earlier) };
      const out2 = mkdtempSync(join(tmpdir(), 'bridge-test-snapshot-'));
      const r = await writeSnapshot({ root: REPO, out: out2, version: '9.9.9', audit: [`${join(shop, 'src')}=Art print shop`], previous: async (p) => published[p] ?? null });
      const second = JSON.parse(readFileSync(join(out2, 'audits/art-print-shop.json'), 'utf8')) as AuditReport;
      expect(second.history.map((h) => h.ref)).toEqual(['0000000000000000000000000000000000000000']);
      expect(second.baseline?.hardcoded.before).toBe(first.metrics.hardcoded + 3);
      expect(second.metrics.hardcoded).toBe(first.metrics.hardcoded - 1);
      expect(second.ignored?.items).toEqual([expect.objectContaining({ file: place.path, line: finding.line, what: finding.value, reason: 'Not a problem (dana in Bridge): Brand color of the print shop', via: 'allowlist' })]);
      expect(r.written).toContain('audit-ignores.json');
      expect(JSON.parse(readFileSync(join(out2, 'audit-ignores.json'), 'utf8'))).toEqual(ignores);
    } finally {
      rmSync(shop, { recursive: true, force: true });
    }
  });
});
