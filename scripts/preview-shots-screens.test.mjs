// The adoption report's pictures (preview-shots.mjs screens): which screens are opened, when again, and where each
// picture's place lands in the report. The browser is replaced by a fake capture.
import { mkdtempSync, readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SCREENS_MAX_AGE_MS, screenSlug, screenUrl, screensDue, screensRun, screensToCapture, withScreenShots } from './preview-shots.mjs';

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
});
