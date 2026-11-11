// @vitest-environment jsdom
// The adoption report body: the verdict and its one primary action for who can act, read only for designers, groups
// that open on the developers' fold, "Not a problem" with a required reason. No axe violations.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuditReport, ComponentFinding, FileReport } from '@bridge-ds/core/audit';
import { AdoptionReportView, type ReportActions } from './AdoptionReport';
import { reportModel } from '../../../lib/adoption-report';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';

const SHADCN = 'shadcn/ui (local)';
const c = (name: string, library: string, suggestion?: string, line = 1): ComponentFinding => ({ line, column: 1, name, kind: library === 'native' ? 'native' : 'foreign', library, ...(suggestion ? { suggestion } : {}) });
const file = (path: string, components: ComponentFinding[]): FileReport => ({ path, lang: 'tsx', tokenUsages: 0, themeRefs: 0, hardcoded: 0, dsComponents: 0, otherComponents: components.length, findings: [], components });
const report: AuditReport = {
  schemaVersion: 1,
  tool: { name: 'bridge', version: '0' },
  generatedAt: '2026-11-10T21:23:31.011Z',
  target: { path: '../acme-crm/src', files: 1, skipped: 0 },
  designSystem: { packages: ['@acme/design-system'], components: 50, tokens: 600, modes: [] },
  metrics: { tokenAdoption: 72.2, componentAdoption: 13.2, tokenUsages: 10, hardcoded: 0, themeRefs: 0, dsComponentInstances: 2, uiComponentInstances: 15 },
  byCategory: {},
  components: { ds: {}, foreign: {}, native: {}, recreated: [{ name: 'Button', file: 'components/ui/button.tsx', line: 60, instances: 8 }] },
  topFiles: [],
  topFixes: [],
  files: [file('a.tsx', [...Array.from({ length: 8 }, (_, i) => c('Button', SHADCN, 'Button', i + 1)), c('button', 'native', 'Button', 20), c('Link', 'react-router', 'Link', 21), c('Item', SHADCN, undefined, 22)])],
  history: [],
};
const model = reportModel(report, { product: 'Acme CRM', productKey: 'crm', productRepo: 'acme-design-demo/acme-crm' });

const actions = (over: Partial<ReportActions> = {}): ReportActions => ({ canAct: true, canIgnore: true, local: false, sent: {}, send: vi.fn(async () => {}), ignore: vi.fn(async () => {}), ...over });
const paint = (a: ReportActions) => render(createElement(AdoptionReportView, { model, actions: a }));

afterEach(cleanup);

