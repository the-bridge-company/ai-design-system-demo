// The adoption report as whole pieces and value groups (audit/pieces.ts), its trend across runs (carryHistory), the
// "Not a problem" decisions file and the audit origin of a request.
import { describe, expect, test } from 'vitest';
import { adoptionPieces, adoptionValues, carryHistory, findingColor, ignoresAllowlist, parseAuditIgnores, valueMatch, withAuditIgnore, type AuditReport, type ComponentFinding, type FileReport, type StyleFinding } from '../src/audit';
import { composeRequestIssue, parseRequestIssue, requestOriginOf } from '../src';

const c = (name: string, library: string, suggestion?: string, line = 1, kind: ComponentFinding['kind'] = library === 'native' ? 'native' : library === 'local' ? 'recreated' : 'foreign'): ComponentFinding => ({ line, column: 1, name, kind, library, ...(suggestion ? { suggestion } : {}) });
const v = (value: string, token?: string, level: 'exact' | 'high' | 'medium' | 'low' = 'exact', line = 1): StyleFinding => ({
  line,
  column: 1,
  category: 'color',
  value,
  source: 'tailwind',
  ...(token ? { suggestion: { token, cssVar: `--${token.replace(/\./g, '-')}`, value: '#000000', distance: 0, confidence: 1, level } } : {}),
});
const file = (path: string, components: ComponentFinding[], findings: StyleFinding[] = []): FileReport => ({ path, lang: 'tsx', tokenUsages: 0, themeRefs: 0, hardcoded: findings.length, dsComponents: 0, otherComponents: components.length, findings, components });

const SHADCN = 'shadcn/ui (local)';
function report(files: FileReport[], over: Partial<AuditReport> = {}): AuditReport {
  const ui = files.reduce((n, f) => n + f.components.length, 0) + 10;
  const hardcoded = files.reduce((n, f) => n + f.findings.length, 0);
  return {
    schemaVersion: 1,
    tool: { name: 'bridge', version: '0.0.0' },
    generatedAt: '2026-11-10T00:00:00.000Z',
    target: { path: '../crm/src', files: files.length, skipped: 0 },
    designSystem: { packages: ['@acme/ui'], components: 50, tokens: 600, modes: [] },
    metrics: { tokenAdoption: 50, componentAdoption: Math.round((10 / ui) * 1000) / 10, tokenUsages: hardcoded, hardcoded, themeRefs: 0, dsComponentInstances: 10, uiComponentInstances: ui },
    byCategory: {},
    components: { ds: { Badge: 10 }, foreign: {}, native: {}, recreated: [{ name: 'Button', file: 'components/ui/button.tsx', line: 60, instances: 3 }] },
    topFiles: [],
    topFixes: [],
    files,
    history: [],
    ...over,
  };
}

const crm = report([
  file('a.tsx', [c('Button', SHADCN, 'Button', 1), c('Button', SHADCN, 'Button', 2), c('button', 'native', 'Button', 3), c('DropdownMenu', SHADCN, 'Menu', 4), c('DropdownMenuTrigger', SHADCN, 'Menu', 5), c('DropdownMenuContent', SHADCN, 'Menu', 6), c('DropdownMenuItem', SHADCN, 'Menu', 7), c('DropdownMenuItem', SHADCN, 'Menu', 8)]),
  file('b.tsx', [c('Button', SHADCN, 'Button', 1), c('Dialog', SHADCN, 'Dialog', 2), c('DialogTitle', SHADCN, undefined, 3), c('DialogHeader', SHADCN, undefined, 4), c('Dialog.Root', '@base-ui/react', undefined, 9), c('Dialog.Popup', '@base-ui/react', undefined, 10)]),
  file('c.tsx', [c('Item', SHADCN, undefined, 1), c('ItemContent', SHADCN, undefined, 2), c('AlertDialog', SHADCN, 'Dialog', 3), c('Alert', SHADCN, 'Alert', 4), c('TooltipContent', SHADCN, undefined, 5), c('Tooltip', SHADCN, 'Tooltip', 6)], [v('bg-gray-300', 'color.border.emphasis', 'medium'), v('#000000', 'color.black', 'exact', 2), v('#646cffaa')]),
  file('d.tsx', [c('TooltipTrigger', SHADCN, undefined, 1)], [v('bg-gray-200', 'color.border.emphasis', 'medium')]),
]);

