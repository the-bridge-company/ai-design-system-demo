// A product manager's opinion is optional (they never decide): their Home invites, it never queues. Covers
// home-model optionalNeed / waitingSummary / badgeRows and lib/waiting-counts (pmHomeRow's flag: build-check.test.ts).
import { describe, expect, it } from 'vitest';
import { badgeRows, explorationReviewNeed, optionalNeed, OPTIONAL_WORDS, requesterPerson, waitingSummary, type NeedRow, type Person } from './home-model';
import { waitingCounts } from './waiting-counts';

const NOW = new Date('2026-10-19T09:30:00Z').getTime();
const daysAgo = (d: number) => new Date(NOW - d * 86400000).toISOString();
const sofia = requesterPerson({ name: 'Sofia', login: null })!;
const leo = requesterPerson({ name: 'Leo', login: null })!;

const exploration = (n: number, who: Person, since: string | null): NeedRow =>
  explorationReviewNeed({ number: n, product: 'prints', author: who, asker: who, since, thumb: { kind: 'icon', icon: 'branch' }, name: `Exploration ${n}`, href: '#' }, NOW);

describe("a product manager's optional opinion", () => {
  it('an optional row never waits on them and carries no age', () => {
    const row = optionalNeed(exploration(1, sofia, daysAgo(4)));
    expect(row.waitsOnYou).toBe(false);
    expect(row.optional).toBe(true);
    expect(row.pill).toEqual({ label: 'Optional', tone: 'neutral' });
    expect(JSON.stringify(row)).not.toMatch(/Waiting \d/);
  });

  it('the greeting invites, with no "waiting on you" and no "Oldest"', () => {
    const rows = [optionalNeed(exploration(1, sofia, daysAgo(4))), optionalNeed(exploration(2, sofia, daysAgo(2))), optionalNeed(exploration(3, leo, null))];
    const s = waitingSummary(rows, NOW)!;
    expect(s.names).toBe('Sofia and Leo');
    expect(s.rest).toBe(OPTIONAL_WORDS.rest);
    const said = `${s.names}${s.rest} ${s.note ?? ''} ${s.group}`;
    expect(said).not.toMatch(/waiting on you/i);
    expect(said).not.toMatch(/oldest/i);
    expect(said).not.toContain(String.fromCharCode(0x2014));
    // Said once: the rows carry the Optional tag, the greeting adds no second sentence.
    expect(s.note).toBeNull();
    expect(s.people.map((p) => p.login)).toEqual(['~sofia', '~leo']);
  });

  it('a lead keeps the normal queue: who waits on them, no "Oldest" (each row says its own age)', () => {
    const s = waitingSummary([exploration(1, sofia, daysAgo(4)), exploration(2, leo, daysAgo(2))], NOW)!;
    expect(`${s.names}${s.rest}`).toBe('Sofia and Leo are waiting on you.');
    expect(JSON.stringify(s)).not.toMatch(/Oldest/);
    expect(s.note).toBeNull();
  });

  it('something that does wait on them wins the greeting; the optional asks stay out of it', () => {
    const s = waitingSummary([exploration(1, leo, daysAgo(1)), optionalNeed(exploration(2, sofia, daysAgo(6)))], NOW)!;
    expect(`${s.names}${s.rest}`).toBe('Leo is waiting on you.');
    expect(s.people.map((p) => p.login)).toEqual(['~leo']);
  });

  it('nothing at all: no line', () => {
    expect(waitingSummary([], NOW)).toBeNull();
  });

  it('never counts in the nav badges nor in Explorations "Waiting on you"', () => {
    const rows = [optionalNeed(exploration(1, sofia, daysAgo(4))), exploration(2, leo, daysAgo(2))];
    expect(badgeRows(rows)).toBe(1);
    expect(waitingCounts(rows).explorations.map((e) => e.key)).toEqual(['prints#2']);
  });
});
