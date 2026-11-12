import { describe, expect, it } from 'vitest';
import { libraryDecisionsForYou, libraryQueueCount, libraryQueueSubtitle, withLocal } from './library-queue';
import { tallyOf } from './library-review-list';
import type { ReviewPiece, Viewer } from './library-review';

// The fields the count reads (lib/library-review canDecide): the rest of a piece does not change it.
const piece = (key: string, o: Partial<Pick<ReviewPiece, 'mine' | 'state' | 'waitsOn'>> = {}): ReviewPiece => ({ key, mine: false, state: 'waiting', waitsOn: 'you', kind: 'New component', category: 'Components', title: key, ...o }) as unknown as ReviewPiece;
const dana: Viewer = { reviews: true, name: 'Dana', leadsPublishTier1: true };

// The prod sample team: 12 library decisions for Dana, one of hers waiting on another lead, one waiting on the tech owner.
const pieces = [...Array.from({ length: 12 }, (_, i) => piece(`p${i}`)), piece('own', { mine: true, waitsOn: 'lead' }), piece('tech', { waitsOn: 'tech' })];

describe("Library review's one count", () => {
  it('counts the library decisions that wait for the viewer, and nothing else', () => {
    expect(libraryQueueCount(pieces, dana)).toBe(12);
    expect(libraryDecisionsForYou(pieces, dana).map((p) => p.key)).not.toContain('own');
    expect(libraryQueueCount(pieces, { ...dana, reviews: false })).toBe(0);
  });

  it('one number for the subtitle, the list and the badge, whatever the filters and the decisions made on the page', () => {
    // The bug: the subtitle counted the filtered list after a decision made on the page (11), the badge the pieces as
    // read (12). Both read the same function now.
    const local = new Map<string, ReviewPiece['decided']>([['p0', 'added']]);
    const badge = libraryQueueCount(pieces, dana, local);
    const subtitle = libraryQueueSubtitle(pieces, dana, local);
    const list = withLocal(pieces, local).filter((p) => p.state === 'waiting' && !p.mine && p.waitsOn === 'you');
    expect(badge).toBe(11);
    expect(subtitle?.strong).toBe('11 library decisions wait for you, as design system owner.');
    expect(list).toHaveLength(badge);
    // The page's own tally on the same pieces says the same number.
    const all = withLocal(pieces, local);
    expect(tallyOf(all, all, dana, { status: ['waiting'] }).n).toBe(badge);
  });

  it('says it lists library decisions only, and where design reviews are', () => {
    expect(libraryQueueSubtitle(pieces, dana)).toEqual({ strong: '12 library decisions wait for you, as design system owner.', rest: 'Screens waiting for your design review are in Explorations, not here.' });
    expect(libraryQueueSubtitle([piece('a')], dana)?.strong).toBe('1 library decision waits for you, as design system owner.');
    expect(libraryQueueSubtitle([], dana)?.strong).toBe('No library decision waits for you.');
    expect(libraryQueueSubtitle(pieces, { ...dana, reviews: false })).toBeNull();
  });
});