describe('adoptionPieces', () => {
  const p = adoptionPieces(crm);
  const group = (name: string) => p.groups.find((g) => g.component === name)!;

  test('a menu with its trigger, content and items is one menu', () => {
    expect(group('Menu')).toMatchObject({ key: 'piece:Menu', pieces: 1, instances: 5, files: 1 });
    expect(group('Menu').places.filter((x) => x.part).map((x) => x.name)).toEqual(['DropdownMenuTrigger', 'DropdownMenuContent', 'DropdownMenuItem', 'DropdownMenuItem']);
  });

  test('pieces from every source that should use the same library component are one group', () => {
    const b = group('Button');
    expect(b).toMatchObject({ pieces: 4, instances: 4, files: 2 });
    expect(b.sources).toEqual([
      { label: 'shadcn/ui', library: SHADCN, local: true, pieces: 3 },
      { label: 'HTML', library: 'native', local: false, pieces: 1 },
    ]);
    // The product's own copy: one change switches its uses.
    expect(b.sourceFile).toEqual({ file: 'components/ui/button.tsx', line: 60, name: 'Button', instances: 3 });
    // The figure once the group uses the library: (10 + 4) / ui.
    expect(b.gain).toBe(Math.round((14 / crm.metrics.uiComponentInstances) * 1000) / 10);
  });

  test('namespaced parts belong to their root, and a name the library knows is its own piece', () => {
    // shadcn Dialog + base-ui Dialog.Root, with their parts; AlertDialog (its own suggestion) joins Dialog as a piece.
    expect(group('Dialog')).toMatchObject({ pieces: 3, instances: 6 });
    expect(group('Alert')).toMatchObject({ pieces: 1, instances: 1 });
  });

  test('parts shown without their piece in a file count as one piece there', () => {
    // Tooltip in c.tsx, only a TooltipTrigger in d.tsx.
    expect(group('Tooltip')).toMatchObject({ pieces: 2, instances: 3 });
  });

  test('a piece no library component fits is missing, with its parts', () => {
    expect(p.missing).toEqual([expect.objectContaining({ key: `missing:${SHADCN}:Item`, name: 'Item', pieces: 1, instances: 2 })]);
  });

  test('biggest change first; parts and the local share are counted', () => {
    expect(p.groups[0]!.component).toBe('Dialog');
    expect(p.parts.count).toBe(9);
    expect(p.local.instances).toBe(18);
  });

  test('an area of the app keeps only its files', () => {
    const only = adoptionPieces(crm, { files: (f) => f === 'a.tsx' });
    expect(only.groups.map((g) => g.component).sort()).toEqual(['Button', 'Menu']);
  });
});

describe('adoptionValues', () => {
  test('values group by the token to use, with how close it is and the color they paint', () => {
    const g = adoptionValues(crm, { categories: ['color'] });
    expect(g.map((x) => [x.key, x.match, x.count])).toEqual([
      ['value:color:color.border.emphasis', 'close', 2],
      ['value:color:color.black', 'same', 1],
      ['value:color:none', 'none', 1],
    ]);
    expect(g[0]!.values.map((x) => x.color)).toEqual(['#e5e7eb', '#d1d5db']);
    expect(g[2]!.gain).toBeNull();
  });

  test('findingColor reads CSS colors and Tailwind classes, with their opacity', () => {
    expect(findingColor('#888')).toBe('#888888');
    expect(findingColor('bg-black/10')).toBe('#0000001a');
    expect(findingColor('text-[#123456]')).toBe('#123456');
    expect(findingColor('p-[13px]')).toBeUndefined();
    expect(valueMatch('high')).toBe('very-close');
    expect(valueMatch(undefined)).toBe('none');
  });
});

