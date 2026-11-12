import { describe, expect, it } from 'vitest';
import type { ProductConfig } from '@bridge-ds/core';
import { buildOriginLine, buildOriginOf, withBuildOrigins, type OriginRow } from './build-origin';
import { personLine } from './building-page';
import { sentByOf } from './building-view';

const products: ProductConfig[] = [
  { key: 'library', name: 'Library', path: 'packages', default: true },
  { key: 'crm', name: 'Acme CRM', repo: 'acme-design-demo/acme-crm', design: { repo: 'acme-design-demo/acme-crm-design' } },
] as unknown as ProductConfig[];

const issue = (n: number): OriginRow => ({ kind: 'issue', number: n, pull: null });
const issueWithPull = (n: number, pull: number): OriginRow => ({ kind: 'issue', number: n, pull: { number: pull, state: 'open' } });

const request = (extra = '') => `## Request\n\n<!-- bridge-request {"component":"Table","kind":"prop-change","title":"Keep the header visible on scroll","source":"mcp"${extra}} -->\n\nRequested by Leo through Bridge.`;

describe('buildOriginOf: build work only comes from the lead', () => {
  it('a request a designer, developer or PM filed directly has no origin', () => {
    expect(buildOriginOf(issue(59), { issues: [{ number: 59, body: request(), labels: ['component-change'] }] })).toBeNull();
  });

  it('a library change the lead approved in Library review', () => {
    const body = `${request()}\n<!-- bridge-origin {"kind":"lead","approvedBy":"Dana Lee"} -->`;
    const o = buildOriginOf(issue(59), { issues: [{ number: 59, body }] });
    expect(o).toEqual({ kind: 'library', via: 'review', approvedBy: 'Dana' });
    expect(buildOriginLine(o!)).toBe('Library change Dana approved');
  });

  it('the lead approval can sit in the request block itself', () => {
    const o = buildOriginOf(issue(59), { issues: [{ number: 59, body: request(',"origin":{"kind":"lead","approvedBy":"Dana"}') }] });
    expect(buildOriginLine(o!)).toBe('Library change Dana approved');
  });

  it('a library piece an exploration needs, stated on the request', () => {
    const body = request(',"origin":{"kind":"exploration","repo":"acme-design-demo/acme-crm-design","number":2,"product":"crm","name":"Contact page summary"}');
    const o = buildOriginOf(issue(52), { issues: [{ number: 52, body }], products });
    expect(o).toMatchObject({ kind: 'exploration', self: false, name: 'Contact page summary', product: 'Acme CRM' });
    expect(buildOriginLine(o!)).toBe('From Contact page summary');
  });

  it('reads the "Needed by" block of the pull request that does the work when the issue says nothing', () => {
    const pull = {
      number: 62,
      body: 'Closes #52\n\n<!-- bridge-needed-by {"pr": 2, "title": "Contact page summary", "branch": "explore/contact-page-summary", "product": "crm", "productName": "Acme CRM", "piece": "component-profile-header", "pieceTitle": "New component: ProfileHeader", "repo": "acme-design-demo/acme-crm-design"} -->',
    };
    const o = buildOriginOf(issueWithPull(52, 62), { issues: [{ number: 52, body: request() }], pulls: [pull], products });
    expect(buildOriginLine(o!)).toBe('From Contact page summary');
  });

  it("never reads a product repository's pull request as the design system's", () => {
    const pull = { number: 62, product: 'crm', body: '<!-- bridge-origin {"kind":"lead","approvedBy":"Dana"} -->' };
    expect(buildOriginOf(issueWithPull(52, 62), { issues: [{ number: 52, body: request() }], pulls: [pull] })).toBeNull();
  });

  it('a push from Figma is approved in Figma', () => {
    const o = buildOriginOf(issue(80), { issues: [{ number: 80, body: request(), labels: ['component-change', 'bridge-build', 'source: figma'] }] });
    expect(buildOriginLine(o!)).toBe('Library change approved in Figma');
    expect(buildOriginLine(buildOriginOf({ kind: 'pull', number: 3, pull: null, fix: {} })!)).toBe('Library change approved in Figma');
  });

  it('a group of an adoption report the lead sent', () => {
    const o = buildOriginOf(issue(90), { issues: [{ number: 90, body: request(',"origin":{"kind":"audit","product":"crm","run":"r1","group":"buttons","name":"Buttons"}') }], products });
    expect(buildOriginLine(o!)).toBe('From the Acme CRM adoption report');
  });

  it('an exploration handed to developers is its own origin, named by the lead who sent it', () => {
    expect(buildOriginLine(buildOriginOf({ kind: 'pull', number: 3, pull: null, exploration: { sentBy: 'Dana' } })!)).toBe('Exploration Dana sent');
    expect(buildOriginLine(buildOriginOf({ kind: 'pull', number: 3, pull: null, exploration: {} })!)).toBe('Exploration sent to developers');
  });
});

describe('withBuildOrigins', () => {
  it('keeps only the rows with an origin, each carrying it, so every count reads the same rows', () => {
    const issues = [
      { number: 58, body: request() },
      { number: 59, body: `${request()}\n<!-- bridge-origin {"kind":"lead","approvedBy":"Dana"} -->` },
    ];
    const rows = withBuildOrigins([issue(58), issue(59), { kind: 'pull' as const, number: 2, pull: null, exploration: { sentBy: 'Dana' } }], { issues });
    expect(rows.map((r) => r.number)).toEqual([59, 2]);
    expect(rows[0]!.origin).toEqual({ kind: 'library', via: 'review', approvedBy: 'Dana' });
  });
});

describe('personLine with an origin', () => {
  it('says where it comes from instead of who asked', () => {
    expect(personLine({ state: 'waiting', builders: [], requester: 'Leo', origin: 'Library change Dana approved' })).toBe('Library change Dana approved');
    expect(personLine({ state: 'shipped', builders: [], requester: 'Ann', origin: 'Exploration Dana sent' })).toBe('Exploration Dana sent');
    expect(personLine({ state: 'in-progress', builders: ['Malik'], requester: null, origin: 'From Contact page summary' })).toBe('Malik builds it');
  });
});

describe('sentByOf', () => {
  it("names the latest Looks right, else the lead's login", () => {
    expect(sentByOf({ decisions: [{ kind: 'looks-right', at: '2026-11-08', round: 1, byName: 'Dana' }] })).toBe('Dana');
    expect(sentByOf({ decisions: [{ kind: 'question', at: '2026-11-08', round: 1, byName: 'Sofia' }] })).toBeNull();
    expect(sentByOf({ designOkBy: 'dana-gh' }, (l) => (l === 'dana-gh' ? 'Dana Lee' : l))).toBe('Dana');
    expect(sentByOf(null)).toBeNull();
  });
});
