// Screens of a product: which files of an audited product make which screen, so the adoption report can show a real
// picture of where a group of pieces lives. A product says it in bridge.config.json (`products[].screens`: a route,
// as opened on the product's address, to the globs of the files that make it); without that, Bridge reads the file
// routes most frameworks use (Next.js app/ and pages/, React Router, Remix and TanStack routes/). A screen that needs a
// value in its address (/contacts/[id], /deals/$id) is never guessed: no one can open it without one.
// Pure: no fs, no DOM. The CLI writes the result into the report (`screens`); scripts/preview-shots.mjs captures each
// screen of the product's live address into the bridge-shots branch; Studio picks, for a group, the screen that holds
// most of its places (screenForPlaces).
import { globToRegExp } from '../layered';
import type { AuditReport, AuditScreen } from './types';

/** `products[].screens`: a route ("/", "/settings", "/#/contacts") to one glob or several. */
export type ScreensConfig = Record<string, string | string[]>;

/** Screens a report keeps at most: the capture opens each one. */
export const MAX_SCREENS = 12;

const SOURCE = /\.(tsx|jsx|ts|js|mdx|vue|svelte|astro)$/;
const DYNAMIC = /^\[.*\]$|^\$|^:/;

const trimSlashes = (p: string) => p.replace(/^\.?\/+|\/+$/g, '');

