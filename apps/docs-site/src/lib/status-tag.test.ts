import { describe, expect, it } from 'vitest';
import { LIFECYCLE_TONE } from './review-state';
import { MEANING_TONE, statusTagClass, toneOf } from './status-tag';
import { PR_DOC_PILL } from './pr-docs';
import { GROUP_TONE } from './changes';
import { BUILD_WORDS } from './build-check-view';

describe('statusTagClass', () => {
  it('reads the tone of the state, never its words: in progress (info) is Harbor on every surface', () => {
    expect(statusTagClass('info')).toBe('st-tag-harbor');
    expect(statusTagClass('info', 'sh-row-pill')).toBe('sh-row-pill st-tag-harbor');
  });
  it('leaves every other tone its DS colour', () => {
    expect(statusTagClass('warning')).toBeUndefined();
    expect(statusTagClass('warning', 'sh-card-tag')).toBe('sh-card-tag');
    expect(statusTagClass('success')).toBeUndefined();
    expect(statusTagClass('danger')).toBeUndefined();
    expect(statusTagClass(null)).toBeUndefined();
  });
  it('a label alone picks no colour: words that once matched Harbor do nothing by themselves', () => {
    expect(statusTagClass('Exploring')).toBeUndefined();
    expect(statusTagClass('Being built')).toBeUndefined();
  });
});

describe('one meaning per tone', () => {
  it('maps the five meanings to five different tones', () => {
    expect(MEANING_TONE).toEqual({ 'in-progress': 'info', waiting: 'warning', done: 'success', blocked: 'danger', over: 'neutral' });
    expect(new Set(Object.values(MEANING_TONE)).size).toBe(5);
    expect(toneOf('waiting')).toBe('warning');
  });
  it('blue is work moving, amber waits on someone, green is done, grey is over', () => {
    expect(LIFECYCLE_TONE.exploring).toBe(toneOf('in-progress'));
    expect(LIFECYCLE_TONE['being-built']).toBe(toneOf('in-progress'));
    expect(LIFECYCLE_TONE['waiting-for-lead']).toBe(toneOf('waiting'));
    expect(LIFECYCLE_TONE['waiting-for-code']).toBe(toneOf('waiting'));
    expect(LIFECYCLE_TONE['in-review']).toBe(toneOf('waiting'));
    expect(LIFECYCLE_TONE.approved).toBe(toneOf('done'));
    expect(LIFECYCLE_TONE.shipped).toBe(toneOf('done'));
    expect(LIFECYCLE_TONE.closed).toBe(toneOf('over'));
  });
  it('a draft that needs review, a review waiting and Check the build wait on someone: amber, never plum', () => {
    expect(PR_DOC_PILL.review.tone).toBe(toneOf('waiting'));
    expect(GROUP_TONE.waiting).toBe(toneOf('waiting'));
    expect(GROUP_TONE.blocked).toBe(toneOf('blocked'));
    expect(BUILD_WORDS.tagTone).toBe(toneOf('waiting'));
  });
});
