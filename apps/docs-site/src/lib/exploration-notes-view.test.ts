import { describe, expect, it } from 'vitest';
import { draftOf, edgeCaseGroups, notesCountLine, notesEmpty, notesFromRead, NOTES_WORDS, updateOfDraft } from './exploration-notes-view';
import { parseExplorationNotes } from '@bridge-ds/core';

const N = {
  context: 'c',
  decisions: ['A'],
  edgeCases: [
    { component: 'Button', state: 'Loading', covered: true },
    { component: 'Toast', state: 'Long', covered: false },
    { component: 'button', state: 'Error', covered: false, note: 'red' },
  ],
  openQuestions: [],
  nextStep: 'n',
};

describe('exploration notes view', () => {
  it('counts in words, singular and plural', () => {
    expect(notesCountLine(N)).toBe('1 decision\u2004\u2060·\u20041 of 3 edge cases covered');
    expect(notesCountLine({ ...N, decisions: [], edgeCases: [], openQuestions: ['q', 'r'] })).toBe('2 open questions');
    expect(notesCountLine({ ...N, decisions: [], edgeCases: [] })).toBe('');
  });

  it('groups edge cases by component, any case', () => {
    expect(edgeCaseGroups(N.edgeCases).map((g) => [g.component, g.cases.length])).toEqual([
      ['Button', 2],
      ['Toast', 1],
    ]);
  });

  it('names only the sections the form changed; list lines lose their bullets', () => {
    expect(updateOfDraft(N, draftOf(N))).toEqual({});
    const d = { ...draftOf(N), decisions: 'A\n- B\n\n', nextStep: ' n ' };
    expect(updateOfDraft(N, d)).toEqual({ decisions: ['A', 'B'] });
    expect(updateOfDraft(N, { ...draftOf(N), edgeCases: [] })).toEqual({ edgeCases: [] });
    expect(updateOfDraft(N, { ...draftOf(N), edgeCases: [...N.edgeCases, { component: '', state: ' ', covered: false }] })).toEqual({});
  });
});

describe('notesFromRead: a failed read is never "Nothing noted yet"', () => {
  it('no file yet: the empty notes (the empty state is honest)', () => {
    const got = notesFromRead({ ok: true, text: undefined }, parseExplorationNotes);
    expect(got.unread).toBeUndefined();
    expect(got.notes && notesEmpty(got.notes)).toBe(true);
  });

  it('the read failed (busy, down): no notes and unread, so the page says so instead of the empty state', () => {
    const got = notesFromRead({ ok: false }, parseExplorationNotes);
    expect(got).toEqual({ notes: null, unread: true });
    expect(NOTES_WORDS.unread).not.toMatch(/Nothing noted/);
  });
});
