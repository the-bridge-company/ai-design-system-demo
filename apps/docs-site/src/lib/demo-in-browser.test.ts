// The sample team's actions that run in this browser (C6). Looks right moves the exploration on exactly as the real
// approval (core designApproveOnGitHub, two-reviews) would: Ready to build when nothing waits on the library, else In
// review on the library decision (Dana's own, when she holds both hats). Every read of the sample team's pull requests
// answers with that copy until the visitor leaves. Start an exploration is kept for the visit. The sample team's own
// flows (demo-in-browser.flows.json, as its repositories hold them) are replayed too.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decisionsOf, EXPLORATION_LABEL, EXPLORATION_READY_LABEL, explorationPrBody, explorationStatus, isInReview, parseExplorationBody, withLeadAsked, withLibraryAsked, withPiecesRecord, type MissingPiece } from '@bridge-ds/core';
import { keepSampleAnswer, keepSampleProduct, keepSampleStart, sampleLooksRight, sampleProducts, sampleRead, sampleStarts } from './demo-in-browser';
import { sampleFoundLine } from './add-product';
import { DEMO_VISIT_KEY, DEMO_WORDS, runsInBrowser, sampleStartLines, swapDemoDrafts } from './demo';
import { SAMPLE_REVIEWS, viewerHats, viewerIds, waitingLineOf, type TeamReviews } from './team-reviews';
import { rowTime, turnSince } from './lead-decisions';

function memory() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
  };
}

const REPO = 'acme-design-demo/bridge-demo-ds';
const DANA = 'a399f73add3dbb2d';
const SOFIA = '0406ec723c59bb8d';
const LEO = 'af419771c6f4d96f';
const team: TeamReviews = {
  designReview: SAMPLE_REVIEWS,
  members: [
    { name: 'Dana', ref: DANA, role: 'admin', libraryOwner: true },
    { name: 'Sofia', ref: SOFIA, role: 'edit' },
    { name: 'Leo', ref: LEO, role: 'edit' },
  ],
  githubOwners: [],
  products: [
    { key: 'prints', name: 'Acme Prints' },
    { key: 'crm', name: 'Acme CRM' },
  ],
};
const timeline: MissingPiece = { id: 'component-timeline', kind: 'component', title: 'New component: Timeline', summary: 'New.', name: 'Timeline', component: 'Timeline', values: [], where: [] };
const started = (member: string, pieces: MissingPiece[]) =>
  withPiecesRecord(explorationPrBody({ name: 'X', purpose: '', slug: 'x', author: 'sofia' }, { owner: 'acme-design-demo', repo: 'bridge-demo-ds', packages: [], apps: {} }).replace('"slug":"x"', `"slug":"x","member":"${member}"`), { checkedAt: 't', pieces, links: [] });
const pull = (body: string, number = 7) => ({ number, state: 'open', draft: true, body, labels: [{ name: EXPLORATION_LABEL }], head: { ref: 'explore/x', sha: 'abc' } });
const statusOf = (p: { body: string; labels: string[] }) => explorationStatus({ state: 'open', draft: true, body: p.body, labels: p.labels, headRef: 'explore/x', headSha: 'abc' });
const AT = new Date('2026-11-12T11:00:00Z');
const ASKED_AT = '2026-11-12T10:00:00.000Z';

