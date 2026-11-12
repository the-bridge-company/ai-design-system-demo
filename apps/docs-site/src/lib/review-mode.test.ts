import { describe, expect, it, vi } from 'vitest';
import { asksAnyReview, asksDesignReview, asksLibrary, decidesOnExplorations, needsReview, type DesignReviewMap } from '../../api/_lib/review-settings';
import { memberRef } from '../../api/_lib/exploration-member';
import { addsLeadWords } from '../../api/_lib/lead-gate';
import { GUARD_COMMENT, guardCaseOf, runLeadGuard, senderDecides } from '../../api/_lib/lead-guard';
import { pmGateStop } from '../scripts/exploration-done';
import type { ReviewsAsked } from '@bridge-ds/core';

// Two reviews (docs/specs/two-reviews.md): who is asked what, replacing the one review mode (one | shared |
// shared-none) with the library decision and each product's design review.
const who = (email: string, role: 'view' | 'edit' | 'admin', extra: { libraryOwner?: boolean; lead?: boolean } = {}) => ({ email, role, ...extra });
const owner = who('dana@acme.example', 'admin', { libraryOwner: true });
const designer = who('leo@acme.example', 'edit');
const viewer = who('vic@acme.example', 'view');
const admin = who('sam@acme.example', 'admin');
const named: DesignReviewMap = { '*': { on: true, reviewers: [memberRef('leo@acme.example')] }, library: { on: false } };
const anyDesigner: DesignReviewMap = { '*': { on: true, reviewers: 'any-designer' } };
const off: DesignReviewMap = { '*': { on: false } };

describe('who is asked which review', () => {
  it('the library decision: library owners (an older lead too), never a designer for that alone', () => {
    expect(asksLibrary(owner, off)).toBe(true);
    expect(asksLibrary(who('old@acme.example', 'edit', { lead: true }), off)).toBe(true);
    expect(asksLibrary(designer, named)).toBe(false);
  });
  it("the design review: the product's named reviewers, or every designer for Any designer, never a viewer", () => {
    expect(asksDesignReview(designer, 'crm', named)).toBe(true);
    expect(asksDesignReview(designer, 'library', named)).toBe(false);
    expect(asksDesignReview(designer, 'crm', anyDesigner)).toBe(true);
    expect(asksDesignReview(viewer, 'crm', anyDesigner)).toBe(false);
    expect(asksDesignReview(designer, 'crm', off)).toBe(false);
  });
  it('an admin may answer either review and is never asked', () => {
    expect(asksAnyReview(admin, named)).toBe(false);
    expect(decidesOnExplorations(admin, named)).toBe(true);
    expect(decidesOnExplorations(designer, off)).toBe(false);
    expect(decidesOnExplorations(designer, named)).toBe(true);
  });
  it('a review exists when someone other than the author is asked one', () => {
    expect(needsReview({ map: off, designOwners: 0, members: [designer] })).toBe(false);
    expect(needsReview({ map: off, designOwners: 0, members: [owner] })).toBe(true);
    expect(needsReview({ map: off, designOwners: 1, members: [] })).toBe(true);
    expect(needsReview({ map: off, designOwners: 0, members: [admin] })).toBe(false);
    expect(needsReview({ map: anyDesigner, designOwners: 0, members: [designer] })).toBe(true);
  });
  it("I'll look is a reviewer's word", () => {
    const b = (e: Record<string, unknown>) =>
      `x\n<!-- bridge-exploration ${JSON.stringify({
        name: 'Orders',
        designAskedAt: 'a',
        ...e,
      })} -->`;
    expect(
      addsLeadWords(b({}), b({ designTakenAt: 't', designTakenByName: 'Ann' }), {
        hasLeads: true,
      }),
    ).toBe(true);
  });
});

const edit = (
  e: {
    sender?: Record<string, unknown>;
    before?: Record<string, unknown>;
    after?: Record<string, unknown>;
  } = {},
) => ({
  action: 'edited',
  repository: { full_name: 'Acme/Shop-Design' },
  sender: { login: 'Dev', type: 'User', ...e.sender },
  changes: {
    body: {
      from: `x\n<!-- bridge-exploration ${JSON.stringify({
        name: 'Orders',
        designAskedAt: 'a',
        author: 'ann',
        ...e.before,
      })} -->`,
    },
  },
  pull_request: {
    number: 7,
    user: { login: 'ann' },
    body: `x\n<!-- bridge-exploration ${JSON.stringify({
      name: 'Orders',
      designAskedAt: 'a',
      author: 'ann',
      ...(e.after ?? {
        decisions: [{ kind: 'looks-right', at: 't', round: 1, by: 'dev' }],
      }),
    })} -->`,
  },
});

