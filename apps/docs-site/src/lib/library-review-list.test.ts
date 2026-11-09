// The List in blocks: families in order, the most recent block first, columns only when filled.
import { describe, expect, it } from 'vitest';
import { familiesOf, familyOf, recencyOf, shownColumns } from './library-review-list';
import type { PieceGroup, ReviewPiece } from './library-review';
import { change, newComponent } from './library-fixtures.test-helpers';

const g = (label: string, pieces: ReviewPiece[], section: PieceGroup['section'] = 'decide'): PieceGroup => ({ key: `g:${label.toLowerCase()}`, label, section, note: null, pieces });
const at = (p: ReviewPiece, iso: string): ReviewPiece => ({ ...p, at: iso });

describe('the List in blocks', () => {
  it('puts each group in its family', () => {
    expect(familyOf(g('Colors', []))).toBe('foundations');
    expect(familyOf(g('Brands', []))).toBe('foundations');
    expect(familyOf(g('Avatar', []))).toBe('components');
    expect(familyOf(g('Docs', []))).toBe('docs');
    expect(familyOf({ key: 'yours', label: 'Yours, waiting on someone else', section: 'yours' })).toBe('sections');
  });

  it('orders Foundations, Components, Docs, the most recent block first inside', () => {
    const fam = familiesOf([g('Docs', [change()]), g('Avatar', [at(newComponent(), '2026-11-01T00:00:00Z')]), g('Card', [at(newComponent(), '2026-11-08T00:00:00Z')]), g('Spacing', [change()]), g('Colors', [at(change(), '2026-11-09T00:00:00Z')])]);
    expect(fam.map((f) => [f.label, f.groups.map((x) => x.label)])).toEqual([
      ['Foundations', ['Colors', 'Spacing']],
      ['Components', ['Card', 'Avatar']],
      [null, ['Docs']],
    ]);
  });

  it('reads a piece’s recency from itself or its askers', () => {
    expect(recencyOf(at(change(), '2026-11-02T00:00:00Z'))).toBe(Date.parse('2026-11-02T00:00:00Z'));
    expect(Number.isNaN(recencyOf(change()))).toBe(true);
  });

  it('hides a column no row fills', () => {
    expect(shownColumns({ state: false, next: false, action: true })).toEqual(['action']);
  });
});
