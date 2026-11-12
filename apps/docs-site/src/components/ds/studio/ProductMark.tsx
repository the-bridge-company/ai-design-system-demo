// A product's mark, one style everywhere: the side nav's folder (ProductsNav.tsx), a line icon in the text color, never
// a solid letter square. Library review (who asked, a conflict's ways, a chapter's reach), Who gets it and the Map use
// it next to the product's name, or alone with the name on hover where the line is short. Styles:
// styles/library-review.css (lr-product-mark).
import { Icon } from '@bridge-ds/react';
import { Folder } from 'lucide-react';

/** The product icon of the side nav, so a product looks the same in the nav and in a review. */
export const PRODUCT_ICON = Folder;

export function ProductMark({ product, className }: { product: string | null | undefined; className?: string }) {
  if (!product) return null;
  return (
    <span className={`lr-product-mark${className ? ` ${className}` : ''}`} title={product} aria-hidden="true">
      <Icon icon={PRODUCT_ICON} size="sm" />
    </span>
  );
}
