import { describe, expect, it } from 'vitest';
import { afterCaption, emptySideWords, NEW_IN_SCREEN, showsBefore } from './new-piece-preview';

describe('before and after of a library piece', () => {
  it('a new component (Timeline) shows only its after side, "New in this screen", never "none"', () => {
    const spec = { kind: 'icon' };
    expect(showsBefore(true, spec)).toBe(false);
    expect(afterCaption(true, spec, 'With this change')).toBe(NEW_IN_SCREEN);
    expect(emptySideWords('before')).not.toMatch(/none/i);
    expect(emptySideWords('after')).not.toMatch(/none/i);
  });

  it('a change to what exists keeps both sides', () => {
    expect(showsBefore(false, { kind: 'icon' })).toBe(true);
    expect(afterCaption(false, { kind: 'icon' }, 'With this change')).toBe('With this change');
    expect(showsBefore(false, { kind: 'color', before: '#fff', after: '#000' })).toBe(true);
  });

  it('a drawn value shows its before only when it has one', () => {
    expect(showsBefore(true, { kind: 'space', before: 16, after: 24 })).toBe(true);
    expect(showsBefore(true, { kind: 'space', before: null, after: 24 })).toBe(false);
    expect(showsBefore(false, { kind: 'color', before: null, after: '#000' })).toBe(false);
  });
});
