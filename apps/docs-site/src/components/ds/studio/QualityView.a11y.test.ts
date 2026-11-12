// @vitest-environment jsdom
// Quality, Adoption: each product row is one link whose name starts with what it shows (WCAG 2.5.3, label in name)
// and says where it goes; its meters stay out of the name, the percentages beside them say the same.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import { QualityView, type QualityViewProps } from './QualityView';
import { adoptionView, qualityVerdict, type AdoptionRun } from '../../../lib/quality-view';
import { contrastFinding } from '../../../lib/quality';

afterEach(cleanup);

const run = (id: string, product: string, at: string, component: number): AdoptionRun => ({ id, label: `${product}, ${id}`, product, generatedAt: at, token: 80, component, ds: component, ui: 100, href: `/r/${id}` });
const pass = contrastFinding({ total: 10, fail: 0, combos: [] });

const props = (): QualityViewProps => ({
  verdict: qualityVerdict({ contrastFail: 0, findings: [pass] }),
  pillars: [],
  contrast: { hasChecks: true, gate: pass, combos: [], failRows: [] },
  adoption: adoptionView([run('a1', 'web', '2026-01-01', 50), run('a2', 'web', '2026-03-01', 70)]),
  guidance: { lead: 'Guidance.', findings: [] },
  tokens: { findings: [], unused: { tokens: { total: 0, unused: 0 }, primitives: { total: 0, unused: 0 } }, unusedHref: '/tokens/' },
});

describe('Quality adoption rows', () => {
  it('names each row link by what it shows, then where it goes', async () => {
    render(createElement('main', null, createElement('h1', null, 'Quality'), createElement(QualityView, props())));
    const link = screen.getByRole('link', { name: /open the adoption report/i });
    const name = link.textContent ?? '';
    // No aria-label over the row: the visible words are the name, in reading order.
    expect(link).not.toHaveAttribute('aria-label');
    expect(name.startsWith('web')).toBe(true);
    expect(name).toMatch(/Open the adoption report$/);
    // The meters inside the link are hidden: the percentages next to them are read once.
    for (const bar of link.querySelectorAll('[role="progressbar"]')) expect(bar).toHaveAttribute('aria-hidden', 'true');
    await expectNoAxeViolations();
  });
});