describe('carryHistory', () => {
  const at = (ref: string | undefined, component: number, generatedAt: string) => report([], { generatedAt, target: { path: 'src', files: 1, skipped: 0, ...(ref ? { ref } : {}) }, metrics: { ...crm.metrics, componentAdoption: component } });

  test('a new commit adds the previous run as a point and compares with it', () => {
    const prev = { ...at('aaa1111', 12, '2026-10-13T00:00:00.000Z'), history: [{ generatedAt: '2026-09-01T00:00:00.000Z', tokenAdoption: 60, componentAdoption: 10, hardcoded: 1, uiComponentInstances: 1, dsComponentInstances: 1 }] };
    const next = carryHistory(at('bbb2222', 13, '2026-11-10T00:00:00.000Z'), prev);
    expect(next.history.map((h) => h.componentAdoption)).toEqual([10, 12]);
    expect(next.history[1]!.ref).toBe('aaa1111');
    expect(next.baseline?.componentAdoption).toEqual({ before: 12, after: 13, delta: 1 });
  });

  test('the same commit measured again keeps the history as it was', () => {
    const prev = carryHistory(at('bbb2222', 13, '2026-11-10T00:00:00.000Z'), at('aaa1111', 12, '2026-10-13T00:00:00.000Z'));
    const again = carryHistory(at('bbb2222', 13, '2026-11-10T00:30:00.000Z'), prev);
    expect(again.history).toHaveLength(1);
    expect(again.baseline?.componentAdoption.delta).toBe(1);
    // Without commits, the same figures count as the same code.
    expect(carryHistory(at(undefined, 13, 'x'), at(undefined, 13, 'y')).history).toEqual([]);
    expect(carryHistory(at(undefined, 13, 'x'), null).history).toEqual([]);
  });
});

describe('audit-ignores.json', () => {
  test('decisions become allowlist entries of their product, a later one replaces an earlier one', () => {
    const one = { product: 'crm', group: 'piece:Link', reason: 'Router links stay', by: 'dana', at: '2026-11-11', places: [{ file: 'a.tsx', line: 3, what: 'Link' }] };
    let f = withAuditIgnore(parseAuditIgnores(null), one);
    f = withAuditIgnore(f, { ...one, reason: 'Router links stay, they route' });
    f = withAuditIgnore(f, { ...one, product: 'prints' });
    expect(f.ignores).toHaveLength(2);
    expect(ignoresAllowlist(f, 'crm')).toEqual([{ file: 'a.tsx', line: 3, what: 'Link', reason: 'Not a problem (dana in Bridge): Router links stay, they route' }]);
    expect(ignoresAllowlist(f, undefined)).toEqual([]);
  });

  test('malformed decisions are left out', () => {
    expect(parseAuditIgnores({ ignores: [{ product: 'crm', group: 'x', reason: ' ', places: [] }, { product: 'crm', group: 'y', reason: 'ok', places: [{ file: 'a', line: 0 }] }] }).ignores).toEqual([{ product: 'crm', group: 'y', reason: 'ok', at: '', places: [] }]);
    expect(parseAuditIgnores('nope').ignores).toEqual([]);
  });
});

describe('audit origin of a request', () => {
  test('survives the issue body and reads back', () => {
    const origin = { kind: 'audit' as const, product: 'crm', run: 'acme-crm', group: 'piece:Button', name: "Buttons that look like ours but aren't", url: 'https://bridge.example/studio/a/b/quality/report/?product=crm' };
    const issue = composeRequestIssue({ component: 'Button', kind: 'other', title: 'Switch Acme CRM buttons to the library', summary: 's', changes: [], source: 'studio', origin });
    expect(requestOriginOf(parseRequestIssue(issue.body))).toEqual(origin);
    expect(requestOriginOf({ origin: { kind: 'audit', product: 'crm' } as never })).toBeNull();
  });
});