describe('Looks right on the sample team, as the real approval', () => {
  it("Leo's screen, nothing new for the library: Ready to build at once, labels swapped, off Dana's queue", () => {
    const asked = withLeadAsked(started(LEO, []), { at: ASKED_AT, byName: 'Leo' });
    expect(viewerHats(asked, { team, product: 'crm', viewer: viewerIds(null, DANA) })).toEqual(['design-review']);
    const a = sampleLooksRight(pull(asked), { byName: 'Dana', at: AT })!;
    expect(a.ready).toBe(true);
    expect(a.labels).toEqual([EXPLORATION_READY_LABEL]);
    expect(statusOf(a)).toBe('ready');
    expect(isInReview(a.body)).toBe(false);
    expect(parseExplorationBody(a.body)?.doneAt).toBe(AT.toISOString());
    expect(decisionsOf(parseExplorationBody(a.body)!).at(-1)).toMatchObject({ kind: 'looks-right', hat: 'design', byName: 'Dana' });
    // Home and the rail badge read the hats: none asks Dana any more, nothing waits.
    expect(viewerHats(a.body, { team, product: 'crm', viewer: viewerIds(null, DANA) })).toEqual([]);
    expect(waitingLineOf(a.body, { team, product: 'crm' })).toBeNull();
    // Answered: nothing to say twice.
    expect(sampleLooksRight(pull(a.body), { byName: 'Dana' })).toBeNull();
  });

  it("Sofia's Timeline, a new piece: still In review, now on Dana's library decision (she holds both hats)", () => {
    const asked = withLibraryAsked(withLeadAsked(started(SOFIA, [timeline]), { at: ASKED_AT, byName: 'Sofia' }), { at: ASKED_AT });
    expect(viewerHats(asked, { team, product: 'prints', viewer: viewerIds(null, DANA) })).toEqual(['design-review', 'library']);
    const a = sampleLooksRight(pull(asked), { byName: 'Dana', at: AT })!;
    expect(a.ready).toBe(false);
    expect(a.libraryPending).toEqual(['component-timeline']);
    expect(a.labels).toEqual([EXPLORATION_LABEL]);
    expect(isInReview(a.body)).toBe(true);
    expect(statusOf(a)).toBe('active');
    expect(viewerHats(a.body, { team, product: 'prints', viewer: viewerIds(null, DANA) })).toEqual(['library']);
    expect(waitingLineOf(a.body, { team, product: 'prints' })).toBe("Waiting for Dana's library decision on Timeline");
  });

  it('every read of the sample team answers with the copy kept for the visit, dropped once the visitor leaves', () => {
    const store = memory();
    const asked = withLeadAsked(started(LEO, []), { at: ASKED_AT, byName: 'Leo' });
    const read = [pull(asked), pull(asked, 8)];
    expect(sampleRead(store, `/repos/${REPO}/pulls?state=open&per_page=100`, read)).toBe(read);
    swapDemoDrafts(store, true);
    const a = sampleLooksRight(pull(asked), { byName: 'Dana', at: AT })!;
    keepSampleAnswer(store, REPO, 7, a);
    const list = sampleRead(store, `https://api.github.com/repos/${REPO}/pulls?state=open&per_page=100`, read);
    expect(list[0]).toMatchObject({ number: 7, body: a.body, labels: [{ name: EXPLORATION_READY_LABEL }] });
    expect(list[1]).toBe(read[1]);
    expect(sampleRead(store, `/repos/${REPO}/pulls/7`, pull(asked)).body).toBe(a.body);
    expect(sampleRead(store, `/repos/${REPO}/pulls/8`, pull(asked, 8)).body).toBe(asked);
    // Another repository, or another kind of read, is never touched.
    expect(sampleRead(store, '/repos/acme/ds/pulls/7', pull(asked)).body).toBe(asked);
    expect(sampleRead(store, `/repos/${REPO}/issues/7`, pull(asked)).body).toBe(asked);
    // The read itself is never changed in place.
    expect(read[0]!.body).toBe(asked);
    swapDemoDrafts(store, false);
    expect(store.getItem(DEMO_VISIT_KEY)).toBeNull();
    expect(sampleRead(store, `/repos/${REPO}/pulls/7`, pull(asked)).body).toBe(asked);
  });
});

describe('Start an exploration on the sample team', () => {
  it('is kept for the visit, newest first, and says what Claude AI does on a real team', () => {
    const store = memory();
    keepSampleStart(store, { name: 'Dark checkout', where: 'Acme Prints', sentence: 'dark checkout' }, new Date('2026-11-12T10:00:00Z'));
    keepSampleStart(store, { name: 'Bigger cards', where: 'Acme CRM', sentence: 'bigger cards' }, new Date('2026-11-12T11:00:00Z'));
    expect(sampleStarts(store).map((s) => s.name)).toEqual(['Bigger cards', 'Dark checkout']);
    const words = sampleStartLines('Bigger cards', 'Acme CRM');
    expect(words.line).toBe('Bigger cards is a new exploration in Acme CRM. On the sample team it stays in this browser.');
    expect(words.next).toContain('Claude AI');
    expect(`${words.line} ${words.next}`).not.toMatch(/—/);
  });
});

