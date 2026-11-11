// Which files make which screen of a product (audit/screens.ts): the configured map, the file-route conventions and
// the screen a group of places shows on.
import { describe, expect, test } from 'vitest';
import { conventionRoute, cropSlug, MAX_CROPS, pieceCrops, productScreens, screenForPlaces, screenName, screenSlug, screensProblems, withScreens, type AuditReport, type AuditScreen } from '../src/audit';
import { productProblems } from '../src';

describe('conventionRoute', () => {
  test.each([
    ['app/page.tsx', '/'],
    ['src/app/(shop)/orders/page.tsx', '/orders'],
    ['app/@modal/settings/page.jsx', '/settings'],
    ['app/contacts/[id]/page.tsx', null],
    ['app/contacts/layout.tsx', null],
    ['pages/index.tsx', '/'],
    ['pages/settings/index.tsx', '/settings'],
    ['pages/billing.tsx', '/billing'],
    ['pages/_app.tsx', null],
    ['pages/api/hello.ts', null],
    ['pages/Billing.tsx', null],
    ['routes/_index.tsx', '/'],
    ['app/routes/deals.won.tsx', '/deals/won'],
    ['routes/_auth.login.tsx', '/login'],
    ['routes/contacts/route.tsx', '/contacts'],
    ['routes/deals.$id.tsx', null],
    ['routes/__root.tsx', null],
    ['routes/-parts/list.tsx', null],
    ['components/button.tsx', null],
    ['styles/app.css', null],
  ])('%s -> %s', (path, route) => {
    expect(conventionRoute(path)).toBe(route);
  });
});

test('screenName and screenSlug read a route', () => {
  expect(screenName('/')).toBe('Home');
  expect(screenName('/#/')).toBe('Home');
  expect(screenName('/#/contacts')).toBe('Contacts');
  expect(screenName('/deals/won-deals')).toBe('Deals, won deals');
  expect(screenSlug('/')).toBe('home');
  expect(screenSlug('/#/contacts')).toBe('contacts');
  expect(screenSlug('/deals/won')).toBe('deals-won');
});

describe('productScreens', () => {
  const files = ['App.tsx', 'components/contacts/ContactList.tsx', 'components/contacts/ContactShow.tsx', 'components/deals/DealList.tsx', 'components/ui/button.tsx'];

  test('a configured map, in its order, with globs from the audited folder or the repository', () => {
    const screens = productScreens(
      files,
      {
        screens: {
          '/#/contacts': 'components/contacts/**',
          '/#/deals': ['src/components/deals/*.tsx'],
        },
      },
      'src'
    );
    expect(screens).toEqual([
      {
        route: '/#/contacts',
        name: 'Contacts',
        files: ['components/contacts/ContactList.tsx', 'components/contacts/ContactShow.tsx'],
      },
      {
        route: '/#/deals',
        name: 'Deals',
        files: ['components/deals/DealList.tsx'],
      },
    ]);
  });

  test('without a map, the file routes and the files in their folders', () => {
    const next = ['app/page.tsx', 'app/orders/page.tsx', 'app/orders/_parts/list.tsx', 'app/orders/[id]/page.tsx', 'app/orders/[id]/line.tsx', 'components/header.tsx'];
    const screens = productScreens(next, undefined);
    expect(screens.find((s) => s.route === '/orders')?.files).toEqual(['app/orders/_parts/list.tsx', 'app/orders/page.tsx']);
    expect(screens.find((s) => s.route === '/')?.files).toEqual(['app/page.tsx']);
    expect(screens.some((s) => s.files.includes('app/orders/[id]/line.tsx'))).toBe(false);
    expect(screens.some((s) => s.files.includes('components/header.tsx'))).toBe(false);
  });

  test('an app with no file routes has no screens', () => {
    expect(productScreens(files, {})).toEqual([]);
  });

  test('withScreens keeps only screens with files, and leaves a report without any untouched', () => {
    const report = {
      files: files.map((path) => ({ path })),
      target: { path: 'src', files: 5, skipped: 0 },
    } as unknown as AuditReport;
    expect(
      withScreens(report, {
        screens: {
          '/#/contacts': 'components/contacts/**',
          '/#/tasks': 'components/tasks/**',
        },
      }).screens?.map((s) => s.route)
    ).toEqual(['/#/contacts']);
    expect('screens' in withScreens({ ...report, screens: [] }, {})).toBe(false);
  });
});

