import { describe, expect, it } from 'vitest';
import { isDesignLead, leadsLibrary, type LeadViewer } from './design-lead';
import { contributorAccess } from './access';
import { emptyProductLine } from './product-page';
import { startTargets } from './create-branch';
import { moreNeedsAction } from './home-model';
import type { ProductConfig } from '@bridge-ds/core';

const PRODUCTS: ProductConfig[] = [
  { key: 'admin', name: 'Admin demo', path: 'apps/admin' },
  { key: 'library', name: 'Library', path: 'packages', default: true },
];
const LIBRARY = PRODUCTS[1]!;

// The two leads of the bug: the founder on his own team (a GitHub admin and design owner), and Dana on the sample team
// (an email member, admin and marked lead; every signed-out visitor reads as her).
const githubLead: LeadViewer & { techOwners: string[] } = { access: { state: 'admin', write: true, admin: true } as never, member: null, login: 'peterbono', designOwners: ['@peterbono'], techOwners: [] };
const emailLead: LeadViewer = { access: contributorAccess(true), member: { role: 'admin', lead: true }, login: null, designOwners: ['@peterbono'] };

/** What each Studio page reads from "is this viewer a design lead". */
const views = (v: LeadViewer) => {
  const lead = isDesignLead(v);
  const library = leadsLibrary(v);
  return {
    // Explorations (the library's page): the empty line and the start action's targets.
    explorations: emptyProductLine(LIBRARY, true, library),
    start: startTargets(PRODUCTS, { library }).map((t) => t.value),
    // Home: the lead's home (Review all), never the contributor's (See all, theirs only).
    home: moreNeedsAction(!lead),
  };
};

describe('one rule for a design lead, by email or by GitHub', () => {
  it('reads both leads of the bug as leads', () => {
    expect(isDesignLead(githubLead)).toBe(true);
    expect(isDesignLead(emailLead)).toBe(true);
    expect(leadsLibrary(githubLead)).toBe(true);
    expect(leadsLibrary(emailLead)).toBe(true);
  });

  it('gives a lead by email and a lead by GitHub the same view on every page', () => {
    expect(views(emailLead)).toEqual(views(githubLead));
    expect(views(emailLead).explorations).toMatch(/^Try a token, a variant or a new component with Claude AI/);
    expect(views(emailLead).start).toContain('library');
    expect(views(emailLead).home).toEqual({ label: 'Review all', path: 'review/' });
  });

  it('reads an email member marked lead as a lead, and a GitHub design owner who is not an admin too', () => {
    const ann: LeadViewer = { access: contributorAccess(false), member: { role: 'edit', lead: true } };
    const owner: LeadViewer = { access: { write: true, admin: false }, login: 'Ann-GH', designOwners: ['@ann-gh'] };
    expect(isDesignLead(ann)).toBe(true);
    expect(isDesignLead(owner)).toBe(true);
    expect(views(ann)).toEqual(views(owner));
    expect(views(ann)).toEqual(views(githubLead));
  });

  it('keeps designers out, by email and by GitHub alike', () => {
    const leo: LeadViewer = { access: contributorAccess(false), member: { role: 'edit' } };
    const designer: LeadViewer = { access: { write: true, admin: false }, login: 'leo-gh', designOwners: ['@peterbono'] };
    const viewer: LeadViewer = { access: contributorAccess(false, true), member: { role: 'view' } };
    for (const v of [leo, designer, viewer]) {
      expect(isDesignLead(v)).toBe(false);
      expect(leadsLibrary(v)).toBe(false);
      expect(views(v).explorations).toBe('The library your products use. Leads change it, so ask them for what you need.');
      expect(views(v).start).not.toContain('library');
      expect(views(v).home.label).toBe('See all');
    }
    expect(views(leo)).toEqual(views(designer));
    expect(isDesignLead({ access: null, login: 'peterbono', designOwners: ['peterbono'] })).toBe(false);
  });

  it('lets a GitHub tech owner or override holder who may write change the library, never an email member', () => {
    expect(leadsLibrary({ access: { write: true }, login: 'dev', techOwners: ['@dev'] })).toBe(true);
    expect(leadsLibrary({ access: { write: true }, login: 'dev', overrideAllowed: ['dev'] })).toBe(true);
    expect(leadsLibrary({ access: { write: false }, login: 'dev', techOwners: ['@dev'] })).toBe(false);
    expect(isDesignLead({ access: { write: true }, login: 'dev', designOwners: ['@lead'], techOwners: ['@dev'] } as LeadViewer)).toBe(false);
    // A team that names no design owner yet: anyone who may write leads, as anyone who may write reviews then.
    expect(isDesignLead({ access: { write: true }, login: 'dev', designOwners: [] })).toBe(true);
    expect(isDesignLead({ access: { write: false }, login: 'dev', designOwners: [] })).toBe(false);
    expect(leadsLibrary({ access: contributorAccess(false), member: { role: 'edit' }, login: 'dev', techOwners: ['dev'] })).toBe(false);
  });
});
