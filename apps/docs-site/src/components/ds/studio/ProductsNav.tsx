// The side nav's two groups (layouts/Layout.astro, Studio only; owner-approved option A, 2026-11-04, boards NavTwo,
// NavMany, NavAllProducts, NavPhone), under Home, Changes and Being built, Settings below them at the foot:
//   Products        the team's products, like the project list in Figma's sidebar: the viewer's own first, at most
//                   five, then "All products" with the total when the team has more (lib/nav-products.ts). The product
//                   open on screen always shows.
//   Design system   Components, Tokens, Quality. The library's explorations are on Explorations, Product = Design
//                   system (2026-11-09: the library's own "Explorations" entry left the nav).
// Built from the build's products on the self-hosted Studio; on a team shell from the team's own settings once they are
// read (scripts/repo-context.ts, the bridge:team-model event). The same rail is the phone's menu. DS SidebarNav parts.
import { useEffect, useState } from 'react';
import { PanelsTopLeft } from 'lucide-react';
import { PRODUCT_ICON } from './ProductMark';
import { Skeleton, SidebarNavItem, SidebarNavSection } from '@bridge-ds/react';
import { productsOf, type ProductConfig } from '@bridge-ds/core';
import { productHref, productKeyFromPath } from '../../../lib/product-page';
import { isHosted, STUDIO_ROOT, studioBase, studioHref } from '../../../lib/team-path';
import { navProductRows, navProducts, NO_SIGNALS, readSignals, type NavProduct, type ProductSignals } from '../../../lib/nav-products';
import { siteIcon } from '../../../brand/site-icons';
import { productInitials } from '../../../lib/rail-collapse';
import type { IconName } from '../../../brand/icons';

export { navProducts, type NavProduct };

/** A Design system page of the nav (lib/nav.ts studioNav, place 'design-system'). */
export interface NavPage {
  href: string;
  label: string;
  icon: IconName;
}

/** The All products page (pages/studio/products/index.astro). */
export const ALL_PRODUCTS_PATH = `${STUDIO_ROOT}products/`;


/** Whether the nav entry for `href` holds the page at `path` (itself, or a page under it). */
const holds = (href: string, path: string) => path === href || (href !== STUDIO_ROOT && path.startsWith(href));

/**
 * Rows the Products group holds before a team shell has read its settings (A2): the count this browser saw last for the
 * team, else this many. The group paints at once in its place, so Design system under it never moves when the names come.
 */
export const PRODUCTS_PENDING_ROWS = 3;

/** Where this browser keeps how many rows a team's Products group showed (its next first paint reserves as many). */
export const productRowsKey = (team: string) => `bridge.nav.product-rows:${team.toLowerCase()}`;

/** The rows the group draws: the products shown, plus All products when there are more. */
export const productRowCount = (rows: { shown: readonly unknown[]; all: boolean }) => rows.shown.length + (rows.all ? 1 : 0);

export interface ProductsNavViewProps {
  products: NavProduct[];
  /** The product open on screen (its key), else null. */
  current: string | null;
  /** The Studio page on screen, as a self-hosted path ('/studio/tokens/'). */
  path?: string;
  /** Components, Tokens, Quality: the Design system group's pages before Explorations. */
  pages?: NavPage[];
  signals?: ProductSignals;
  /** The team's products are not read yet: the group holds this many skeleton rows (0 draws no group). */
  pendingRows?: number;
}

export function ProductsNavView({ products, current, path = '', pages = [], signals = NO_SIGNALS, pendingRows = 0 }: ProductsNavViewProps) {
  const rows = navProductRows(products, signals, current);
  const allHere = path === ALL_PRODUCTS_PATH;
  // The collapsed rail draws two letters per product instead of the folder (styles/site.css, data-initials).
  // Only the products listed here: the library's own product carries another name and would keep "Acme" in.
  const names = rows.shown.filter((p) => !p.library).map((p) => p.name);
  return (
    <>
      {pendingRows > 0 && (
        // Reading the team's settings: the group in its place, one quiet row per product it showed last time. The rows
        // are the nav rows' height (.rail-skel), so the names replace them without moving anything under them.
        <SidebarNavSection title="Products" className="rail-section rail-products" data-products-nav="" data-pending="" aria-busy="true">
          {Array.from({ length: pendingRows }, (_, i) => (
            <li key={i} className="rail-skel" aria-hidden="true">
              <Skeleton variant="rect" width="var(--icon-size-md)" height="var(--icon-size-md)" />
              <Skeleton width={i % 2 ? '8ch' : '11ch'} />
            </li>
          ))}
        </SidebarNavSection>
      )}
      {pendingRows === 0 && rows.shown.length > 0 && (
        <SidebarNavSection title="Products" className="rail-section rail-products" data-products-nav="">
          {rows.shown.map((p) => (
            <SidebarNavItem key={p.key} href={productHref(p.key)} icon={PRODUCT_ICON} active={current === p.key} data-keep-branch="" data-initials={productInitials(p.name, names)}>
              {p.name}
            </SidebarNavItem>
          ))}
          {rows.all && (
            <SidebarNavItem href={studioHref('products/')} icon={PanelsTopLeft} className="rail-all" active={allHere} count={rows.total} data-keep-branch="" aria-label={`All products, ${rows.total}`}>
              All products
            </SidebarNavItem>
          )}
        </SidebarNavSection>
      )}
      <SidebarNavSection title="Design system" className="rail-section rail-design-system" data-design-system-nav="">
        {pages.map((p) => (
          <SidebarNavItem key={p.href} href={studioHref(p.href)} icon={siteIcon(p.icon)} active={holds(p.href, path)} data-keep-branch="">
            {p.label}
          </SidebarNavItem>
        ))}
      </SidebarNavSection>
    </>
  );
}

