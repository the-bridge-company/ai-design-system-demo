// @vitest-environment jsdom
// Settings > You, Your face (FaceSetting.tsx) against the /api/account contract with the network mocked: one quiet
// row with Change; Change opens the editor in place with Save face disabled until something changed; Shuffle (reduced
// motion: no riffle) says the new face in a polite live region and never lands on a teammate's style; the parts are
// DS Tabs and radio groups where a teammate's style is disabled and named; Esc cancels and focus goes back to Change;
// Save posts the face, and a style taken meanwhile is refused with the holder's name. Axe clean, collapsed and open.
import '../../../../../../packages/react/src/test/setup';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FACE_PART_NAMES, faceRecipe, illustratedFaceUri, type FaceRecipe } from '@bridge-ds/react/avatar-illustrated';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';
import { setAccountFetch } from '../../../scripts/account-session';
import { forgetDrawings } from '../../../scripts/team-faces';
import { EXPRESSIONS, blockedHair } from '../../../lib/team-faces';
import FaceSetting from './FaceSetting';

const at = { owner: 'acme', repo: 'ds' };
vi.mock('../../../scripts/repo-context', () => ({ repoContext: () => ({ ...at, defaultBranch: 'main', hosted: true }) }));
vi.mock('../../../scripts/contribute-session', () => ({ contributeTeam: vi.fn(async () => ({ collaborators: [], members: [], pms: {} })), seedContributors: () => {}, forgetContributors: () => {} }));

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
type Call = { method: string; body: Record<string, unknown> | null };
let calls: Call[] = [];
let reply: (c: Call) => Response;
const ACCOUNT = { email: 'dana@acme.example', name: 'Dana', github: null, teams: [{ repo: 'acme/ds', name: 'Acme Design', role: 'admin', via: 'email' }] };
const SOFIA = { ...faceRecipe('~sofia'), hair: 'variant40' };

