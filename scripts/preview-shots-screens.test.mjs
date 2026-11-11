// The adoption report's pictures (preview-shots.mjs screens): which screens are opened, when again, and where each
// picture's place lands in the report. The browser is replaced by a fake capture.
import { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CROP_LOOKS, SCREENS_MAX_AGE_MS, cropOn, cropSelectors, cropSlug, cropsToCapture, mayProbe, pickCluster, screenSlug, screenUrl, screensDue, screensRun, screensToCapture, triggerSelectors, triggersToTry, withScreenShots } from './preview-shots.mjs';

describe('screens: helpers', () => {
  it('names and opens a route on the live address', () => {
    expect(screenSlug('/#/contacts')).toBe('contacts');
    expect(screenSlug('/')).toBe('home');
    expect(screenUrl('https://crm.example.com/', '/#/contacts')).toBe('https://crm.example.com/#/contacts');
    expect(screenUrl('https://crm.example.com', '/')).toBe('https://crm.example.com/');
  });

  it('captures again for a new commit, a new address, a new route or a day old picture', () => {
    const now = Date.parse('2026-11-11T12:00:00Z');
    const meta = {
      base: 'https://a.dev',
      ref: 'abc',
      screens: {
        '/': {
          image: 'audits/x/home.webp',
          capturedAt: '2026-11-11T08:00:00Z',
        },
      },
    };
    expect(screensDue(null, { base: 'https://a.dev', ref: 'abc', routes: ['/'] }, now)).toBe(true);
    expect(screensDue(meta, { base: 'https://a.dev', ref: 'abc', routes: ['/'] }, now)).toBe(false);
    expect(screensDue(meta, { base: 'https://a.dev', ref: 'abc', routes: ['/'] }, now, true)).toBe(true);
    expect(screensDue(meta, { base: 'https://a.dev', ref: 'def', routes: ['/'] }, now)).toBe(true);
    expect(screensDue(meta, { base: 'https://b.dev', ref: 'abc', routes: ['/'] }, now)).toBe(true);
    expect(screensDue(meta, { base: 'https://a.dev', ref: 'abc', routes: ['/', '/x'] }, now)).toBe(true);
    expect(screensDue(meta, { base: 'https://a.dev', ref: 'abc', routes: ['/'] }, Date.parse('2026-11-11T08:00:00Z') + SCREENS_MAX_AGE_MS + 1)).toBe(true);
  });

  it('opens the screens holding findings, the most first', () => {
    const report = {
      files: [
        { path: 'a.tsx', components: [{}, {}], findings: [] },
        { path: 'b.tsx', components: [], findings: [{}] },
        { path: 'c.tsx', components: [], findings: [] },
      ],
      screens: [
        { route: '/b', files: ['b.tsx'] },
        { route: '/a', files: ['a.tsx'] },
        { route: '/c', files: ['c.tsx'] },
      ],
    };
    expect(screensToCapture(report)).toEqual(['/a', '/b']);
  });

  it('writes the kept pictures into the report and drops stale ones', () => {
    const report = {
      screens: [
        { route: '/', name: 'Home', files: [], image: 'audits/x/old.webp' },
        { route: '/b', name: 'B', files: [] },
      ],
    };
    const out = withScreenShots(report, {
      screens: {
        '/b': {
          image: 'audits/x/b.webp',
          url: 'https://a.dev/b',
          capturedAt: '2026-11-11T08:00:00Z',
          width: 800,
          height: 500,
        },
      },
    });
    expect(out.screens).toEqual([
      { route: '/', name: 'Home', files: [] },
      {
        route: '/b',
        name: 'B',
        files: [],
        image: 'audits/x/b.webp',
        url: 'https://a.dev/b',
        capturedAt: '2026-11-11T08:00:00Z',
        width: 800,
        height: 500,
      },
    ]);
  });
});