/** The Studio page on screen as a self-hosted path: a team's /studio/acme/ds/tokens/ is /studio/tokens/. */
function studioPathHere(): string {
  const base = studioBase(location.pathname, isHosted());
  return `${STUDIO_ROOT}${location.pathname.slice(base.length)}`.replace(/\/?$/, '/');
}

/** The team of the page ("owner/repo"), for what this browser kept about its products. */
async function teamHere(): Promise<string | null> {
  const { repoContext } = await import('../../../scripts/repo-context');
  const r = repoContext();
  return r.owner && r.repo ? `${r.owner}/${r.repo}` : null;
}

const storage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

export interface ProductsNavProps {
  /** The build's products (self-hosted); absent on a team shell, where the team's settings say. */
  products?: NavProduct[];
  current?: string | null;
  path?: string;
  pages?: NavPage[];
}

export default function ProductsNav({ products, current = null, path = '', pages = [] }: ProductsNavProps) {
  const [list, setList] = useState<NavProduct[]>(products ?? []);
  const [here, setHere] = useState<string | null>(current);
  const [at, setAt] = useState(path);
  const [signals, setSignals] = useState<ProductSignals>(NO_SIGNALS);
  // A team shell before its settings are read: skeleton rows in the group's place (A2).
  const [pending, setPending] = useState(!products);
  const [pendingRows, setPendingRows] = useState(PRODUCTS_PENDING_ROWS);
  const [team, setTeam] = useState<string | null>(null);
  // Once mounted, the links point at the team in the address (studioHref) and the order reads this browser.
  const [, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setHere(productKeyFromPath(location.pathname));
    setAt(studioPathHere());
    let live = true;
    void teamHere().then((t) => {
      if (!live) return;
      setTeam(t);
      setSignals(readSignals(t, storage()));
      const kept = t ? Number(storage()?.getItem(productRowsKey(t)) ?? NaN) : NaN;
      if (Number.isInteger(kept) && kept >= 0) setPendingRows(kept);
    });
    if (products) {
      // The build's products, with one this tab just added (it lists itself once the site is built again).
      void import('../../../scripts/repo-context').then(({ addedHere }) => {
        const keys = new Set(products.map((p) => p.key));
        const more = navProducts(addedHere().map((a) => a.entry)).filter((p) => !keys.has(p.key));
        if (!live || !more.length) return;
        setList([...products, ...more]);
      });
      return () => {
        live = false;
      };
    }
    const read = () =>
      void import('../../../scripts/repo-context').then(({ siteConfig }) => {
        const site = siteConfig() as { products?: ProductConfig[] };
        // Nothing read yet: wait for the team's settings rather than list the defaults.
        if (live && Object.keys(site).length) {
          setList(navProducts(productsOf(site)));
          setPending(false);
        }
      });
    read();
    document.addEventListener('bridge:team-model', read);
    return () => {
      live = false;
      document.removeEventListener('bridge:team-model', read);
    };
  }, [products]);
  // Remember how many rows the group drew for this team: the next first paint reserves exactly that.
  useEffect(() => {
    if (pending || !team) return;
    try {
      storage()?.setItem(productRowsKey(team), String(productRowCount(navProductRows(list, signals, here))));
    } catch {
      /* storage blocked: the next page reserves the default */
    }
  }, [pending, team, list, signals, here]);
  return <ProductsNavView products={list} current={here} path={at} pages={pages} signals={signals} pendingRows={pending ? pendingRows : 0} />;
}
