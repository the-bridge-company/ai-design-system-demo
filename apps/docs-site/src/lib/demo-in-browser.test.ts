// The sample team's actions that run in this browser (C6): Looks right paints from a copy kept here, Start an
// exploration is kept here; both under keys swapDemoDrafts drops once the visitor leaves the sample team.
import { describe, expect, it } from 'vitest';
import { decisionsOf, explorationPrBody, isDesignReviewWaiting, parseExplorationBody, withLeadAsked } from '@bridge-ds/core';
import { keepSampleAnswer, keepSampleStart, sampleBodyOf, sampleLooksRightBody, sampleStarts } from './demo-in-browser';
import { DEMO_VISIT_KEY, runsInBrowser, sampleStartLines, swapDemoDrafts } from './demo';

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

const asked = withLeadAsked(explorationPrBody({ name: 'Timeline', purpose: '', slug: 'timeline', author: 'sofia' }, { owner: 'acme-design-demo', repo: 'bridge-demo-ds', packages: [], apps: {} }), { at: '2026-11-12T10:00:00.000Z', byName: 'Sofia' });

describe('Looks right on the sample team', () => {
  it('answers the design review in the description, said by Dana, as designApproveOnGitHub would', () => {
    const next = sampleLooksRightBody(asked, { byName: 'Dana', at: new Date('2026-11-12T11:00:00Z') })!;
    const e = parseExplorationBody(next);
    expect(isDesignReviewWaiting(parseExplorationBody(asked))).toBe(true);
    expect(isDesignReviewWaiting(e)).toBe(false);
    expect(decisionsOf(e!).at(-1)).toMatchObject({ kind: 'looks-right', hat: 'design', byName: 'Dana' });
    // Nothing waits any more: nothing to answer.
    expect(sampleLooksRightBody(next, { byName: 'Dana' })).toBeNull();
  });

  it('paints from the copy kept for the visit, dropped once the visitor leaves the sample team', () => {
    const store = memory();
    expect(sampleBodyOf(store, 7, asked)).toBe(asked);
    swapDemoDrafts(store, true);
    keepSampleAnswer(store, 7, 'answered');
    expect(sampleBodyOf(store, 7, asked)).toBe('answered');
    expect(sampleBodyOf(store, 8, asked)).toBe(asked);
    swapDemoDrafts(store, false);
    expect(store.getItem(DEMO_VISIT_KEY)).toBeNull();
    expect(sampleBodyOf(store, 7, asked)).toBe(asked);
  });
});

describe('Start an exploration on the sample team', () => {
  it('is kept for the visit, newest first, and says what Claude AI does on a real team', () => {
    const store = memory();
    keepSampleStart(store, { name: 'Dark checkout', where: 'Acme Prints', sentence: 'dark checkout' }, new Date('2026-11-12T10:00:00Z'));
    keepSampleStart(store, { name: 'Bigger cards', where: 'Acme CRM', sentence: 'bigger cards' }, new Date('2026-11-12T11:00:00Z'));
    expect(sampleStarts(store).map((s) => s.name)).toEqual(['Bigger cards', 'Dark checkout']);
    swapDemoDrafts(store, false);
    const words = sampleStartLines('Bigger cards', 'Acme CRM');
    expect(words.line).toBe('Bigger cards is a new exploration in Acme CRM. On the sample team it stays in this browser.');
    expect(words.next).toContain('Claude AI');
    expect(`${words.line} ${words.next}`).not.toMatch(/—/);
  });
});

describe('which actions run in this browser', () => {
  it('Start an exploration and Looks right on the sample team only; every other write keeps the dialog', () => {
    const sample = 'acme-design-demo/bridge-demo-ds';
    expect(runsInBrowser(sample, 'start explorations')).toBe(true);
    expect(runsInBrowser(sample, 'Start an exploration')).toBe(true);
    expect(runsInBrowser(sample, 'say the design looks right')).toBe(true);
    expect(runsInBrowser(sample, 'send to Figma')).toBe(false);
    expect(runsInBrowser(sample, 'invite')).toBe(false);
    expect(runsInBrowser(sample, null)).toBe(false);
    // Bridge's own design system is real: its writes never run in the browser.
    expect(runsInBrowser('the-bridge-company/ai-design-system-demo', 'start explorations')).toBe(false);
    expect(runsInBrowser('acme/ds', 'say the design looks right')).toBe(false);
  });
});