describe('AdoptionReportView', () => {
  it('leads with the verdict, one primary action, the score cards in words and the first-run line', async () => {
    const a = actions();
    const { container } = paint(a);
    expect(screen.getByRole('heading', { level: 2, name: /copies of the library's/ })).toBeTruthy();
    const primary = within(container.querySelector('.ar-verdict')!).getByRole('button', { name: 'Send to developers' });
    expect(screen.getByText(/of the buttons, menus and other pieces in Acme CRM come from the library/)).toBeTruthy();
    expect(screen.getAllByText("The trend starts when Acme CRM's code changes.")).toHaveLength(2);
    await act(async () => fireEvent.click(primary));
    expect(a.send).toHaveBeenCalledWith(['piece:Button']);
    await expectNoAxeViolations(container);
  });

  it('designers read: no action, a group opens on its pictures and the developers fold', async () => {
    const { container } = paint(actions({ canAct: false, canIgnore: false }));
    expect(screen.queryByRole('button', { name: 'Send to developers' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Buttons that look like ours but aren't/ }));
    expect(screen.getByText(/One change covers 8 of them\./)).toBeTruthy();
    expect(screen.getByText('No picture yet', { selector: '.ar-plate-big span' })).toBeTruthy();
    expect(screen.getByText('Bridge does not know which screen shows these yet.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /For developers: 9 places in the code/ }));
    expect(screen.getByText("export { Button } from '@acme/design-system'")).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Open in GitHub/ })[0]!.getAttribute('href')).toBe('https://github.com/acme-design-demo/acme-crm/blob/HEAD/src/a.tsx#L1');
    expect(screen.getByRole('heading', { name: 'Pieces the library is missing' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it("a group shows the product's own pieces next to the library's, and the screen they come from in a dialog", async () => {
    const screens = [{ route: '/#/contacts', name: 'Contacts', files: ['a.tsx'], image: 'audits/acme-crm/contacts.webp', url: 'https://crm.example.com/#/contacts', capturedAt: '2026-11-11T08:00:00Z' }];
    const crops = [{ key: 'piece:Button', component: 'Button', route: '/#/contacts', image: 'audits/acme-crm/piece-button.webp', from: '/#/contacts', width: 256, height: 68, capturedAt: '2026-11-11T08:00:00Z' }];
    const withShots = reportModel({ ...report, screens, crops }, { product: 'Acme CRM', productKey: 'crm' });
    const src = (path: string) => `https://raw.example/${path}`;
    const { container } = render(createElement(AdoptionReportView, { model: withShots, actions: actions({ canAct: false, canIgnore: false }), pictureSrc: src }));
    // In the row: the cropped buttons, never the whole screen.
    expect(container.querySelector('.ar-minis img')?.getAttribute('src')).toBe('https://raw.example/audits/acme-crm/piece-button.webp');
    fireEvent.click(screen.getByRole('button', { name: /Buttons that look like ours but aren't/ }));
    // Open: the same box as the library's, at the crop's own size.
    const crop = screen.getByRole('img', { name: 'Buttons as Acme CRM draws them, on the Contacts screen' });
    expect(crop.closest('.ar-plate-big.ar-plate-crop')).toBeTruthy();
    expect(crop.getAttribute('width')).toBe('256');
    expect(crop.getAttribute('style')).toContain('--ar-crop-w: 256px');
    expect(container.querySelectorAll('.ar-pair .ar-plate-big')).toHaveLength(2);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'See it on the Contacts screen' })));
    const dialog = await screen.findByRole('dialog', { name: 'The Contacts screen of Acme CRM' });
    expect(within(dialog).getByText(/All 9 buttons are on the Contacts screen\./)).toBeTruthy();
    expect(within(dialog).getByRole('img', { name: 'The Contacts screen of Acme CRM' }).getAttribute('src')).toBe('https://raw.example/audits/acme-crm/contacts.webp');
    expect(within(dialog).getByRole('link', { name: /Open this screen in Acme CRM/ }).getAttribute('href')).toBe('https://crm.example.com/#/contacts');
    await expectNoAxeViolations(container);
  });

  it('a group with no crop, an unsafe one or one that does not load says so in plain words', () => {
    const screens = [{ route: '/#/contacts', name: 'Contacts', files: ['a.tsx'] }];
    const m = reportModel({ ...report, screens }, { product: 'Acme CRM', productKey: 'crm' });
    render(createElement(AdoptionReportView, { model: m, actions: actions({ canAct: false, canIgnore: false }), pictureSrc: (p: string) => `https://raw.example/${p}` }));
    fireEvent.click(screen.getByRole('button', { name: /Buttons that look like ours but aren't/ }));
    expect(screen.getByText('Bridge has not found buttons to show on the Contacts screen yet.')).toBeTruthy();
    // The screen is not captured either: where they are, in words, no link to a picture that does not exist.
    expect(screen.getByText('All 9 buttons are on the Contacts screen.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'See it on the Contacts screen' })).toBeNull();
    cleanup();

    const unsafe = reportModel({ ...report, screens, crops: [{ key: 'piece:Button', component: 'Button', image: '../../evil.webp', width: 10, height: 10 }] }, { product: 'Acme CRM', productKey: 'crm' });
    expect(unsafe.pieces.find((r) => r.component === 'Button')!.crop).toBeNull();

    const crops = [{ key: 'piece:Button', component: 'Button', image: 'audits/acme-crm/piece-button.webp', from: '/#/contacts', width: 256, height: 68 }];
    const broken = reportModel({ ...report, screens, crops }, { product: 'Acme CRM', productKey: 'crm' });
    render(createElement(AdoptionReportView, { model: broken, actions: actions({ canAct: false, canIgnore: false }), pictureSrc: (p: string) => `https://raw.example/${p}` }));
    fireEvent.click(screen.getByRole('button', { name: /Buttons that look like ours but aren't/ }));
    fireEvent.error(document.querySelector('.ar-pair img')!);
    expect(screen.getByText('Bridge has not found buttons to show on the Contacts screen yet.')).toBeTruthy();
  });

  it('a sent group says so with its request in Being built, and the verdict says what went', () => {
    const { container } = paint(actions({ sent: { 'piece:Button': { number: 42, url: 'https://github.com/a/b/issues/42' } } }));
    expect(screen.queryByRole('button', { name: 'Send to developers' })).toBeNull();
    const verdict = within(container.querySelector<HTMLElement>('.ar-verdict')!);
    expect(verdict.getByText(/Sent to developers\. One request for Acme CRM's developers: buttons that look like ours but aren't\./)).toBeTruthy();
    expect(verdict.getByRole('link', { name: 'Open request #42' }).getAttribute('href')).toMatch(/building\/\?request=42$/);
    fireEvent.click(screen.getByRole('button', { name: /Buttons that look like ours but aren't/ }));
    expect(screen.getByRole('link', { name: 'request #42' }).getAttribute('href')).toMatch(/building\/\?request=42$/);
  });

  it('"Not a problem" needs a reason before it keeps the group as it is', async () => {
    const a = actions();
    paint(a);
    fireEvent.click(screen.getByRole('button', { name: /Links from react-router/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Not a problem' }));
    await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Keep them as they are' })));
    expect(a.ignore).not.toHaveBeenCalled();
    expect(await screen.findByText(/Say why in a few words/)).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox', { name: /Why they stay/ }), { target: { value: 'Router links stay as they are' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Keep them as they are' })));
    expect(a.ignore).toHaveBeenCalledWith('piece:Link', 'Router links stay as they are');
  });
});
