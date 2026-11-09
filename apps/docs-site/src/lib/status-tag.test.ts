import { describe, expect, it } from 'vitest';
import { statusTagClass } from './status-tag';

describe('statusTagClass', () => {
  it('puts Exploring and Being built in Harbor, on every surface', () => {
    expect(statusTagClass('Exploring')).toBe('st-tag-harbor');
    expect(statusTagClass('Being built', 'sh-row-pill')).toBe('sh-row-pill st-tag-harbor');
  });
  it('reads a build picked up or in progress (the Being built page words for that stage) in Harbor too', () => {
    expect(statusTagClass('In progress')).toBe('st-tag-harbor');
    expect(statusTagClass('Picked up')).toBe('st-tag-harbor');
  });
  it('leaves every other tag its tone', () => {
    expect(statusTagClass('Needs you')).toBeUndefined();
    expect(statusTagClass('In review', 'sh-card-tag')).toBe('sh-card-tag');
    expect(statusTagClass(null)).toBeUndefined();
  });
});
