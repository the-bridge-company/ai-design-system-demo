import { describe, expect, it } from 'vitest';
import type { AuditReport, ComponentFinding, FileReport, StyleFinding } from '@bridge-ds/core/audit';
import { codeHref, codePlace, colorName, groupRequest, humanName, ignoreReasonProblems, partsLine, pctWord, pieceWord, reportModel, scoreCards, tokenName, FIRST_RUN_LINE } from './adoption-report';

const SHADCN = 'shadcn/ui (local)';
const c = (name: string, library: string, suggestion?: string, line = 1): ComponentFinding => ({ line, column: 1, name, kind: library === 'native' ? 'native' : library === 'local' ? 'recreated' : 'foreign', library, ...(suggestion ? { suggestion } : {}) });
const v = (value: string, token?: string, level: 'exact' | 'high' | 'medium' | 'low' = 'medium'): StyleFinding => ({ line: 4, column: 1, category: 'color', value, source: 'tailwind', ...(token ? { suggestion: { token, cssVar: `--${token.replace(/\./g, '-')}`, value: '#c6cfd9', distance: 2, confidence: 0.6, level } } : {}) });
const file = (path: string, components: ComponentFinding[], findings: StyleFinding[] = []): FileReport => ({ path, lang: 'tsx', tokenUsages: 0, themeRefs: 0, hardcoded: findings.length, dsComponents: 0, otherComponents: components.length, findings, components });

const buttons = Array.from({ length: 9 }, (_, i) => c('Button', SHADCN, 'Button', i + 1));
const report: AuditReport = {
  schemaVersion: 1,
  tool: { name: 'bridge', version: '0' },
  generatedAt: '2026-11-10T21:23:31.011Z',
  target: { path: '../acme-crm/src', files: 3, skipped: 0 },
  designSystem: { packages: ['@acme/design-system'], components: 50, tokens: 600, modes: [] },
  metrics: { tokenAdoption: 72.2, componentAdoption: 13.2, tokenUsages: 10, hardcoded: 3, themeRefs: 0, dsComponentInstances: 10, uiComponentInstances: 26 },
  byCategory: {},
  components: { ds: {}, foreign: {}, native: {}, recreated: [{ name: 'Button', file: 'components/ui/button.tsx', line: 60, instances: 9 }] },
  topFiles: [],
  topFixes: [],
  files: [
    file('a.tsx', [...buttons, c('button', 'native', 'Button', 20), c('DropdownMenu', SHADCN, 'Menu', 30), c('DropdownMenuItem', SHADCN, 'Menu', 31)], [v('bg-gray-300', 'color.border.emphasis'), v('#646cffaa')]),
    file('b.tsx', [c('Link', 'react-router', 'Link'), c('a', 'native', 'Link', 2), c('Item', SHADCN, undefined, 3)], [{ ...v('w-[350px]', 'size.80'), category: 'size' }]),
  ],
  history: [],
};

describe('words', () => {
  it('names pieces, colors and tokens the way designers say them', () => {
    expect(pieceWord('Button', 2)).toBe('buttons');
    expect(pieceWord('Skeleton', 1)).toBe('loading placeholder');
    expect(pieceWord('Widget', 2)).toBe('Widget pieces');
    expect(humanName('DropdownMenuItem')).toBe('dropdown menu item');
    expect(humanName('Dialog.Title')).toBe('dialog title');
    expect(colorName('#d1d5db')).toBe('Light gray');
    expect(colorName('#18181b')).toBe('Near black');
    expect(colorName('#fad2e1')).toBe('Pale pink');
    expect(colorName('#0000001a')).toBe('See-through black');
    expect(tokenName('color.border.strong')).toBe('Strong line');
    expect(tokenName('color.surface.selected')).toBe('Selected background');
    expect(tokenName('color.action.primary.bg')).toBe('Primary action background');
    expect(pctWord(13.2)).toBe('13%');
    expect(pctWord(13.4, 13.2)).toBe('13.4%');
  });

  it('a decision needs a reason', () => {
    expect(ignoreReasonProblems(' ')).toHaveLength(1);
    expect(ignoreReasonProblems('short')).toHaveLength(1);
    expect(ignoreReasonProblems('Router links stay as they are')).toEqual([]);
  });
});

describe('code links', () => {
  it('use what the report records, else the product repository and the folder of its checkout', () => {
    expect(codePlace(report.target, 'acme-design-demo/acme-crm')).toEqual({ repo: 'acme-design-demo/acme-crm', ref: 'HEAD', root: 'src' });
    expect(codeHref(codePlace(report.target, 'acme-design-demo/acme-crm'), 'a.tsx', 4)).toBe('https://github.com/acme-design-demo/acme-crm/blob/HEAD/src/a.tsx#L4');
    expect(codePlace({ ...report.target, repo: 'acme/crm', ref: 'abc1234', root: '' }, undefined)).toEqual({ repo: 'acme/crm', ref: 'abc1234', root: '' });
    // A path that does not name the repository: no link rather than a wrong one.
    expect(codePlace({ ...report.target, path: 'apps/web/src' }, 'acme/crm')).toBeNull();
    expect(codePlace(report.target, undefined)).toBeNull();
  });
});

