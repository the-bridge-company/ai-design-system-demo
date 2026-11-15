import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as pricing from './pricing';
import {
  COMMITMENTS,
  FAQ,
  FOUNDING_TEXT,
  LAUNCH_DATE,
  ORGANIZATION_PRICE,
  TABLE_GROUPS,
  TEAM_PRICE,
  TIERS,
  defaultCurrency,
  editorsCapped,
  money,
  teamMonthlyCost,
} from './pricing';
import { ROOT } from './repo';

const page = readFileSync(join(ROOT, 'apps/docs-site/src/pages/pricing.astro'), 'utf8');
const words = (v: unknown): string[] =>
  typeof v === 'string' ? [v] : Array.isArray(v) ? v.flatMap(words) : v && typeof v === 'object' ? Object.values(v).flatMap(words) : [];
const allWords = [...Object.values(pricing).flatMap(words), page].join('\n');

describe('pricing (/pricing/)', () => {
  it('keeps the decided prices: Team 12 EUR capped at 120, Organization 490, Free 3 editors and 1 design system', () => {
    expect(TEAM_PRICE.EUR.yearly).toEqual({ perEditor: 12, cap: 120 });
    expect(TEAM_PRICE.EUR.monthly).toEqual({ perEditor: 15, cap: 150 });
    expect(TEAM_PRICE.USD.yearly).toEqual({ perEditor: 14, cap: 140 });
    expect(TEAM_PRICE.USD.monthly).toEqual({ perEditor: 17, cap: 170 });
    expect(ORGANIZATION_PRICE.USD).toBe(550);
    expect(ORGANIZATION_PRICE.EUR).toBe(490);
    expect(pricing.FREE_EDITORS).toBe(3);
    expect(pricing.FREE_DESIGN_SYSTEMS).toBe(1);
    expect(pricing.TEAM_DESIGN_SYSTEMS).toBe(3);
  });

  it('caps every Team price at ten editors, so "editors past ten cost nothing" stays true', () => {
    for (const c of pricing.CURRENCIES) for (const b of pricing.BILLINGS) expect(editorsCapped(TEAM_PRICE[c][b]), `${c} ${b}`).toBe(10);
    expect(teamMonthlyCost(4, TEAM_PRICE.EUR.yearly)).toBe(48);
    expect(teamMonthlyCost(25, TEAM_PRICE.EUR.yearly)).toBe(120);
  });

  it('formats whole amounts in each currency', () => {
    expect(money(12, 'EUR')).toBe('€12');
    expect(money(490, 'EUR')).toBe('€490');
    expect(money(14, 'USD')).toBe('$14');
  });

  it('defaults the currency from the browser language', () => {
    expect(defaultCurrency('fr-FR')).toBe('EUR');
    expect(defaultCurrency('de')).toBe('EUR');
    expect(defaultCurrency('en-GB')).toBe('EUR');
    expect(defaultCurrency('en-US')).toBe('USD');
    expect(defaultCurrency('en')).toBe('USD');
    expect(defaultCurrency('ja-JP')).toBe('USD');
    expect(defaultCurrency(undefined)).toBe('EUR');
  });

  it('recommends Team, and gives Free its one negative line', () => {
    expect(TIERS.map((t) => t.id)).toEqual(['free', 'team', 'organization']);
    expect(TIERS.filter((t) => t.recommended).map((t) => t.id)).toEqual(['team']);
    expect(TIERS.filter((t) => t.without).map((t) => t.id)).toEqual(['free']);
    for (const g of TABLE_GROUPS) for (const r of g.rows) expect(r.cells, r.label).toHaveLength(3);
    // Teams have roles today on every tier: never shown as taken away. "Our commitments" is said once, as a section.
    const roles = TABLE_GROUPS.flatMap((g) => g.rows).find((r) => r.label === 'Roles')!;
    expect(roles.cells).toEqual([true, true, true]);
    expect(TIERS.flatMap((t) => t.includes).join(' ')).not.toMatch(/roles/i);
    expect(TABLE_GROUPS.map((g) => g.name)).not.toContain('Our commitments');
  });

  it('names the real license and keeps the founding text with its placeholder date', () => {
    const license = readFileSync(join(ROOT, 'LICENSE'), 'utf8');
    expect(license).toContain('FSL-1.1-MIT');
    expect(COMMITMENTS.map((c) => c.text).join(' ')).toContain('FSL-1.1-MIT');
    expect(LAUNCH_DATE).toBe('[LAUNCH DATE]');
    expect(FOUNDING_TEXT[0]).toContain(`before ${LAUNCH_DATE} keeps`);
    expect(FAQ.map((f) => f.id)).toEqual(['fourth-editor', 'stop-paying', 'self-host', 'hosting', 'vat', 'refunds', 'pricing-wrong', 'discounts', 'saml', 'shutdown']);
    const discounts = FAQ.find((f) => f.id === 'discounts')!;
    expect(pricing.faqAnswer(discounts, 'EUR').join(' ')).toContain('cap at €120 per design system');
    expect(pricing.faqAnswer(discounts, 'USD').join(' ')).toContain('cap at $140 per design system');
    // Only the three launch blockers stay open; nothing on the page reads as a placeholder but the launch date.
    expect(allWords).not.toMatch(/\[TO DECIDE/);
    expect(allWords).not.toMatch(/hosted in the EU|never leaves Europe/i);
  });

  it('never says what the page must not say', () => {
    expect(allWords).not.toMatch(/—/);
    expect(allWords).not.toMatch(/contact sales|most popular|lifetime|countdown|limited time/i);
  });

  it('says VAT is not applicable (VAT franchise), never "exclude VAT" or reverse charge', () => {
    expect(pricing.VAT_NOTE).toBe('VAT not applicable (French micro-enterprise, art. 293 B of the French tax code).');
    expect(allWords).not.toMatch(/exclude VAT|excluding VAT|reverse charge|FR01947632055/i);
  });

  it('keeps the terms, the legal notice and the privacy page free of placeholders and em dashes', () => {
    for (const f of ['terms', 'legal', 'privacy']) {
      const src = readFileSync(join(ROOT, `apps/docs-site/src/pages/${f}.astro`), 'utf8');
      expect(src, f).not.toMatch(/—/);
      expect(src, f).not.toMatch(/\[(À|A) COMPL|\[TO DECIDE|\[ADRESSE|\[DATE DE/);
    }
    const terms = readFileSync(join(ROOT, 'apps/docs-site/src/pages/terms.astro'), 'utf8');
    expect(terms).toContain('293 B');
    expect(terms).toContain('EUR 40');
    expect(terms).not.toMatch(/reverse-charge|Autoliquidation/);
  });
});
