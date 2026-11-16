import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as pricing from './pricing';
import {
  COMMITMENTS,
  FAQ,
  FOUNDING_TEXT,
  FOUNDING_CUTOFF,
  ORGANIZATION_PRICE,
  DIFF_ROWS,
  FOUNDING_FACTS,
  FOUNDING_BAND_NOTE,
  TEAM_PRICE,
  TIERS,
  defaultCurrency,
  editorsCapped,
  money,
  teamMonthlyCost,
} from './pricing';
import { ROOT } from './repo';
import { BILLING_EARLIEST_LAUNCH, BILLING_LAUNCHED, BILLING_LAUNCH_DATE } from './billing';

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

  it('shows the rows that differ only, recommends no tier, and never takes roles away', () => {
    expect(TIERS.map((t) => t.id)).toEqual(['free', 'team', 'organization']);
    expect(TIERS.some((t) => 'recommended' in t)).toBe(false);
    expect(DIFF_ROWS.map((r) => r.label)).toEqual(['Editors', 'Design systems', 'SAML and SCIM', 'Decision audit export', 'Hosted for you, isolated, backed up', 'Uptime', 'Support']);
    for (const r of DIFF_ROWS) {
      expect(r.cells, r.label).toHaveLength(3);
      expect(new Set(r.cells).size, r.label).toBeGreaterThan(1);
    }
    // Teams have roles today on every tier: roles are named among what is the same everywhere.
    expect(pricing.SAME_EVERYWHERE).toMatch(/^Everything else is the same on every tier:/);
    // There is no Google or Microsoft sign-in: never claim one.
    expect(allWords).not.toMatch(/Microsoft|Google/);
    expect(pricing.COMMITMENTS.find((c) => c.lead === 'Sign-in stays free on every tier.')!.text).toBe(pricing.SIGN_IN);
    expect(pricing.SAME_EVERYWHERE).toContain('roles');
    expect(TIERS.flatMap((t) => t.includes).join(' ')).not.toMatch(/roles/i);
  });

  it('names the real license and keeps the founding text with its placeholder date', () => {
    const license = readFileSync(join(ROOT, 'LICENSE'), 'utf8');
    expect(license).toContain('FSL-1.1-MIT');
    expect(COMMITMENTS.map((c) => c.text).join(' ')).toContain('FSL-1.1-MIT');
    expect(pricing.HERO_TITLE).toBe('Bridge is free today. Start your team by 31 March 2027 and it stays free.');
    expect(FOUNDING_CUTOFF).toBe('2027-03-31');
    expect(FOUNDING_TEXT[0]).toContain('created on Bridge by 31 March 2027 keeps');
    // The billing code reads the same cutoff, exclusive: the day after.
    const next = new Date(`${FOUNDING_CUTOFF}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    expect(BILLING_LAUNCH_DATE).toBe(next.toISOString().slice(0, 10));
    expect(BILLING_LAUNCHED).toBe(false);
    expect(BILLING_EARLIEST_LAUNCH).toBe(pricing.PAID_PLANS_EARLIEST);
    expect(FAQ[0].answer[0]).toBe('Not before 1 April 2027. We will write to every team at least 30 days before, with the final prices. Teams created by 31 March 2027 stay free.');
    expect(pricing.FAQ_OPEN).toBe(FAQ[0].id);
    expect(FAQ.map((f) => f.id)).toEqual(['when', 'fourth-editor', 'stop-paying', 'self-host', 'hosting', 'vat', 'refunds', 'pricing-wrong', 'discounts', 'saml', 'shutdown']);
    const discounts = FAQ.find((f) => f.id === 'discounts')!;
    expect(pricing.faqAnswer(discounts, 'EUR').join(' ')).toContain('cap at €120 per design system');
    expect(pricing.faqAnswer(discounts, 'USD').join(' ')).toContain('cap at $140 per design system');
    // Only the three launch blockers stay open; nothing on the page reads as a placeholder but the launch date.
    expect(allWords).not.toMatch(/\[TO DECIDE|\[LAUNCH/);
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

  it('says prices are planned, gives no path to pay and keeps one primary action (the hero)', () => {
    expect(TIERS.map((t) => t.cta)).toEqual(['Create your team', undefined, 'Ask about Organization']);
    expect(TIERS.filter((t) => t.badge).map((t) => t.id)).toEqual(['team', 'organization']);
    expect(TIERS.find((t) => t.id === 'team')!.footerNote).toBe('Start today on Free. Created by 31 March 2027, your team never pays this.');
    expect(page.match(/variant="primary"/g)).toHaveLength(1);
    expect(allWords).not.toMatch(/countdown|hurry|launch offer|checkout/i);
  });

  it('keeps every founding sentence word for word in the band, only the first subject changes', () => {
    const band = [...FOUNDING_FACTS.map((f) => f.text), FOUNDING_BAND_NOTE].join(' ');
    const [first, ...rest] = FOUNDING_TEXT;
    expect(band).toContain(first.replace('Every team created on Bridge by 31 March 2027 keeps, at no cost and with no end date,', 'Your team keeps, at no cost,'));
    expect(FOUNDING_FACTS[1].title).toBe('Free, with no end date');
    expect(band).not.toContain('with no end date');
    for (const sentence of rest.join(' ').split(/(?<=\.) /)) expect(band, sentence).toContain(sentence);
    expect(FOUNDING_FACTS[0].title).toBe('31 March 2027');
  });

  it('puts the founding strip on every marketing page: FREE in a strong, a link to #founding', () => {
    expect(pricing.STRIP.before + pricing.STRIP.strong + pricing.STRIP.after).toBe('Paid plans open in 2027. Teams created by 31 March 2027 stay FREE, with no end date.');
    const landing = readFileSync(join(ROOT, 'apps/docs-site/src/layouts/Landing.astro'), 'utf8');
    expect(landing).toContain('<AnnouncementStrip');
    expect(landing).toContain('<strong>{STRIP.strong}</strong>');
    expect(landing).toContain('#founding');
    expect(page).toContain('id="founding"');
    for (const app of ['Layout.astro']) expect(readFileSync(join(ROOT, `apps/docs-site/src/layouts/${app}`), 'utf8')).not.toContain('AnnouncementStrip');
  });

  it('the founding title as drawn reads exactly the title, with "free" apart for the blue', () => {
    expect(pricing.HOME_FOUNDING.titleLead + pricing.HOME_FOUNDING.titleAccent + pricing.HOME_FOUNDING.titleEnd).toBe(pricing.HOME_FOUNDING.title);
    expect(pricing.HOME_FOUNDING.titleAccent).toBe('free');
  });
});