describe('screens: a run', () => {
  const setup = () => {
    const root = mkdtempSync(join(tmpdir(), 'bridge-screens-'));
    const data = join(root, 'data');
    const dir = join(root, 'shots');
    mkdirSync(join(data, 'audits'), { recursive: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(data, 'snapshot.json'),
      JSON.stringify({
        audits: [
          { id: 'acme-crm', path: 'audits/acme-crm.json', product: 'crm' },
          { id: 'lib', path: 'audits/lib.json' },
        ],
      })
    );
    const report = {
      target: { path: 'src', files: 2, skipped: 0, ref: 'abc1234' },
      files: [
        { path: 'contacts/List.tsx', components: [{}], findings: [] },
        { path: 'deals/List.tsx', components: [{}], findings: [] },
      ],
      screens: [
        {
          route: '/#/contacts',
          name: 'Contacts',
          files: ['contacts/List.tsx'],
        },
        { route: '/#/deals', name: 'Deals', files: ['deals/List.tsx'] },
      ],
    };
    writeFileSync(join(data, 'audits/acme-crm.json'), JSON.stringify(report));
    return { data, dir };
  };
  const config = {
    products: [
      {
        key: 'crm',
        name: 'Acme CRM',
        repo: 'acme/crm',
        production: 'https://crm.example.com',
      },
    ],
  };

  it('captures each screen of the production address, keeps it in the shots folder and points the report at it', async () => {
    const { data, dir } = setup();
    const opened = [];
    const capture = async (url) => (opened.push(url), url.endsWith('deals') ? null : { webp: Buffer.from('img'), url, width: 800, height: 500 });
    const now = Date.parse('2026-11-11T12:00:00Z');
    const res = await screensRun({ data, dir, config, capture, now });
    expect(res).toEqual({ changed: true, captured: 1 });
    expect(opened).toEqual(['https://crm.example.com/#/contacts', 'https://crm.example.com/#/deals']);
    expect(existsSync(join(dir, 'audits/acme-crm/contacts.webp'))).toBe(true);
    const report = JSON.parse(readFileSync(join(data, 'audits/acme-crm.json'), 'utf8'));
    expect(report.screens[0]).toMatchObject({
      route: '/#/contacts',
      image: 'audits/acme-crm/contacts.webp',
      capturedAt: '2026-11-11T12:00:00.000Z',
    });
    expect(report.screens[1].image).toBeUndefined();

    // The same commit an hour later: nothing opened, the report still points at the picture.
    const again = await screensRun({
      data,
      dir,
      config,
      capture: async () => (opened.push('again'), null),
      now: now + 3600_000,
    });
    expect(again.changed).toBe(false);
    expect(opened).not.toContain('again');
    expect(JSON.parse(readFileSync(join(data, 'audits/acme-crm.json'), 'utf8')).screens[0].image).toBe('audits/acme-crm/contacts.webp');
  });

  it("never opens a private product's preview, and a product without an address gets no picture", async () => {
    const { data, dir } = setup();
    const opened = [];
    const capture = async (url) => (opened.push(url), { webp: Buffer.from('img'), url, width: 800, height: 500 });
    const preview = {
      products: [
        {
          key: 'crm',
          name: 'Acme CRM',
          repo: 'acme/crm',
          preview: 'https://{branch}.crm.dev',
        },
      ],
    };
    const core = { previewUrl: (t, v) => t.replace('{branch}', v.branch) };
    await screensRun({
      data,
      dir,
      config: preview,
      core,
      capture,
      isPublic: async () => false,
    });
    expect(opened).toEqual([]);
    await screensRun({
      data,
      dir,
      config: preview,
      core,
      capture,
      isPublic: async () => true,
    });
    expect(opened[0]).toBe('https://main.crm.dev/#/contacts');
  });

  it('crops each group it knows, keeps the picture next to the screens and points the report at it', async () => {
    const { data, dir } = setup();
    const file = join(data, 'audits/acme-crm.json');
    const report = JSON.parse(readFileSync(file, 'utf8'));
    report.crops = [
      { key: 'piece:Button', component: 'Button', route: '/#/contacts' },
      { key: 'piece:Dialog', component: 'Dialog', route: '/#/contacts' },
    ];
    writeFileSync(file, JSON.stringify(report));
    const capture = async (url) => ({ webp: Buffer.from('img'), url, width: 800, height: 500 });
    const plans = [];
    const crop = async (base, plan) => (plans.push({ base, plan }), { 'piece:Button': { webp: Buffer.from('crop'), from: '/#/deals', url: 'https://crm.example.com/#/deals', width: 260, height: 68 } });
    const now = Date.parse('2026-11-11T12:00:00Z');
    const res = await screensRun({ data, dir, config, capture, crop, now });
    expect(res).toEqual({ changed: true, captured: 3 });
    expect(plans[0].base).toBe('https://crm.example.com');
    expect(plans[0].plan.map((c) => [c.key, c.routes])).toEqual([
      ['piece:Button', ['/#/contacts', '/#/deals']],
      ['piece:Dialog', ['/#/contacts', '/#/deals']],
    ]);
    expect(existsSync(join(dir, 'audits/acme-crm/piece-button.webp'))).toBe(true);
    const out = JSON.parse(readFileSync(file, 'utf8'));
    expect(out.crops).toEqual([
      { key: 'piece:Button', component: 'Button', route: '/#/contacts', image: 'audits/acme-crm/piece-button.webp', from: '/#/deals', url: 'https://crm.example.com/#/deals', capturedAt: '2026-11-11T12:00:00.000Z', width: 260, height: 68 },
      // Not found on any screen: no picture, and the report says none.
      { key: 'piece:Dialog', component: 'Dialog', route: '/#/contacts' },
    ]);
    const meta = JSON.parse(readFileSync(join(dir, 'audits/acme-crm/screens.json'), 'utf8'));
    expect(meta.cropsFailed).toEqual(['piece:Dialog']);
    // Same commit an hour later: nothing taken again, the group that was not found waits for the next commit or day.
    expect(screensDue(meta, { base: 'https://crm.example.com', ref: 'abc1234', routes: ['/#/contacts', '/#/deals'], crops: ['piece:Button', 'piece:Dialog'] }, now + 3600_000)).toBe(false);
    // A new group asks for pictures again.
    expect(screensDue(meta, { base: 'https://crm.example.com', ref: 'abc1234', routes: ['/#/contacts', '/#/deals'], crops: ['piece:Menu'] }, now + 3600_000)).toBe(true);
  });
});

describe('crops: what to look for', () => {
  it('looks for shadcn/ui slots first, then ARIA roles, then plain HTML', () => {
    expect(cropSelectors(CROP_LOOKS.Button)).toEqual(['[data-slot="button"]', '[role="button"]', 'button']);
    expect(cropSelectors(CROP_LOOKS.Menu)).toEqual(['[data-slot="dropdown-menu-content"], [data-slot="context-menu-content"], [data-slot="menubar-content"]', '[role="menu"]']);
    // role="dialog" alone also names side panels: the dialog's fallback leaves them out, a side panel has no fallback.
    expect(cropSelectors(CROP_LOOKS.Dialog)[1]).toContain(':not([data-slot^="sheet"])');
    expect(cropSelectors(CROP_LOOKS.Drawer)).toEqual(['[data-slot="sheet-content"], [data-slot="drawer-content"]']);
    expect(cropSelectors(undefined)).toEqual([]);
  });

  it('opens an overlay with its own trigger first, then anything that says it opens one', () => {
    expect(triggerSelectors(CROP_LOOKS.Menu)).toEqual(['[data-slot="dropdown-menu-trigger"]', '[aria-haspopup="menu"], [aria-haspopup="true"]']);
    expect(triggerSelectors(CROP_LOOKS.Button)).toEqual([]);
  });

  it('never presses a button that would send, change or toggle something', () => {
    expect(mayProbe({ label: 'Import CSV' })).toBe(true);
    expect(mayProbe({ label: 'Delete' })).toBe(false);
    expect(mayProbe({ label: 'Save changes' })).toBe(false);
    expect(mayProbe({ label: 'Export' })).toBe(false);
    expect(mayProbe({ label: 'Open', type: 'submit' })).toBe(false);
    expect(mayProbe({ label: 'Open', inForm: true })).toBe(false);
    expect(mayProbe({ label: 'Hot', pressed: 'false' })).toBe(false);
    expect(mayProbe({ label: '' })).toBe(false);
    expect(triggersToTry([{ how: 'probe', label: 'Delete' }, { how: 'trigger', label: '' }, { how: 'probe', label: 'Import CSV' }])).toEqual([1, 2]);
  });

  it('shows a few instances that sit together, a row first', () => {
    const box = (x, y, width = 100, height = 36) => ({ x, y, width, height });
    // The header search, then three toolbar buttons in a row, then a column of filters.
    expect(pickCluster([box(280, 10, 224), box(1040, 80), box(1150, 80), box(1260, 80), box(280, 225, 240, 28), box(280, 253, 240, 28), box(280, 281, 240, 28)])).toEqual([1, 2, 3]);
    // Far apart: one is enough.
    expect(pickCluster([box(0, 0), box(900, 700)])).toEqual([0]);
    // Too big for the frame: still one, never none.
    expect(pickCluster([box(0, 0, 1200, 800)])).toEqual([0]);
    expect(pickCluster([])).toEqual([]);
  });

  it('crops the groups Bridge knows how to find, on their own screen first', () => {
    const report = {
      crops: [
        { key: 'piece:Button', component: 'Button', route: '/#/contacts' },
        { key: 'piece:Drawer', component: 'Drawer' },
        { key: 'piece:Chart', component: 'Chart', route: '/#/' },
      ],
    };
    const plan = cropsToCapture(report, ['/#/', '/#/contacts']);
    expect(plan.map((c) => [c.key, c.routes])).toEqual([
      ['piece:Button', ['/#/contacts', '/#/']],
      ['piece:Drawer', ['/#/', '/#/contacts']],
    ]);
    expect(cropSlug('piece:Button')).toBe('piece-button');
  });
});

describe('crops: opening an overlay', () => {
  /** A page with a menu trigger that opens nothing, a "Delete" button (never pressed) and an "Import" button that opens a dialog. */
  const fakePage = () => {
    const calls = [];
    let open = false;
    return {
      calls,
      url: () => 'https://crm.example.com/#/contacts',
      evaluate: async (fn, arg) => {
        calls.push(`evaluate ${fn.name}`);
        if (fn.name === 'pageFind') return open ? [{ x: 400, y: 200, width: 500, height: 300 }] : [];
        if (fn.name === 'pageFrame') return { x: arg.pad, y: 100, width: 500 + 2 * arg.pad, height: 300 + 2 * arg.pad };
        if (fn.name === 'pageTriggers')
          return [
            { how: 'trigger', label: 'More' },
            { how: 'probe', label: 'Delete' },
            { how: 'probe', label: 'Import' },
          ];
        if (fn.name === 'pageHolds') return false;
        return null;
      },
      click: async (sel) => {
        calls.push(`click ${sel}`);
        if (sel.endsWith('"2"]')) open = true;
      },
      hover: async (sel) => calls.push(`hover ${sel}`),
      waitForSelector: async () => {
        if (!open) throw new Error('timeout');
      },
      addStyleTag: async () => undefined,
      waitForTimeout: async () => undefined,
      screenshot: async ({ clip }) => (calls.push(`shot ${clip.width}x${clip.height}`), Buffer.from('png')),
      keyboard: {
        press: async (k) => {
          calls.push(`press ${k}`);
          if (k === 'Escape') open = false;
        },
      },
      mouse: { move: async () => undefined },
    };
  };

  it('tries the trigger, skips what would delete, opens the dialog, crops it and closes it', async () => {
    const page = fakePage();
    const shot = await cropOn(page, CROP_LOOKS.Dialog);
    expect(shot).toMatchObject({ width: 548, height: 348 });
    expect(page.calls.filter((c) => c.startsWith('click'))).toEqual(['click [data-bridge-crop-trigger="0"]', 'click [data-bridge-crop-trigger="2"]']);
    expect(page.calls).toContain('shot 548x348');
    expect(page.calls.slice(-3)).toEqual(['evaluate pageHolds', 'evaluate unhide', 'press Escape']);
  });

  it('says there is none when nothing opens it', async () => {
    const page = fakePage();
    page.click = async (sel) => page.calls.push(`click ${sel}`);
    expect(await cropOn(page, CROP_LOOKS.Dialog)).toBeNull();
  });

  it('keeps a search palette only when no other dialog opens', async () => {
    const page = fakePage();
    const evaluate = page.evaluate;
    page.evaluate = async (fn, arg) => (fn.name === 'pageHolds' ? true : evaluate(fn, arg));
    expect(await cropOn(page, CROP_LOOKS.Dialog)).toMatchObject({ width: 548 });
  });

  it('crops a piece that is on the page without opening anything', async () => {
    const page = fakePage();
    page.evaluate = async (fn) => (fn.name === 'pageFind' ? [{ x: 0, y: 0, width: 80, height: 36 }, { x: 90, y: 0, width: 80, height: 36 }] : fn.name === 'pageFrame' ? { x: 0, y: 0, width: 202, height: 68 } : null);
    expect(await cropOn(page, CROP_LOOKS.Button)).toMatchObject({ width: 202, height: 68 });
    expect(page.calls.some((c) => c.startsWith('click'))).toBe(false);
  });
});