beforeEach(() => {
  calls = [];
  forgetDrawings();
  localStorage.clear();
  // The team as its last members read left it: Dana, Sofia (her saved face wears variant40), Leo.
  localStorage.setItem('bridge.faces.acme/ds', JSON.stringify({ saved: { '~sofia': { face: SOFIA, name: 'Sofia Reyes', at: 1 } }, people: [{ seed: '~dana', name: 'Dana' }, { seed: '~sofia', name: 'Sofia Reyes' }, { seed: '~leo', name: 'Leo' }] }));
  reply = (c) => (c.method === 'GET' ? json(200, { available: true, account: ACCOUNT }) : json(200, { account: { ...ACCOUNT, face: c.body?.face } }));
  setAccountFetch(async (_url, init) => {
    const c = { method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : null };
    calls.push(c);
    return reply(c);
  });
  // Reduced motion: Shuffle swaps the face at once (no riffle).
  window.matchMedia = ((query: string) => ({ matches: query.includes('reduce'), media: query, onchange: null, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as typeof window.matchMedia;
  history.replaceState(null, '', '/studio/acme/ds/settings/');
});

afterEach(() => setAccountFetch(null));

const posts = () => calls.filter((c) => c.body?.action === 'face');

describe('Your face', () => {
  it('one quiet row with Change; Change opens the editor in place, Save face disabled until something changed', async () => {
    const user = userEvent.setup();
    render(createElement(FaceSetting));
    const change = await screen.findByRole('button', { name: 'Change' });
    expect(screen.getByText('Made from your name. No photo needed.')).toBeInTheDocument();
    await expectNoAxeViolations(document.body);
    await user.click(change);
    expect(screen.getByText('Shuffle until it feels like you. Nobody in Acme Design gets the same face.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Your drawn face' })).toBeInTheDocument();
    const strip = screen.getByRole('list', { name: 'Next to your team, at the size of a review row' });
    expect(within(strip).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['You', 'Sofia', 'Leo']);
    expect(screen.getByRole('button', { name: 'Save face' })).toBeDisabled();
    await expectNoAxeViolations(document.body);
  });

  it('Shuffle says the new face and never draws a teammate\'s style; Esc cancels and focus goes back to Change', async () => {
    const user = userEvent.setup();
    render(createElement(FaceSetting));
    await user.click(await screen.findByRole('button', { name: 'Change' }));
    const status = () => document.querySelector('[aria-live="polite"]')!;
    for (let i = 0; i < 5; i++) {
      await user.click(screen.getByRole('button', { name: 'Shuffle' }));
      // "New face: space buns, round glasses." names the hair style first, by its DS name.
      const words = /^New face: ([^,.]+)/.exec(status().textContent ?? '')?.[1];
      const hair = Object.entries(FACE_PART_NAMES.hair).find(([, name]) => name.toLowerCase() === words)?.[0];
      expect(hair).toBeDefined();
      expect(blockedHair(['variant40']).has(hair!)).toBe(false);
    }
    expect(screen.getByRole('button', { name: 'Save face' })).toBeEnabled();
    await user.keyboard('{Escape}');
    const change = await screen.findByRole('button', { name: 'Change' });
    await waitFor(() => expect(change).toHaveFocus());
    expect(posts()).toHaveLength(0);
  });

  it('picks the parts with the keyboard: a teammate\'s style is disabled and named, Save posts the face', async () => {
    const user = userEvent.setup();
    render(createElement(FaceSetting));
    await user.click(await screen.findByRole('button', { name: 'Change' }));
    await user.click(screen.getByRole('button', { name: 'Pick the parts yourself' }));
    expect(screen.getByRole('tablist', { name: 'Parts of your face' })).toBeInTheDocument();
    const hair = screen.getByRole('radiogroup', { name: 'Hair' });
    const taken = within(hair).getByRole('radio', { name: 'Curly puffs, taken by Sofia' });
    expect(taken).toHaveAttribute('aria-disabled', 'true');
    expect(within(hair).getByText('Sofia')).toBeInTheDocument();
    expect(screen.getByText('Styles a teammate wears are taken.')).toBeInTheDocument();
    // Arrow keys move the choice (a radio group): Save face turns on.
    const mine = within(hair).getByRole('radio', { checked: true });
    mine.focus();
    await user.keyboard('{ArrowRight}');
    expect(within(hair).getByRole('radio', { checked: true })).not.toBe(mine);
    await expectNoAxeViolations(document.body);
    await user.click(screen.getByRole('tab', { name: 'Glasses' }));
    await user.click(screen.getByRole('radio', { name: 'Clear aviators' }));
    await user.click(screen.getByRole('button', { name: 'Save face' }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0]!.body!.face).toMatchObject({ v: 1, glasses: 'variant03' });
    expect(await screen.findByText('Saved. Your team sees your new face.')).toBeInTheDocument();
  });

  it('an expression sets the eyes, brows and lips: the preview draws it and Save posts it', async () => {
    const user = userEvent.setup();
    render(createElement(FaceSetting));
    await user.click(await screen.findByRole('button', { name: 'Change' }));
    await user.click(screen.getByRole('button', { name: 'Pick the parts yourself' }));
    await user.click(screen.getByRole('tab', { name: 'Expression' }));
    const preview = () => screen.getByRole('img', { name: 'Your drawn face' }).querySelector('img')!.getAttribute('src');
    const expression = screen.getByRole('radiogroup', { name: 'Expression' });
    const drawn = new Map<string, string>();
    for (const e of EXPRESSIONS) {
      const radio = within(expression).getByRole('radio', { name: e.label });
      await user.click(radio);
      expect(radio).toHaveAttribute('aria-checked', 'true');
      // A click focuses the segment, never the panel around it (whose ring is for the keyboard).
      expect(radio).toHaveFocus();
      drawn.set(e.value, preview()!);
    }
    // Four expressions, four different drawings.
    expect(new Set(drawn.values()).size).toBe(EXPRESSIONS.length);
    await user.click(within(expression).getByRole('radio', { name: 'Smile' }));
    await user.click(screen.getByRole('button', { name: 'Save face' }));
    await waitFor(() => expect(posts()).toHaveLength(1));
    const saved = posts()[0]!.body!.face as FaceRecipe;
    expect(saved).toMatchObject(EXPRESSIONS.find((e) => e.value === 'smile')!.parts);
    // Each preview was the saved face wearing that expression: the recipe's eyes, brows and lips reach the drawing.
    for (const e of EXPRESSIONS) expect(drawn.get(e.value), e.value).toBe(illustratedFaceUri({ ...saved, ...e.parts }));
  });

  it('on the sample team, played as Malik: the help line names the team as its chip does, the expression help is plain', async () => {
    Object.assign(at, { owner: 'acme-design-demo', repo: 'bridge-demo-ds' });
    history.replaceState(null, '', '/studio/acme-design-demo/bridge-demo-ds/settings/?as=malik');
    try {
      const user = userEvent.setup();
      render(createElement(FaceSetting));
      await user.click(await screen.findByRole('button', { name: 'Change' }));
      expect(screen.getByText('Shuffle until it feels like you. Nobody in Acme Design gets the same face.')).toBeInTheDocument();
      expect(screen.queryByText(/Bridge demo ds/)).toBeNull();
      await user.click(screen.getByRole('button', { name: 'Pick the parts yourself' }));
      await user.click(screen.getByRole('tab', { name: 'Expression' }));
      expect(screen.getByText('Expressions show on bigger faces. In small rows, people recognise you by your hair.')).toBeInTheDocument();
      // The control hugs its segments (the page grid would stretch it): a page class that only places it.
      expect(screen.getByRole('radiogroup', { name: 'Expression' })).toHaveClass('yf-hug');
      await user.click(screen.getByRole('radio', { name: 'Curious' }));
      await user.click(screen.getByRole('button', { name: 'Save face' }));
      // Kept in this browser for the sample team, with the expression.
      await screen.findByText('Saved in this browser only: Acme Design is a sample team.');
      expect(JSON.parse(localStorage.getItem('bridge.face.sample.malik')!)).toMatchObject(EXPRESSIONS.find((e) => e.value === 'curious')!.parts);
      expect(posts()).toHaveLength(0);
    } finally {
      Object.assign(at, { owner: 'acme', repo: 'ds' });
    }
  });

  it('a style taken meanwhile is refused with the holder\'s name, the editor stays open', async () => {
    reply = (c) => (c.method === 'GET' ? json(200, { available: true, account: ACCOUNT }) : json(409, { error: 'face_taken', message: 'Leo already wears this hair style in Acme Design. Shuffle or pick another one.', holder: 'Leo' }));
    const user = userEvent.setup();
    render(createElement(FaceSetting));
    await user.click(await screen.findByRole('button', { name: 'Change' }));
    await user.click(screen.getByRole('button', { name: 'Shuffle' }));
    await user.click(screen.getByRole('button', { name: 'Save face' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Leo already wears this hair style in Acme Design. Shuffle or pick another one.');
    expect(screen.getByRole('button', { name: 'Save face' })).toBeInTheDocument();
  });

  // The parts are DS TabsPanels (focusable, for the keyboard). jsdom has no :focus-visible, so the DS rules are read:
  // a mouse click never draws the ring around a panel, and the keyboard ring sits a step off the panel's content.
  it('the parts panel ring is for the keyboard only, a step away from the content (DS Tabs)', () => {
    const css = readFileSync(join(__dirname, '../../../../../../packages/react/src/components/Tabs/Tabs.module.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    const rule = (selector: string) => new RegExp(`(^|\\n)${selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css)?.[2] ?? null;
    expect(rule('.panel:focus-visible')).toContain('outline: var(--focus-ring-width) solid var(--focus-ring-color)');
    expect(rule('.panel:focus-visible')).toContain('outline-offset: var(--space-1)');
    expect(rule('.panel:focus:not(:focus-visible)')).toContain('outline: none');
    expect(css).not.toMatch(/\.panel:focus\s*[,{]/);
  });
});
