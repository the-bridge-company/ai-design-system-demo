// Usage guidance drafts flagged "needs review" on main are library decisions (owner decision 2026-11-13): Dana's Home
// row and Library review's Docs piece come from one source (lib/team-facts teamGuidance), with one age.
import { describe, expect, it } from 'vitest';
import { teamGuidance } from './team-facts';
import { guidanceNeed } from './home-model';
import { designerWords, pieceOfGuidance, passes, yourWaitingPieces } from './library-review';
import { libraryQueueCount } from './library-queue';

const model = {
  components: {
    dir: 'packages/react/src/components',
    index: undefined,
    families: [],
    list: [
      {
        name: 'VisuallyHidden',
        slug: 'VisuallyHidden',
        files: { docs: 'packages/react/src/components/VisuallyHidden/VisuallyHidden.docs.json' },
        docs: { needsReview: true, summary: 'Hides text visually, keeps it for screen readers.', whenToUse: [] },
      },
      { name: 'Button', slug: 'Button', files: { docs: 'packages/react/src/components/Button/Button.docs.json' }, docs: { summary: 'A button.' } },
    ],
  },
} as never;

describe('usage guidance drafts: one source for Home and Library review', () => {
  const data = { owner: 'acme-design-demo', repo: 'bridge-demo-ds', sha: 'abc', model };
  const flagged = '2026-11-10T09:00:00Z';
  // The age both surfaces read (scripts/guidance-drafts guidanceSince): the commit that flagged the docs.json.
  const drafts = teamGuidance(data).map((g) => ({ ...g, since: flagged }));

  it('lists only flagged components, with their docs.json for the age', () => {
    expect(drafts.map((g) => g.name)).toEqual(['VisuallyHidden']);
    expect(drafts[0]!.path).toBe('packages/react/src/components/VisuallyHidden/VisuallyHidden.docs.json');
  });

  it('gives the Home row and the Library review piece the same title and the same age', () => {
    const now = Date.parse('2026-11-13T09:00:00Z');
    const row = guidanceNeed(drafts[0]!, now);
    const piece = pieceOfGuidance(drafts[0]!, 'acme-design-demo/bridge-demo-ds');
    expect(piece.title).toBe(row.title);
    expect(piece.title).toBe('VisuallyHidden usage guidance');
    expect(piece.at).toBe(row.since);
    // An age on Home, never a bare "Waiting".
    expect(row.pill?.label).not.toBe('Waiting');
  });

  it('is a waiting Docs decision in Library review, for whoever decides, with the same anatomy as a docs change', () => {
    const piece = pieceOfGuidance(drafts[0]!, 'acme-design-demo/bridge-demo-ds');
    expect(piece).toMatchObject({ kind: 'Docs', category: 'Docs', state: 'waiting', waitsOn: 'you', tier: 1, asked: null, mine: false, by: 'Claude AI' });
    expect(piece.source).toMatchObject({ kind: 'docs', component: 'VisuallyHidden', path: drafts[0]!.path });
    expect(passes(piece, { status: ['waiting'], asked: [], product: [] })).toBe(true);
    // It counts in the lead's queue (the badge and Home's Library review number), never in a designer's own pieces.
    expect(libraryQueueCount([piece], { reviews: true, name: 'Dana', leadsPublishTier1: true })).toBe(1);
    expect(yourWaitingPieces([piece], { name: 'Leo' })).toBe(0);
  });

  it('names the agent Claude AI, even in an older change title', () => {
    expect(designerWords('Slider: usage guidance drafted by Claude')).toBe('Slider: usage guidance drafted by Claude AI');
    expect(designerWords('Slider: usage guidance drafted by Claude AI')).toBe('Slider: usage guidance drafted by Claude AI');
  });
});
