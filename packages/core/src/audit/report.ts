// Turns scanned files into the versioned audit report, compares it with a baseline, renders Markdown,
// and plans the safe CSS autofix (exact token matches only).
import { scanCode } from './code';
import { lineCol, scanCssText } from './css';
import type { DesignSystemIndex } from './ds-index';
import { applyAllowlist, applyIgnoreComments, ignoreDirectives } from './ignore';
import { cssImitations, imitationRules, isDsComponentSource, isDsOverride, type ClassUses, type CssImitation } from './imitations';
import { MARKUP_EXTENSIONS, scanMarkup } from './markup';
import type { ValueHit } from './scan-value';
import { auditCssText, isSafeFix } from './style';
import {
  AUDIT_SCHEMA_VERSION,
  FINDING_CATEGORIES,
  type AuditReport,
  type BaselineDiff,
  type CategoryCount,
  type FileReport,
  type AllowlistEntry,
  type FindingCategory,
  type HistoryPoint,
  type IgnoredItem,
  type ImitationFinding,
  type ImitationFix,
  type TopFix,
} from './types';

export const AUDIT_EXTENSIONS = ['.css', '.scss', '.sass', '.less', '.tsx', '.jsx', '.ts', '.js', '.mjs', '.cjs', '.mts', '.cts', ...MARKUP_EXTENSIONS];
export const AUDIT_IGNORE_DIRS = ['node_modules', 'dist', 'build', 'out', 'coverage', '.git', '.next', '.nuxt', '.astro', '.turbo', '.cache', '.vercel', 'storybook-static', 'vendor', 'public'];
const IGNORE_FILE = /\.d\.[cm]?ts$|\.(test|spec|stories|story)\.[cm]?[jt]sx?$|\.min\.(css|js)$|(^|\/)(vite|vitest|jest|webpack|rollup|eslint|postcss|tailwind|babel|next|astro|prettier|stylelint|tsup)\.config\.[cm]?[jt]s$/;

/** Should the audit read this repo-relative path? */
export function isAuditable(path: string): boolean {
  if (!AUDIT_EXTENSIONS.some((e) => path.endsWith(e))) return false;
  if (IGNORE_FILE.test(path)) return false;
  return !path.split('/').some((seg) => AUDIT_IGNORE_DIRS.includes(seg));
}

const langOf = (path: string): FileReport['lang'] => {
  const ext = path.slice(path.lastIndexOf('.') + 1);
  if (ext === 'css') return 'css';
  if (ext === 'scss' || ext === 'sass') return 'scss';
  if (ext === 'less') return 'less';
  if (ext === 'tsx') return 'tsx';
  if (ext === 'jsx') return 'jsx';
  if (/^[cm]?ts$/.test(ext)) return 'ts';
  if (ext === 'astro' || ext === 'vue' || ext === 'svelte') return ext;
  return 'js';
};

export type AuditedFile = FileReport & { definitions: { name: string; line: number }[]; dsByName: Record<string, number>; classUses: { cls: string; ds?: string }[] };

/** Audit one file. `bridge-audit-ignore-next-line: reason` comments leave the next line's findings out of the counts. */
export function auditFile(path: string, text: string, ds: DesignSystemIndex): AuditedFile {
  const lang = langOf(path);
  if (lang === 'css' || lang === 'scss' || lang === 'less') {
    const pos = lineCol(text);
    const r = auditCssText(text, lang, ds, { pos });
    const imitations = isDsComponentSource(path, ds.components) ? [] : cssImitations(text, lang, imitationRules(ds.components), pos);
    return withIgnores(text, { path, lang, tokenUsages: r.tokenUsages, themeRefs: r.themeRefs, hardcoded: 0, dsComponents: 0, otherComponents: 0, findings: r.findings, components: [], imitations, definitions: [], dsByName: {}, classUses: [] });
  }
  const c = lang === 'astro' || lang === 'vue' || lang === 'svelte' ? scanMarkup(path, text, lang, ds) : scanCode(path, text, ds);
  const dsCount = Object.values(c.ds).reduce((a, b) => a + b, 0);
  return withIgnores(text, { path, lang, tokenUsages: c.tokenUsages, themeRefs: c.themeRefs, hardcoded: 0, dsComponents: dsCount, otherComponents: 0, findings: c.findings, components: c.components, imitations: c.imitations, definitions: c.definitions, dsByName: c.ds, classUses: c.classUses });
}

