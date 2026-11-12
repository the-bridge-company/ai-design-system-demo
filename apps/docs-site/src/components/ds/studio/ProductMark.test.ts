// One look per product and per person in the reviews (senior UX review, 2026-11-12): a product is the side nav's folder,
// never a solid letter square; a person is their drawn face, never grey initials.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Folder } from 'lucide-react';
import { PRODUCT_ICON, ProductMark } from './ProductMark';
import { ProductChip } from './LibraryReach';

const src = (f: string) => readFileSync(join(__dirname, f), 'utf8');

describe('product mark', () => {
  it("is the side nav's folder icon", () => {
    expect(PRODUCT_ICON).toBe(Folder);
    expect(src('ProductsNav.tsx')).toMatch(/icon=\{PRODUCT_ICON\}/);
  });

  it('draws the icon with the product name on hover, never a letter', () => {
    const html = renderToStaticMarkup(createElement(ProductMark, { product: 'Acme CRM' }));
    expect(html).toContain('<svg');
    expect(html).toContain('title="Acme CRM"');
    expect(html.replace(/<[^>]+>/g, '')).toBe('');
    expect(renderToStaticMarkup(createElement(ProductMark, { product: null }))).toBe('');
  });

  it("a product chip (Map, Who gets it) is the folder and the name, like the nav's row", () => {
    const html = renderToStaticMarkup(createElement(ProductChip, { name: 'Acme Prints' }));
    expect(html).toContain('<svg');
    expect(html.replace(/<[^>]+>/g, '')).toBe('Acme Prints');
  });

  it('Library review draws no letter squares and no initials faces', () => {
    const review = src('LibraryReview.tsx');
    // Every product mark goes through ProductMark; every person through NameFace (faces.tsx Who, a drawn face).
    expect(review).not.toMatch(/className="lr-product-mark"/);
    const avatars = [...review.matchAll(/<Avatar\b[^>]*>/g)].map((m) => m[0]);
    // The only DS Avatar left is the spacing specimen's sample content, not a person of the team.
    expect(avatars).toEqual(['<Avatar name="Ada Lovelace" size="sm" decorative />']);
    expect(src('LibraryReach.tsx')).not.toMatch(/charAt\(0\)\.toUpperCase\(\)/);
  });
});