describe('Add a product on the sample team: kept for the visit', () => {
  it('keeps the entry a page needs (key, name, address), replaces the same key, and drops it when the visit ends', () => {
    const store = memory();
    swapDemoDrafts(store, true);
    keepSampleProduct(store, { key: 'atlas', name: 'Atlas' });
    keepSampleProduct(store, { key: 'kiosk', name: 'Kiosk', address: 'https://kiosk.example.com' });
    keepSampleProduct(store, { key: 'atlas', name: 'Atlas app' });
    expect(sampleProducts(store)).toEqual([
      { key: 'kiosk', name: 'Kiosk', address: 'https://kiosk.example.com', framework: 'react' },
      { key: 'atlas', name: 'Atlas app', framework: 'react' },
    ]);
    // Leaving the sample team drops it with the other sample drafts: nothing outlives the visit.
    expect(swapDemoDrafts(store, false)).toBe('left');
    expect(sampleProducts(store)).toEqual([]);
  });

  it('ignores a broken or foreign copy, and says once that it stays in this browser, in the Bridge voice', () => {
    const store = memory();
    store.setItem('bridge.acme-design-demo/bridge-demo-ds.draft.products', '[{"key":"../x","name":"X"},{"key":"ok","name":" "},"nope",{"key":"fine","name":"Fine"}]');
    expect(sampleProducts(store)).toEqual([{ key: 'fine', name: 'Fine' }]);
    store.setItem('bridge.acme-design-demo/bridge-demo-ds.draft.products', '{oops');
    expect(sampleProducts(store)).toEqual([]);
    for (const line of [DEMO_WORDS.sampleProduct, sampleFoundLine]) {
      expect(line).not.toMatch(/\u2014|repo|fork|pull request|branch/i);
      expect(line).toMatch(/^[A-Z].*\.$/);
    }
  });
});

describe('which actions run in this browser', () => {
  it('Start an exploration and Looks right on the sample team only; every other write keeps the dialog', () => {
    expect(runsInBrowser(REPO, 'start explorations')).toBe(true);
    expect(runsInBrowser(REPO, 'Start an exploration')).toBe(true);
    expect(runsInBrowser(REPO, 'say the design looks right')).toBe(true);
    expect(runsInBrowser(REPO, 'Add a product')).toBe(true);
    expect(runsInBrowser(REPO, 'add products')).toBe(true);
    expect(runsInBrowser(REPO, 'send to Figma')).toBe(false);
    expect(runsInBrowser(REPO, 'invite')).toBe(false);
    expect(runsInBrowser(REPO, null)).toBe(false);
    // Bridge's own design system is real: its writes never run in the browser.
    expect(runsInBrowser('the-bridge-company/ai-design-system-demo', 'start explorations')).toBe(false);
    expect(runsInBrowser('acme/ds', 'say the design looks right')).toBe(false);
    expect(runsInBrowser('acme/ds', 'add a product')).toBe(false);
  });
});

// The sample team's own explorations as its repositories hold them (asked before the two reviews: one ask to the lead,
// no library ask on record), so these tests follow the flows a visitor clicks through.
type Flow = { number: number; repo: string; head: { ref: string; sha: string }; labels: string[]; body: string };
const FLOWS = JSON.parse(readFileSync(new URL('./demo-in-browser.flows.json', import.meta.url), 'utf8')) as Record<'deal' | 'order', Flow>;
const flowPull = (f: Flow) => ({ number: f.number, state: 'open', draft: true, body: f.body, labels: f.labels.map((name) => ({ name })), head: f.head, base: { repo: { full_name: f.repo } } });