/** What a person reads for a route: "/#/contacts" -> "Contacts", "/" -> "Home", "/deals/won" -> "Deals, won". */
export function screenName(route: string): string {
  const parts = route
    .replace(/^\/?#?\/?/, '')
    .split(/[?#]/)[0]!
    .split('/')
    .filter(Boolean)
    .map((s) => decodeURIComponent(s).replace(/[-_]+/g, ' ').trim())
    .filter(Boolean);
  if (!parts.length) return 'Home';
  const [first, ...rest] = parts;
  return [first!.charAt(0).toUpperCase() + first!.slice(1), ...rest].join(', ');
}

/** A file name for a route's picture: "/#/contacts" -> "contacts", "/" -> "home". */
export function screenSlug(route: string): string {
  const s = route
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return s || 'home';
}

/** What is wrong with a `screens` value, each problem saying how to fix it. */
export function screensProblems(raw: unknown, at = 'screens'): string[] {
  if (raw === undefined) return [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [`"${at}" must map a route to file globs, such as { "/#/contacts": ["components/contacts/**"] }`];
  const problems: string[] = [];
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > MAX_SCREENS) problems.push(`"${at}" lists ${entries.length} screens: keep the ${MAX_SCREENS} that matter most`);
  for (const [route, globs] of entries) {
    if (!route.startsWith('/') || /\s/.test(route) || /\{\w+\}/.test(route))
      problems.push(`"${at}" route "${route}" must start with "/" and have no spaces or placeholders, such as "/settings" or "/#/contacts"`);
    const list = typeof globs === 'string' ? [globs] : globs;
    if (!Array.isArray(list) || !list.length || list.some((g) => typeof g !== 'string' || !g.trim() || g.startsWith('/') || g.split('/').includes('..'))) {
      problems.push(`"${at}" route "${route}" needs file globs relative to the audited folder or the repository, such as "components/contacts/**"`);
    }
  }
  return problems;
}

/**
 * The route a file stands for by the usual file-route conventions, or null. Paths are relative to the audited folder
 * or the repository; the first "app", "pages" or "routes" folder starts the route.
 *   app/(shop)/orders/page.tsx -> /orders        (Next.js app router; groups and @slots leave the address)
 *   pages/settings/index.tsx -> /settings         (Next.js pages; lowercase names only, _app and api/ are not screens)
 *   routes/_index.tsx -> /    routes/deals.won.tsx -> /deals/won    routes/contacts/route.tsx -> /contacts
 * Null for a route that needs a value (a [id], $id or :id segment) and for anything else.
 */
export function conventionRoute(path: string): string | null {
  const segs = trimSlashes(path).split('/');
  const file = segs[segs.length - 1] ?? '';
  if (!SOURCE.test(file)) return null;
  const base = file.replace(SOURCE, '');
  const appAt = segs.indexOf('app');
  if (appAt >= 0 && base === 'page') return routeOf(segs.slice(appAt + 1, -1).filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('@')));
  const pagesAt = segs.indexOf('pages');
  if (pagesAt >= 0) {
    const parts = [...segs.slice(pagesAt + 1, -1), base];
    if (parts[0] === 'api' || parts.some((p) => p.startsWith('_') || /[A-Z]/.test(p))) return null;
    return routeOf(parts[parts.length - 1] === 'index' ? parts.slice(0, -1) : parts);
  }
  const routesAt = segs.indexOf('routes');
  if (routesAt >= 0) {
    const dirs = segs.slice(routesAt + 1, -1);
    const own = base === 'route' || base === 'index' || base === '_index' ? [] : base.split('.');
    // __root (TanStack) is the frame, -folders are kept out of the routes on purpose.
    if ([...dirs, ...own].some((p) => p.startsWith('__') || p.startsWith('-')) || base.startsWith('__')) return null;
    // Pathless layouts (_auth) and the index marker leave the address.
    const parts = [...dirs.flatMap((d) => d.split('.')), ...own].filter((p) => p && p !== 'index' && p !== '_index' && !(p.startsWith('_') && !DYNAMIC.test(p)));
    return routeOf(parts);
  }
  return null;
}

function routeOf(parts: string[]): string | null {
  if (parts.some((p) => DYNAMIC.test(p))) return null;
  return `/${parts.join('/')}`;
}

/** The folder a convention route file owns: its own folder for app/ page files and routes/<x>/route files. */
function routeFolder(path: string): string | null {
  const segs = trimSlashes(path).split('/');
  const base = (segs[segs.length - 1] ?? '').replace(SOURCE, '');
  if ((segs.includes('app') && base === 'page') || (segs.includes('routes') && (base === 'route' || base === 'index'))) return segs.slice(0, -1).join('/');
  return null;
}

/**
 * The screens of an audited product: each route with the files (report paths) that make it. From `screens` when the
 * product sets it (in that order, a file may belong to several), else from the file routes: each route file, and the
 * files in its folder (app/orders/_parts/list.tsx is part of /orders) unless a deeper route or a value segment owns
 * them. `root` is the audited folder inside the repository (report target.root), so globs may be written from the
 * repository root too ("src/components/**"). At most MAX_SCREENS, the routes holding most files first.
 */
export function productScreens(files: readonly string[], product: { screens?: ScreensConfig | undefined } | null | undefined, root?: string | undefined): AuditScreen[] {
  const prefix = root ? `${trimSlashes(root)}/` : '';
  const paths = files.map((f) => trimSlashes(f));
  if (product?.screens && Object.keys(product.screens).length) {
    return Object.entries(product.screens)
      .slice(0, MAX_SCREENS)
      .map(([route, globs]) => {
        const res = (typeof globs === 'string' ? [globs] : globs).map((g) => globToRegExp(trimSlashes(g)));
        return {
          route,
          name: screenName(route),
          files: paths.filter((f) => res.some((re) => re.test(f) || (prefix && re.test(prefix + f)))),
        };
      });
  }
  const routes = new Map<string, Set<string>>();
  const folders: { dir: string; route: string }[] = [];
  for (const f of paths) {
    const route = conventionRoute(f);
    if (route === null) continue;
    if (!routes.has(route)) routes.set(route, new Set());
    routes.get(route)!.add(f);
    const dir = routeFolder(f);
    if (dir !== null) folders.push({ dir, route });
  }
  // The deepest route folder holding a file owns it, unless a value segment sits between them.
  folders.sort((a, b) => b.dir.length - a.dir.length);
  for (const f of paths) {
    if (conventionRoute(f) !== null) continue;
    const hit = folders.find((x) => f.startsWith(`${x.dir}/`));
    if (!hit) continue;
    const between = f
      .slice(hit.dir.length + 1)
      .split('/')
      .slice(0, -1);
    if (between.some((s) => DYNAMIC.test(s))) continue;
    routes.get(hit.route)!.add(f);
  }
  return [...routes.entries()]
    .map(([route, set]) => ({
      route,
      name: screenName(route),
      files: [...set].sort(),
    }))
    .sort((a, b) => b.files.length - a.files.length || a.route.localeCompare(b.route))
    .slice(0, MAX_SCREENS);
}

/** The report with its screens (replaces any earlier list). No screen found: the report as it was, without `screens`. */
export function withScreens(report: AuditReport, product: { screens?: ScreensConfig | undefined } | null | undefined): AuditReport {
  const { screens: _old, ...rest } = report;
  const screens = productScreens(
    report.files.map((f) => f.path),
    product,
    report.target.root
  ).filter((s) => s.files.length);
  return screens.length ? { ...rest, screens } : rest;
}

/** The screen a group of places shows on, for the report's picture. */
export interface ScreenPick {
  screen: AuditScreen;
  /** Places of the group on that screen, of `total`. */
  count: number;
  total: number;
}

/**
 * The screen that holds most of a group's places, preferring one that has a picture (a screen captured with 3 of them
 * beats one not captured with 4). Null when no screen holds any.
 */
export function screenForPlaces(screens: readonly AuditScreen[] | undefined, places: readonly { file: string }[]): ScreenPick | null {
  if (!screens?.length || !places.length) return null;
  let best: ScreenPick | null = null;
  for (const screen of screens) {
    const own = new Set(screen.files);
    const count = places.filter((p) => own.has(p.file)).length;
    if (!count) continue;
    const better = !best || (Boolean(screen.image) && !best.screen.image) || (Boolean(screen.image) === Boolean(best.screen.image) && count > best.count);
    if (better) best = { screen, count, total: places.length };
  }
  return best;
}