describe('pieceCrops', () => {
  const c = (name: string, library: string, suggestion?: string, line = 1) => ({ line, column: 1, name, kind: 'foreign', library, ...(suggestion ? { suggestion } : {}) });
  const report = {
    target: { path: 'src', files: 3, skipped: 0 },
    metrics: { dsComponentInstances: 0, uiComponentInstances: 6 },
    components: { ds: {} },
    files: [
      { path: 'components/contacts/ContactList.tsx', components: [c('Button', 'shadcn/ui (local)', 'Button'), c('Button', 'shadcn/ui (local)', 'Button', 2), c('DropdownMenu', 'shadcn/ui (local)', 'Menu'), c('DropdownMenuItem', 'shadcn/ui (local)')] },
      { path: 'components/deals/DealList.tsx', components: [c('button', 'native', 'Button')] },
      { path: 'components/layout/Sheet.tsx', components: [c('Sheet', 'shadcn/ui (local)', 'Drawer')] },
    ],
  } as unknown as AuditReport;

  test('one per group, biggest first, with the screen that holds most of it to look on first', () => {
    const out = withScreens(report, { screens: { '/#/contacts': 'components/contacts/**', '/#/deals': 'components/deals/**' } });
    expect(out.crops).toEqual([
      { key: 'piece:Button', component: 'Button', route: '/#/contacts' },
      { key: 'piece:Menu', component: 'Menu', route: '/#/contacts' },
      // No screen holds the side panel: the capture looks on every screen.
      { key: 'piece:Drawer', component: 'Drawer' },
    ]);
  });

  test('no screens, no crops; an earlier list is replaced', () => {
    expect('crops' in withScreens({ ...report, crops: [{ key: 'piece:Old', component: 'Old' }] }, {})).toBe(false);
  });

  test('a picture name never meets a screen picture, and the list is capped', () => {
    expect(cropSlug('piece:Button')).toBe('piece-button');
    expect(cropSlug('piece:AlertDialog')).toBe('piece-alertdialog');
    const many = { ...report, files: [{ path: 'a.tsx', components: Array.from({ length: MAX_CROPS + 4 }, (_, i) => c(`X${i}`, 'lib', `Comp${i}`, i + 1)) }] } as unknown as AuditReport;
    expect(pieceCrops(many, [])).toHaveLength(MAX_CROPS);
  });
});

describe('screenForPlaces', () => {
  const s = (route: string, files: string[], image?: string): AuditScreen => ({
    route,
    name: screenName(route),
    files,
    ...(image ? { image } : {}),
  });
  const places = [{ file: 'a.tsx' }, { file: 'a.tsx' }, { file: 'b.tsx' }, { file: 'c.tsx' }, { file: 'z.tsx' }];

  test('the screen with most places, preferring one with a picture', () => {
    expect(screenForPlaces([s('/one', ['c.tsx']), s('/two', ['a.tsx', 'b.tsx'])], places)).toMatchObject({ screen: { route: '/two' }, count: 3, total: 5 });
    expect(screenForPlaces([s('/one', ['c.tsx'], 'audits/x/one.webp'), s('/two', ['a.tsx', 'b.tsx'])], places)).toMatchObject({ screen: { route: '/one' }, count: 1 });
  });

  test('none when no screen holds a place', () => {
    expect(screenForPlaces([s('/one', ['q.tsx'])], places)).toBeNull();
    expect(screenForPlaces(undefined, places)).toBeNull();
  });
});

test('screens in bridge.config.json products are checked', () => {
  expect(screensProblems({ '/#/contacts': ['components/contacts/**'] })).toEqual([]);
  expect(screensProblems(['x'])).toHaveLength(1);
  expect(screensProblems({ contacts: 'x/**' })[0]).toMatch(/must start with "\/"/);
  expect(screensProblems({ '/a': [] })[0]).toMatch(/needs file globs/);
  expect(screensProblems({ '/a': '../x' })[0]).toMatch(/needs file globs/);
  expect(productProblems([{ key: 'crm', name: 'CRM', screens: { '/': 'pages/**' } }])).toEqual([]);
  expect(productProblems([{ key: 'crm', name: 'CRM', screens: 'pages/**' }])[0]).toMatch(/products\[0\]\.screens/);
});