describe('the report', () => {
  const m = reportModel(report, { product: 'Acme CRM', productKey: 'crm', productRepo: 'acme-design-demo/acme-crm' });

  it('leads with the verdict that explains the number, the local copy said in one sentence', () => {
    expect(m.verdict.title).toBe("Most of Acme CRM's buttons and menus are copies of the library's");
    expect(m.verdict.sentence).toMatch(/own copy of shadcn\/ui, so library updates never reach them and they count as not from the library/);
    expect(m.verdict.send).toEqual(['piece:Button', 'piece:Menu']);
  });

  it('groups whole pieces in words, with the one change that covers most of them', () => {
    const b = m.pieces[0]!;
    expect(b.title).toBe("Buttons that look like ours but aren't");
    expect(b.detail).toBe('10 buttons, in one part of the app.');
    expect(b.gain).toEqual({ from: '13%', to: '77%' });
    expect(b.source).toEqual({ lead: 'One change covers 9 of them.', text: "Acme CRM keeps its own copy of Button. When the developers point that copy to the library's Button, 9 buttons switch at once, the other 1 one by one." });
    expect(b.dev.fix).toMatchObject({ file: 'components/ui/button.tsx', before: 'export function Button(…)', after: "export { Button } from '@acme/design-system'" });
    expect(b.dev.places[9]).toEqual({ file: 'a.tsx', line: 20, what: '<button>', from: 'HTML', href: 'https://github.com/acme-design-demo/acme-crm/blob/HEAD/src/a.tsx#L20' });
    expect(m.pieces.find((r) => r.component === 'Link')!.title).toBe('Links made two different ways');
    expect(m.pieces.find((r) => r.component === 'Menu')!.title).toBe("Menus that copy the library's Menu");
    expect(m.gaps.map((g) => [g.name, g.detail])).toEqual([['Item', '1 place']]);
    expect(m.partsLine).toBe('1 more part belongs to pieces the library already has, like dropdown menu items. They switch with their piece.');
  });

  it('colors next to the library color, with how close they are', () => {
    expect(m.colors.map((r) => [r.title, r.match.label, r.library?.name ?? null])).toEqual([
      ['Light gray', 'Close, check the meaning', 'Emphasis line'],
      ['Colors the library does not have', 'No library color yet', null],
    ]);
    expect(m.colors[0]!.product[0]).toEqual({ value: 'bg-gray-300', color: '#d1d5db', name: 'Light gray' });
    expect(m.sizes.map((r) => r.title)).toEqual(['Sizes: w-[350px]']);
  });

  it('a group marked "Not a problem" leaves the list and waits under what is left on purpose', () => {
    const ignores = { version: 1 as const, ignores: [{ product: 'crm', group: 'piece:Link', title: 'Links', reason: 'Router links stay', at: '2026-11-11', places: [] }, { product: 'prints', group: 'piece:Button', reason: 'x', at: '', places: [] }] };
    const k = reportModel(report, { product: 'Acme CRM', productKey: 'crm', ignores });
    expect(k.pieces.map((r) => r.key)).not.toContain('piece:Link');
    expect(k.pieces.map((r) => r.key)).toContain('piece:Button');
    expect(k.ignored.map((x) => x.group)).toEqual(['piece:Link']);
  });
});

describe('score cards', () => {
  it('say when the trend starts on a first run', () => {
    const [pieces, values] = scoreCards(report, 'Acme CRM');
    expect(pieces).toMatchObject({ value: '13%', trend: null, points: [], label: 'of the buttons, menus and other pieces in Acme CRM come from the library' });
    expect(values!.value).toBe('72%');
    expect(FIRST_RUN_LINE).toBe('The trend starts with the next check.');
  });

  it('read the history: up from the previous run, in words', () => {
    const point = { generatedAt: '2026-10-27T10:00:00.000Z', tokenAdoption: 70, componentAdoption: 12, hardcoded: 4, uiComponentInstances: 70, dsComponentInstances: 8 };
    const [pieces, values] = scoreCards({ ...report, history: [point] }, 'Acme CRM');
    expect(pieces!.trend).toEqual({ text: 'up from 12% two weeks ago', direction: 'up' });
    expect(pieces!.points).toHaveLength(2);
    expect(values!.trend?.text).toBe('up from 70% two weeks ago');
  });
});

describe('Send to developers', () => {
  it('files one request per group, linked back to the report', () => {
    const m = reportModel(report, { product: 'Acme CRM', productKey: 'crm' });
    const b = m.pieces[0]!;
    const r = groupRequest({ key: b.key, title: b.title, detail: b.detail, component: b.component, places: b.dev.places, fix: b.dev.fix }, { product: 'Acme CRM', productKey: 'crm', run: 'acme-crm', url: 'https://bridge.example/studio/a/b/quality/report/?product=crm' });
    expect(r.title).toBe("Switch Acme CRM's buttons to the library's Button");
    expect(r.origin).toEqual({ kind: 'audit', product: 'crm', run: 'acme-crm', group: 'piece:Button', name: b.title, url: 'https://bridge.example/studio/a/b/quality/report/?product=crm' });
    expect(r.summary).toContain("Fix at the source: `components/ui/button.tsx:60`");
    expect(r.summary).not.toMatch(/—/);
  });
});

describe('parts line', () => {
  it('says nothing without parts', () => {
    expect(partsLine({ count: 0, examples: [] })).toBeNull();
  });
});
