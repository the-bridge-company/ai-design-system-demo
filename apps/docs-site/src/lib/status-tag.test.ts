import { describe, expect, it } from 'vitest';
import { statusTagClass } from './status-tag';

describe('statusTagClass', () => {
  it('puts Exploring and Being built in Harbor, on every surface', () => {
    expect(statusTagClass('Exploring')).toBe('st-tag-harbor');
    expect(statusTagClass('Being built', 'sh-row-pill')).toBe('sh-row-pill st-tag-harbor');
  });
  it('leaves every other tag its tone', () => {
    expect(statusTagClass('Needs you')).toBeUndefined();
    expect(statusTagClass('In review', 'sh-card-tag')).toBe('sh-card-tag');
    expect(statusTagClass(null)).toBeUndefined();
  });
});