function withIgnores(text: string, f: AuditedFile): AuditedFile {
  const r = applyIgnoreComments(text, f.findings, f.components, f.imitations ?? []);
  const { imitations: _i, ...rest } = f;
  return {
    ...rest,
    findings: r.findings,
    components: r.components,
    ...(r.imitations.length ? { imitations: r.imitations } : {}),
    hardcoded: r.findings.length,
    otherComponents: r.components.length,
    ...(r.ignored.length ? { ignored: r.ignored } : {}),
    ...(r.errors.length ? { ignoreErrors: r.errors } : {}),
  };
}

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);

export interface AuditInput {
  files: { path: string; text: string }[];
  skipped?: number;
  target: string;
  label?: string;
  version?: string;
  generatedAt?: string;
  /** Known violations left out of the counts, each with a reason (an allowlist file, see parseAllowlist). */
  allowlist?: AllowlistEntry[];
}

/** Build the report for a set of files. */
export function buildAuditReport(input: AuditInput, ds: DesignSystemIndex): AuditReport {
  const allow = input.allowlist ?? [];
  const usedAllow = new Set<number>();
  const audited = input.files.map((f) => auditFile(f.path, f.text, ds));
  // A style sheet rule on a class only ever set on the DS component it names (`<Badge className="tab-count">`) styles
  // that component: an override, not an imitation.
  const uses: ClassUses = new Map();
  for (const r of audited) {
    for (const u of r.classUses) {
      const x = uses.get(u.cls) ?? { ds: new Set<string>(), other: 0 };
      if (u.ds) x.ds.add(u.ds);
      else x.other++;
      uses.set(u.cls, x);
    }
  }
  const reports = audited.map((r0): AuditedFile => {
    const { imitations: found, ...base } = r0;
    const kept = (found ?? []).filter((x) => !isDsOverride(x as CssImitation, uses, ds.components)).map(({ classes: _c, candidates: _k, ...x }: CssImitation): ImitationFinding => x);
    const r: AuditedFile = { ...base, ...(kept.length ? { imitations: kept } : {}) };
    const idx = allow.flatMap((e, i) => (e.file === r.path ? [i] : []));
    if (!idx.length) return r;
    const a = applyAllowlist(idx.map((i) => allow[i]!), r.findings, r.components, kept);
    a.used.forEach((k) => usedAllow.add(idx[k]!));
    if (!a.ignored.length) return r;
    const ignored = [...(r.ignored ?? []), ...a.ignored].sort((x, y) => x.line - y.line || x.column - y.column);
    return { ...base, findings: a.findings, components: a.components, ...(a.imitations.length ? { imitations: a.imitations } : {}), hardcoded: a.findings.length, otherComponents: a.components.length, ignored };
  });
  const ignoredItems = reports.flatMap((r) => (r.ignored ?? []).map((x): IgnoredItem & { file: string } => ({ file: r.path, ...x })));
  const staleAllowlist = allow.filter((_e, i) => !usedAllow.has(i));
  const files: FileReport[] = reports.map(({ definitions: _d, dsByName: _n, classUses: _u, ...r }) => r);
  const imitationFixes = new Map<string, ImitationFix & { fileSet: Set<string> }>();
  const imitationsBy: Record<string, number> = {};
  let imitationCount = 0;
  for (const r of reports) {
    for (const x of r.imitations ?? []) {
      imitationCount++;
      imitationsBy[x.suggestion] = (imitationsBy[x.suggestion] ?? 0) + 1;
      const kind = imitationKind(x);
      const key = `${x.suggestion}|${kind}`;
      const fx = imitationFixes.get(key) ?? { suggestion: x.suggestion, pattern: kind, count: 0, files: 0, fileSet: new Set<string>() };
      fx.count++;
      fx.fileSet.add(r.path);
      imitationFixes.set(key, fx);
    }
  }
  const byCategory: Partial<Record<FindingCategory, CategoryCount>> = {};
  const fixes = new Map<string, TopFix & { fileSet: Set<string> }>();
  const components: AuditReport['components'] = { ds: {}, foreign: {}, native: {}, recreated: [] };
  let tokenUsages = 0;
  let hardcoded = 0;
  let themeRefs = 0;
  let dsInstances = 0;
  let uiInstances = 0;

  for (const r of reports) {
    tokenUsages += r.tokenUsages;
    hardcoded += r.hardcoded;
    themeRefs += r.themeRefs;
    dsInstances += r.dsComponents;
    uiInstances += r.dsComponents + r.otherComponents;
    for (const [n, k] of Object.entries(r.dsByName)) components.ds[n] = (components.ds[n] ?? 0) + k;
    for (const f of r.findings) {
      const c = (byCategory[f.category] ??= { hardcoded: 0, exact: 0, suggested: 0 });
      c.hardcoded++;
      if (f.suggestion) c.suggested++;
      if (f.suggestion?.level === 'exact') c.exact++;
      const key = `${f.category}|${f.value.toLowerCase()}|${f.suggestion?.token ?? ''}`;
      const fx = fixes.get(key) ?? { category: f.category, value: f.value, count: 0, files: 0, fileSet: new Set<string>(), ...(f.suggestion ? { suggestion: f.suggestion } : {}) };
      fx.count++;
      fx.fileSet.add(r.path);
      fixes.set(key, fx);
    }
    for (const comp of r.components) {
      if (comp.kind === 'native') components.native[comp.name] = (components.native[comp.name] ?? 0) + 1;
      else if (comp.kind === 'foreign') {
        const lib = (components.foreign[comp.library] ??= { instances: 0, components: {} });
        lib.instances++;
        lib.components[comp.name] = (lib.components[comp.name] ?? 0) + 1;
      }
    }
  }
  // Re-created DS components: local definitions named like a DS component (shadcn/ui files included).
  for (const r of reports) {
    for (const d of r.definitions) {
      if (!ds.components.has(d.name)) continue;
      const instances = reports.reduce((n, x) => n + x.components.filter((c) => (c.kind === 'recreated' || c.library === 'shadcn/ui (local)') && c.name.split('.')[0] === d.name).length, 0);
      components.recreated.push({ name: d.name, file: r.path, line: d.line, instances });
    }
  }
  const topFiles = files
    .filter((f) => f.hardcoded + f.otherComponents > 0)
    .sort((a, b) => b.hardcoded + b.otherComponents - (a.hardcoded + a.otherComponents) || a.path.localeCompare(b.path))
    .slice(0, 15)
    .map((f) => ({ path: f.path, hardcoded: f.hardcoded, otherComponents: f.otherComponents, tokenUsages: f.tokenUsages, dsComponents: f.dsComponents }));
  const topFixes = [...fixes.values()]
    .sort((a, b) => b.count - a.count || (b.suggestion?.confidence ?? 0) - (a.suggestion?.confidence ?? 0))
    .slice(0, 25)
    .map(({ fileSet, ...f }) => ({ ...f, files: fileSet.size }));
  return {
    $schema: 'https://raw.githubusercontent.com/the-bridge-company/ai-design-system-demo/main/packages/core/audit-report.schema.json',
    schemaVersion: AUDIT_SCHEMA_VERSION,
    tool: { name: 'bridge', version: input.version ?? '0.1.0' },
    ...(input.label ? { label: input.label } : {}),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    target: { path: input.target, files: files.length, skipped: input.skipped ?? 0 },
    designSystem: { packages: ds.packages, components: ds.components.size, tokens: ds.tokenCount, modes: ds.modes },
    metrics: { tokenAdoption: pct(tokenUsages, tokenUsages + hardcoded), componentAdoption: pct(dsInstances, uiInstances), tokenUsages, hardcoded, themeRefs, dsComponentInstances: dsInstances, uiComponentInstances: uiInstances, imitations: imitationCount },
    byCategory: Object.fromEntries(FINDING_CATEGORIES.filter((c) => byCategory[c]).map((c) => [c, byCategory[c]!])),
    components: { ...components, recreated: components.recreated.sort((a, b) => b.instances - a.instances || a.name.localeCompare(b.name)) },
    topFiles,
    topFixes,
    imitations: {
      total: imitationCount,
      byComponent: Object.fromEntries(Object.entries(imitationsBy).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
      topFixes: [...imitationFixes.values()]
        .sort((a, b) => b.count - a.count || a.suggestion.localeCompare(b.suggestion))
        .slice(0, 15)
        .map(({ fileSet, ...f }) => ({ ...f, files: fileSet.size })),
    },
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
    ...(ignoredItems.length || staleAllowlist.length
      ? {
          ignored: {
            total: ignoredItems.length,
            comment: ignoredItems.filter((x) => x.via === 'comment').length,
            allowlist: ignoredItems.filter((x) => x.via === 'allowlist').length,
            items: ignoredItems,
            staleAllowlist,
          },
        }
      : {}),
    history: [],
  };
}

/** The kind of an imitation, to group the fixes: `role="tab"`, `style sheet rules that draw it by hand`. */
export function imitationKind(x: ImitationFinding): string {
  switch (x.rule) {
    case 'role':
      return x.pattern;
    case 'html-string':
      return 'markup built in a string';
    case 'css':
      return 'style sheet rules that draw it by hand';
    case 'data-attr':
      return 'data attributes that wire it by hand';
    case 'toggle':
      return 'aria-pressed toggles';
    case 'class':
      return 'class names on plain elements';
    case 'separator':
      return 'typed separators';
  }
}

const delta = (a: number | null, b: number | null) => (a === null || b === null ? null : Math.round((b - a) * 10) / 10);

export function historyPoint(r: AuditReport): HistoryPoint {
  return {
    ...(r.label ? { label: r.label } : {}),
    generatedAt: r.generatedAt,
    ...(r.target.ref ? { ref: r.target.ref } : {}),
    tokenAdoption: r.metrics.tokenAdoption,
    componentAdoption: r.metrics.componentAdoption,
    hardcoded: r.metrics.hardcoded,
    uiComponentInstances: r.metrics.uiComponentInstances,
    dsComponentInstances: r.metrics.dsComponentInstances,
    ...(r.metrics.imitations !== undefined ? { imitations: r.metrics.imitations } : {}),
  };
}

/** Compare with an earlier report of the same codebase: progress, per category and per file. */
export function compareWithBaseline(report: AuditReport, baseline: AuditReport): AuditReport {
  if (baseline.schemaVersion === undefined) throw new Error('The baseline is not a bridge audit report (it has no schemaVersion). Pass a report written by bridge audit <path> --json <file>.');
  if (baseline.schemaVersion !== AUDIT_SCHEMA_VERSION) throw new Error(`baseline schemaVersion ${String(baseline.schemaVersion)} is not supported (expected ${AUDIT_SCHEMA_VERSION}). Write a new one with bridge audit <path> --json <file>.`);
  const before = new Map(baseline.files.map((f) => [f.path, f.hardcoded + f.otherComponents]));
  const after = new Map(report.files.map((f) => [f.path, f.hardcoded + f.otherComponents]));
  const byCategory: BaselineDiff['byCategory'] = {};
  for (const c of FINDING_CATEGORIES) {
    const b = baseline.byCategory[c]?.hardcoded ?? 0;
    const a = report.byCategory[c]?.hardcoded ?? 0;
    if (a || b) byCategory[c] = { before: b, after: a, delta: a - b };
  }
  const improved: BaselineDiff['improved'] = [];
  const regressed: BaselineDiff['regressed'] = [];
  for (const [path, a] of after) {
    const b = before.get(path);
    if (b === undefined) continue;
    if (a < b) improved.push({ path, before: b, after: a });
    else if (a > b) regressed.push({ path, before: b, after: a });
  }
  const diff: BaselineDiff = {
    ...(baseline.label ? { label: baseline.label } : {}),
    generatedAt: baseline.generatedAt,
    tokenAdoption: { before: baseline.metrics.tokenAdoption, after: report.metrics.tokenAdoption, delta: delta(baseline.metrics.tokenAdoption, report.metrics.tokenAdoption) },
    componentAdoption: { before: baseline.metrics.componentAdoption, after: report.metrics.componentAdoption, delta: delta(baseline.metrics.componentAdoption, report.metrics.componentAdoption) },
    hardcoded: { before: baseline.metrics.hardcoded, after: report.metrics.hardcoded, delta: report.metrics.hardcoded - baseline.metrics.hardcoded },
    ...(report.metrics.imitations !== undefined
      ? {
          imitations: {
            before: baseline.metrics.imitations ?? null,
            after: report.metrics.imitations,
            delta: baseline.metrics.imitations === undefined ? null : report.metrics.imitations - baseline.metrics.imitations,
          },
        }
      : {}),
    byCategory,
    improved: improved.sort((x, y) => y.before - y.after - (x.before - x.after)),
    regressed: regressed.sort((x, y) => y.after - y.before - (x.after - x.before)),
    newFiles: [...after.keys()].filter((p) => !before.has(p)).sort(),
    removedFiles: [...before.keys()].filter((p) => !after.has(p)).sort(),
  };
  return { ...report, baseline: diff, history: [...(baseline.history ?? []), historyPoint(baseline)] };
}

/** The most points a report carries: about a year of weekly changes. */
export const HISTORY_MAX = 60;

/**
 * The report with the trend of the code it measures, from the previous report of the same audit (the one published
 * last time). A new commit (or, without commits, new figures) adds the previous run as a point and compares with it;
 * the same commit measured again keeps the previous history and comparison, so a scheduled run every 30 minutes does
 * not add a point each time. Without a previous report, the report as it is.
 */
export function carryHistory(report: AuditReport, previous: AuditReport | null | undefined): AuditReport {
  if (!previous || previous.schemaVersion !== AUDIT_SCHEMA_VERSION || !previous.metrics) return report;
  const a = report.metrics;
  const b = previous.metrics;
  const sameFigures = a.tokenAdoption === b.tokenAdoption && a.componentAdoption === b.componentAdoption && a.hardcoded === b.hardcoded && a.uiComponentInstances === b.uiComponentInstances;
  const same = report.target.ref && previous.target.ref ? report.target.ref === previous.target.ref : sameFigures;
  if (same) return { ...report, history: (previous.history ?? []).slice(-HISTORY_MAX), ...(previous.baseline ? { baseline: previous.baseline } : {}) };
  const next = compareWithBaseline(report, previous);
  return { ...next, history: next.history.slice(-HISTORY_MAX) };
}

const fmtPct = (n: number | null) => (n === null ? 'n/a' : `${n}%`);
const fmtDelta = (n: number | null) => (n === null ? '' : ` (${n > 0 ? '+' : ''}${n} pts)`);
const esc = (s: string) => s.replace(/\|/g, '\\|').replace(/`/g, "'");

/** Short Markdown summary for a PR comment or a CI job summary. */
export function auditMarkdown(r: AuditReport, opts: { topFiles?: number; topFixes?: number; ignored?: number; imitations?: number } = {}): string {
  const m = r.metrics;
  const b = r.baseline;
  const lines = [
    `## Design system adoption${r.label ? `: ${r.label}` : ''}`,
    '',
    `Audited ${r.target.files} files in \`${r.target.path}\` against ${r.designSystem.tokens} tokens and ${r.designSystem.components} components (${r.designSystem.packages.join(', ') || 'no DS package configured'}).`,
    '',
    '| Metric | Value |',
    '| --- | --- |',
    `| Token adoption | **${fmtPct(m.tokenAdoption)}**${fmtDelta(b?.tokenAdoption.delta ?? null)} |`,
    `| Component adoption | **${fmtPct(m.componentAdoption)}**${fmtDelta(b?.componentAdoption.delta ?? null)} |`,
    ...(m.imitations !== undefined ? [`| Component imitations (not adoption) | **${m.imitations}**${b?.imitations?.delta != null ? ` (${b.imitations.delta > 0 ? '+' : ''}${b.imitations.delta})` : ''} |`] : []),
    `| Token references | ${m.tokenUsages} |`,
    `| Hardcoded values | ${m.hardcoded}${b ? ` (${b.hardcoded.delta > 0 ? '+' : ''}${b.hardcoded.delta})` : ''} |`,
    `| Other theme references | ${m.themeRefs} |`,
    `| DS component instances | ${m.dsComponentInstances} of ${m.uiComponentInstances} |`,
    '',
  ];
  const cats = FINDING_CATEGORIES.filter((c) => r.byCategory[c]);
  if (cats.length) {
    lines.push('### Hardcoded values by category', '', '| Category | Hardcoded | Exact token | Suggested |', '| --- | ---: | ---: | ---: |');
    for (const c of cats) {
      const x = r.byCategory[c]!;
      lines.push(`| ${c} | ${x.hardcoded} | ${x.exact} | ${x.suggested} |`);
    }
    lines.push('');
  }
  const foreign = Object.entries(r.components.foreign).sort((a, b) => b[1].instances - a[1].instances);
  const native = Object.entries(r.components.native).sort((a, b) => b[1] - a[1]);
  if (foreign.length || native.length || r.components.recreated.length) {
    lines.push('### Components', '');
    for (const [lib, x] of foreign) {
      const top = Object.entries(x.components).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, k]) => `${n} ${k}`).join(', ');
      lines.push(`- **${lib}**: ${x.instances} instances (${top})`);
    }
    if (native.length) lines.push(`- **Native elements**: ${native.map(([n, k]) => `<${n}> ${k}`).join(', ')}`);
    if (r.components.recreated.length) lines.push(`- **Re-created DS components**: ${r.components.recreated.map((x) => `${x.name} (${x.file}:${x.line})`).join(', ')}`);
    const dsUsed = Object.entries(r.components.ds).sort((a, b) => b[1] - a[1]);
    if (dsUsed.length) lines.push(`- **DS components used**: ${dsUsed.map(([n, k]) => `${n} ${k}`).join(', ')}`);
    lines.push('');
  }
  const im = r.imitations;
  if (im?.total) {
    lines.push(
      '### Component imitations',
      '',
      `${im.total} place(s) rebuild a pattern a DS component covers. They do not count as adoption. By component to use: ${Object.entries(im.byComponent).map(([c, k]) => `${c} ${k}`).join(', ')}.`,
      '',
      '| Use | Instead of | Count | Files |',
      '| --- | --- | ---: | ---: |',
    );
    for (const f of im.topFixes.slice(0, opts.topFixes ?? 10)) lines.push(`| ${f.suggestion} | ${esc(f.pattern)} | ${f.count} | ${f.files} |`);
    lines.push('');
    const all = r.files.flatMap((f) => (f.imitations ?? []).map((x) => ({ file: f.path, ...x })));
    const shown = all.slice(0, opts.imitations ?? 100);
    lines.push('| Where | Pattern | Use |', '| --- | --- | --- |');
    for (const x of shown) lines.push(`| \`${esc(x.file)}:${x.line}\` | ${esc(x.pattern)} on \`${esc(x.element)}\` | ${x.suggestion}${x.also?.length ? ` (or ${x.also.join(', ')})` : ''} |`);
    if (all.length > shown.length) lines.push(`| ... | ${all.length - shown.length} more (--json lists them all) | |`);
    lines.push('');
  }
  const files = r.topFiles.slice(0, opts.topFiles ?? 10);
  if (files.length) {
    lines.push('### Top files to migrate', '', '| File | Hardcoded | Non-DS components | Token refs |', '| --- | ---: | ---: | ---: |');
    for (const f of files) lines.push(`| \`${esc(f.path)}\` | ${f.hardcoded} | ${f.otherComponents} | ${f.tokenUsages} |`);
    lines.push('');
  }
  const fixes = r.topFixes.filter((f) => f.suggestion).slice(0, opts.topFixes ?? 10);
  if (fixes.length) {
    lines.push('### Top fixes', '', '| Value | Use | Confidence | Count |', '| --- | --- | --- | ---: |');
    for (const f of fixes) lines.push(`| \`${esc(f.value)}\` (${f.category}) | \`var(${f.suggestion!.cssVar})\` ${esc(f.suggestion!.value)}${f.suggestion!.mode ? ` [${f.suggestion!.mode}]` : ''} | ${f.suggestion!.level} | ${f.count} |`);
    lines.push('');
  }
  const ig = r.ignored;
  if (ig && (ig.total || ig.staleAllowlist.length)) {
    lines.push('### Ignored on purpose', '', `${ig.total} item(s) left out of the counts: ${ig.comment} by \`bridge-audit-ignore-next-line\` comments, ${ig.allowlist} by the allowlist.`, '');
    const shown = ig.items.slice(0, opts.ignored ?? 50);
    if (shown.length) {
      lines.push('| Where | What | Reason |', '| --- | --- | --- |');
      for (const x of shown) lines.push(`| \`${esc(x.file)}:${x.line}\` | \`${esc(x.what)}\` | ${esc(x.reason)} (${x.via}) |`);
      if (ig.items.length > shown.length) lines.push(`| ... | ${ig.items.length - shown.length} more | |`);
      lines.push('');
    }
    if (ig.staleAllowlist.length) {
      lines.push(`Allowlist entries that match nothing any more (remove them): ${ig.staleAllowlist.map((e) => `\`${esc(e.file)}:${e.line}${e.what ? ` ${esc(e.what)}` : ''}\``).join(', ')}.`, '');
    }
  }
  if (b) {
    lines.push(`### Progress since ${b.label ?? b.generatedAt}`, '');
    lines.push(`- ${b.improved.length} files improved, ${b.regressed.length} regressed, ${b.newFiles.length} new, ${b.removedFiles.length} removed.`);
    for (const f of b.regressed.slice(0, 5)) lines.push(`- Regressed: \`${esc(f.path)}\` ${f.before} -> ${f.after}`);
    lines.push('');
  }
  return lines.join('\n');
}

