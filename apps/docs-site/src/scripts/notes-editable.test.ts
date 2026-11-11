// @vitest-environment jsdom
// Who edits the handover notes ("Where it stands"): the person it belongs to (and who the rule names), never a lead
// signed in by email who keeps someone else's exploration only to archive it or hand it over (Dana on Leo's notes).
import { describe, expect, it } from 'vitest';
import { notesEditable } from './exploration-page';

const base = { member: true, designer: false, emailOnProduct: false, direct: true, own: true };

describe('notesEditable', () => {
  it('the owner edits their own notes (Leo, Sofia by email in the copy)', () => {
    expect(notesEditable({ ...base, writable: true, leadOnly: false })).toBe(true);
  });
  it('a lead on someone else\'s exploration reads them, even though they may archive it', () => {
    expect(notesEditable({ ...base, writable: true, leadOnly: true })).toBe(false);
  });
  it('nobody without the right to write edits them', () => {
    expect(notesEditable({ ...base, writable: false })).toBe(false);
  });
});
