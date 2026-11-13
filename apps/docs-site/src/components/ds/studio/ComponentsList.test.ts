// The Components list's In Figma column (D9): two words, Yes or No, a layout helper's "use auto layout" as a note.
import { describe, expect, it } from 'vitest';
import { figmaCell } from '@bridge-ds/core';
import { figmaWords } from './ComponentsList';

describe('In Figma, in two words (D9)', () => {
  it('a layout helper reads No with its note; a generated component reads Yes; nothing known stays empty', () => {
    expect(figmaWords(figmaCell({ name: 'Stack', status: 'layout', reason: 'layout only' } as never))).toMatchObject({ label: 'No', note: 'Use auto layout' });
    expect(figmaWords(figmaCell({ name: 'Button', status: 'generated' } as never))).toEqual({ label: 'Yes', note: null });
    expect(figmaWords(undefined)).toBeUndefined();
  });
});