export interface CssFixEdit {
  line: number;
  column: number;
  from: string;
  to: string;
  token: string;
}

/** A value the fix leaves as it is, like the audit leaves it out of the counts: an ignore comment or the allowlist. */
export interface CssFixKept {
  line: number;
  column: number;
  from: string;
  reason: string;
  via: 'comment' | 'allowlist';
}

/**
 * Safe autofix for a CSS/SCSS/Less file: exact token matches become var(--token). Returns the edits and the new text.
 * The same exceptions as the audit: a `bridge-audit-ignore-next-line: reason` comment on the line above, and the
 * allowlist entries of this file, keep the value (listed in `kept`).
 */
export function planCssFixes(text: string, lang: 'css' | 'scss' | 'less', ds: DesignSystemIndex, opts: { allowlist?: AllowlistEntry[] | undefined } = {}): { edits: CssFixEdit[]; output: string; kept: CssFixKept[] } {
  const at = lineCol(text);
  const scan = scanCssText(text, lang);
  const edits: (CssFixEdit & { start: number; end: number })[] = [];
  const kept: CssFixKept[] = [];
  const byComment = new Map(ignoreDirectives(text).filter((d) => d.reason).map((d) => [d.target, d.reason] as const));
  const allow = opts.allowlist ?? [];
  for (const d of scan.decls) {
    const property = d.property.toLowerCase();
    // A shadow is one value; other categories replace the literal inside the value.
    for (const h of d.scan.hits as ValueHit[]) {
      const s = ds.suggest(h.category, h.text, property);
      if (!isSafeFix(h, s)) continue;
      const start = d.valueStart + h.index;
      const pos = at(start);
      const comment = byComment.get(pos.line);
      const listed = allow.find((e) => e.line === pos.line && (e.what === undefined || e.what === h.text));
      if (comment !== undefined || listed) {
        kept.push({ ...pos, from: h.text, reason: comment ?? listed!.reason, via: comment !== undefined ? 'comment' : 'allowlist' });
        continue;
      }
      edits.push({ ...pos, start, end: start + h.text.length, from: h.text, to: `var(${s!.cssVar})`, token: s!.token });
    }
  }
  let output = text;
  for (const e of [...edits].sort((a, b) => b.start - a.start)) output = output.slice(0, e.start) + e.to + output.slice(e.end);
  return { edits: edits.map(({ start: _s, end: _e, ...e }) => e), output, kept };
}
