// The browser tab names the thing a page opened in place (WCAG 2.4.2, page titled): an exploration, a review piece's
// "Who gets it". Studio builds one title per page ("Explorations | Bridge Studio"); a view opened in place puts its
// own name in front and gives the page title back when it closes.
import { useEffect } from 'react';

/** The page title with `name` in front: "Order fulfilment timeline | Explorations | Bridge Studio". */
export function titleWith(base: string, name: string | null | undefined): string {
  const n = (name ?? '').replace(/\s+/g, ' ').trim();
  if (!n) return base;
  return base ? `${n} | ${base}` : n;
}

/** While mounted (and `name` is set), the tab reads `name | <page title>`; the page title comes back on unmount. */
export function usePageTitle(name: string | null | undefined): void {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const base = document.title;
    const next = titleWith(base, name);
    if (next === base) return;
    document.title = next;
    return () => {
      // Only give it back if nothing else renamed the tab meanwhile.
      if (document.title === next) document.title = base;
    };
  }, [name]);
}