describe("the sample team's flows: Looks right never skips Dana's library decision", () => {
  it('Deal pipeline cards: its Card restyle uses the library as is (Card at 12px is Compact), so no library decision waits in any list and Looks right hands it off', () => {
    const p = flowPull(FLOWS.deal);
    // Every list reads it the same before the answer: only Dana's design review waits.
    expect(viewerHats(p.body, { team, product: 'crm', viewer: viewerIds(null, DANA) })).toEqual(['design-review']);
    expect(waitingLineOf(p.body, { team, product: 'crm' })).toBe("Waiting for Dana's design review");
    const a = sampleLooksRight(p, { byName: 'Dana', at: AT })!;
    expect(a.ready).toBe(true);
    expect(explorationStatus({ state: 'open', draft: true, body: a.body, labels: a.labels, headRef: FLOWS.deal.head.ref, headSha: FLOWS.deal.head.sha })).toBe('ready');
    // Still no library piece decided by it.
    expect(parseExplorationBody(a.body)?.library?.decisions ?? []).toEqual([]);
  });

  it('Order fulfilment timeline: both pieces stay undecided; Looks right decides no library piece', () => {
    const p = flowPull(FLOWS.order);
    const a = sampleLooksRight(p, { byName: 'Dana', at: AT })!;
    expect(a.ready).toBe(false);
    expect(a.libraryPending).toEqual(['card-timeline-restyle', 'component-timeline']);
    const e = parseExplorationBody(a.body)!;
    expect(e.library?.decisions ?? []).toEqual([]);
    expect(e.library?.askedAt).toBe(parseExplorationBody(p.body)?.designAskedAt);
    expect(decisionsOf(e).filter((d) => d.at === AT.toISOString())).toEqual([expect.objectContaining({ kind: 'looks-right', hat: 'design', byName: 'Dana' })]);
    expect(viewerHats(a.body, { team, product: 'prints', viewer: viewerIds(null, DANA) })).toEqual(['library']);
    expect(waitingLineOf(a.body, { team, product: 'prints' })).toContain('Timeline');
    // Home's age tag keeps the clock of the ask (days ago), never "New today" for the hand-over to the library hat.
    expect(turnSince(a.body)).toBe(parseExplorationBody(p.body)?.designAskedAt);
    // The Explorations list row ("Waiting for your library decision") says the same as Home, not Sofia's last change.
    const asked = parseExplorationBody(p.body)!.designAskedAt!;
    const fiveDaysOn = Date.parse(asked) + 5 * 24 * 60 * 60 * 1000;
    const line = waitingLineOf(a.body, { team, product: 'prints', viewer: viewerIds(null, DANA) });
    expect(line).toMatch(/^Waiting for your library decision/);
    // Said once: "Sofia · Waiting for your library decision on ... · 5 days".
    expect(rowTime({ body: a.body, updated: new Date(fiveDaysOn - 24 * 60 * 60 * 1000).toISOString(), waitsOnViewer: true, now: fiveDaysOn, line }, () => 'yesterday')).toBe('5 days');
  });

  it('the Explorations list reads the same kept copy as the page and Being built, from any read of the product', () => {
    const store = memory();
    swapDemoDrafts(store, true);
    const p = flowPull(FLOWS.order);
    const a = sampleLooksRight(p, { byName: 'Dana', at: AT })!;
    keepSampleAnswer(store, FLOWS.order.repo, p.number, a);
    // The product's own list read (product-repos readProductPulls), the single read, any case.
    const list = sampleRead(store, `/repos/${FLOWS.order.repo}/pulls?state=open&per_page=100`, [p]);
    expect(list[0]!.body).toBe(a.body);
    expect(sampleRead(store, `/repos/${FLOWS.order.repo}/pulls/${p.number}`, p).body).toBe(a.body);
    expect(sampleRead(store, `/repos/ACME-DESIGN-DEMO/acme-prints-design/pulls/${p.number}`, p).body).toBe(a.body);
    // Same number in another repository (Deal pipeline cards is #1 too): untouched.
    const deal = flowPull(FLOWS.deal);
    expect(sampleRead(store, `/repos/${FLOWS.deal.repo}/pulls?state=open&per_page=100`, [deal])[0]!.body).toBe(deal.body);
    // Every reader agrees: the row still waits on Dana, for her library decision only (Waiting on you, the badge).
    expect(viewerHats(list[0]!.body, { team, product: 'prints', viewer: viewerIds(null, DANA) })).toEqual(['library']);
  });
});
