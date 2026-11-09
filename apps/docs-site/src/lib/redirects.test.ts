// Old Studio URLs land on the page that replaced them, with their query and hash carried over.
import { describe, expect, it } from 'vitest';
import { REDIRECTS, redirectTarget } from './redirects';

describe('Quality redirects', () => {
  it('sends Checks and Adoption to the one Quality page', () => {
    expect(REDIRECTS['/studio/checks']).toBe('/studio/quality/');
    expect(REDIRECTS['/studio/adoption']).toBe('/studio/quality/');
    expect(REDIRECTS['/adoption']).toBe('/studio/quality/');
  });

  it('keeps the query and the hash of the old URL', () => {
    expect(redirectTarget(REDIRECTS['/studio/adoption']!, '?branch=x', '#admin-after')).toBe('/studio/quality/?branch=x#admin-after');
    expect(redirectTarget(REDIRECTS['/studio/checks']!, '', '')).toBe('/studio/quality/');
  });
});

describe('Changes became Explorations', () => {
  it('sends /studio/changes/ and the older pages to Explorations, query and hash kept', () => {
    for (const from of ['/studio/changes', '/studio/drafts', '/studio/reviews', '/studio/branches', '/studio/visual-impact', '/reviews', '/branches']) expect(REDIRECTS[from]).toBe('/studio/explorations/');
    expect(redirectTarget(REDIRECTS['/studio/changes']!, '?pr=3', '')).toBe('/studio/explorations/?pr=3');
    expect(redirectTarget(REDIRECTS['/studio/changes']!, '?exploration=4&product=crm', '')).toBe('/studio/explorations/?exploration=4&product=crm');
    // The page then maps what moved (lib/explorations-page legacyTarget) and the old filters (filtersFromAddress).
    expect(redirectTarget(REDIRECTS['/studio/changes']!, '?suggestion=7', '')).toBe('/studio/explorations/?suggestion=7');
    expect(redirectTarget(REDIRECTS['/studio/changes']!, '?state=shipped', '')).toBe('/studio/explorations/?state=shipped');
  });
});

describe('the review queue became Library review', () => {
  it('sends /studio/review/ (Home’s Review all) to Library review, its ?pr= and ?item= carried', () => {
    expect(REDIRECTS['/studio/review']).toBe('/studio/library-review/');
    expect(redirectTarget(REDIRECTS['/studio/review']!, '?pr=13', '')).toBe('/studio/library-review/?pr=13');
    expect(redirectTarget(REDIRECTS['/studio/review']!, '?item=exploration-review-crm%234', '')).toBe('/studio/library-review/?item=exploration-review-crm%234');
  });
});