describe('the lead guard on GitHub edits', () => {
  it('looks at a person adding a lead word, never at a bot or a plain edit', () => {
    expect(guardCaseOf('pull_request', edit())).toMatchObject({
      repo: 'acme/shop-design',
      number: 7,
      sender: 'dev',
      authors: ['ann'],
    });
    expect(guardCaseOf('pull_request', edit({ sender: { type: 'Bot' } }))).toBeNull();
    expect(guardCaseOf('pull_request', edit({ after: { reopenedAt: 'y' } }))).toBeNull();
    expect(guardCaseOf('issues', edit())).toBeNull();
  });
  it('a design owner or an admin may decide, never on their own exploration', () => {
    const g = guardCaseOf('pull_request', edit())!;
    expect(senderDecides(g, { designOwners: ['@Dev'], admin: false })).toBe(true);
    expect(senderDecides(g, { designOwners: [], admin: true })).toBe(true);
    expect(senderDecides(g, { designOwners: [], admin: false })).toBe(false);
    expect(senderDecides({ ...g, sender: 'ann' }, { designOwners: ['ann'], admin: true })).toBe(false);
  });
  it('puts the description back and says why once', async () => {
    const call = vi.fn(async (_repo: string, method: string, _path: string, _body?: unknown) => (method === 'GET' ? { status: 200, data: { permission: 'write' } } : { status: 200, data: {} }));
    expect(
      await runLeadGuard('pull_request', edit(), {
        call,
        designOwners: async () => ['flo'],
      }),
    ).toBe(true);
    const patch = call.mock.calls.find((c) => c[1] === 'PATCH')!;
    expect(patch[2]).toBe('/repos/acme/shop-design/pulls/7');
    expect((patch[3] as { body: string }).body).toContain('"author":"ann"');
    expect((patch[3] as { body: string }).body).not.toContain('looks-right');
    expect(call.mock.calls.find((c) => c[1] === 'POST')![3]).toEqual({
      body: `@dev ${GUARD_COMMENT}`,
    });
  });
  it('leaves an admin or a design owner alone', async () => {
    const call = vi.fn(async () => ({
      status: 200,
      data: { permission: 'admin' },
    }));
    expect(
      await runLeadGuard('pull_request', edit(), {
        call,
        designOwners: async () => [],
      }),
    ).toBe(false);
    expect(call).toHaveBeenCalledTimes(1);
  });
});

describe('the PM gate at Done exploring', () => {
  const pms = { shop: { name: 'Dino', ref: 'cccccccccccccccc' } };
  const said = (kind: string) => `x\n<!-- bridge-exploration ${JSON.stringify({ name: 'Orders', decisions: [{ kind, at: 't', round: 1, byName: 'Dino' }] })} -->`;
  const noDesign: ReviewsAsked = { design: null, library: null, noDesign: 'off' };
  const withDesign: ReviewsAsked = { design: { reviewers: [{ id: 'member:dddddddddddddddd', name: 'Dana' }] }, library: null };
  const libraryOnly: ReviewsAsked = { design: null, library: { owners: [{ id: 'flo', name: 'Flo' }], pieces: ['x'] }, noDesign: 'off' };
  it('no design review: the PM says it looks good first; a product with no PM goes on', () => {
    const review = { pms };
    expect(pmGateStop({ review, asked: noDesign, product: 'shop', body: 'x' })).toMatch(/Dino says it looks good/);
    expect(pmGateStop({ review, asked: noDesign, product: 'shop', body: said('pm-changes') })).toMatch(/Dino asked for changes/);
    expect(pmGateStop({ review, asked: noDesign, product: 'shop', body: said('pm-ok') })).toBeNull();
    expect(pmGateStop({ review, asked: noDesign, product: 'shop', body: said('pm-call') })).toBeNull();
    expect(pmGateStop({ review, asked: noDesign, product: 'other', body: 'x' })).toBeNull();
  });
  it('a library decision alone does not stand for the design review; a design review does', () => {
    expect(pmGateStop({ review: { pms }, asked: libraryOnly, product: 'shop', body: 'x' })).not.toBeNull();
    expect(pmGateStop({ review: { pms }, asked: withDesign, product: 'shop', body: 'x' })).toBeNull();
    // A design review already given in an earlier round stands.
    const ok = `x\n<!-- bridge-exploration ${JSON.stringify({ name: 'Orders', designOkAt: 't' })} -->`;
    expect(pmGateStop({ review: { pms }, asked: noDesign, product: 'shop', body: ok })).toBeNull();
  });
});

describe("I'll look on the other reviewers' Home", () => {
  it('leaves their Home, and comes back 2 days later with no decision', async () => {
    const { leadHomeRow, TAKEN_FOR_MS } = await import('./lead-decisions');
    const at = Date.parse('2026-11-07T10:00:00Z');
    const body = `x\n<!-- bridge-exploration ${JSON.stringify({ name: 'Orders', designAskedAt: '2026-11-07T09:00:00Z', designAskedByName: 'Ann', designTakenAt: new Date(at).toISOString(), designTakenByName: 'Lea' })} -->`;
    const v = { viewer: null, lead: true, own: false, viewerName: 'Dino' };
    expect(leadHomeRow(body, { ...v, now: at + 1000 })).toBeNull();
    expect(leadHomeRow(body, { ...v, viewerName: 'Lea', now: at + 1000 })).not.toBeNull();
    expect(leadHomeRow(body, { ...v, now: at + TAKEN_FOR_MS + 1000 })).not.toBeNull();
  });
});
