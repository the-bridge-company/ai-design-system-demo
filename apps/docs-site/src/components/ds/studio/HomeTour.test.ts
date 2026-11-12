// @vitest-environment jsdom
// The home tour never sits on a dialog: a floating step waits while any dialog of the page is open (Add a product,
// Start an exploration, Account...) and comes back at the same step once it closes.
import '../../../../../../packages/react/src/test/setup';
import { createElement, useEffect, useState } from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Dialog, DialogContent } from '@bridge-ds/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dialogOpen, tourSide, useTour } from './HomeTour';
import { StudioHome, type StudioHomeProps } from './StudioHome';

const KEY = 'bridge.test.tour';
const words = (at: 'one' | 'two') => (at === 'one' ? { title: 'Changes wait for the lead', text: 'They review it.' } : { title: 'Start here', text: 'Pick a product.' });

// A home with a tour step and a dialog the page opens on its own (a link, a repaint), never through the tour.
function Home({ dialog = false }: { dialog?: boolean }) {
  const [open, setOpen] = useState(dialog);
  useEffect(() => setOpen(dialog), [dialog]);
  const tour = useTour<'one' | 'two'>(KEY, ['one', 'two'], words, true);
  return createElement(
    'div',
    null,
    tour('one'),
    tour('two'),
    createElement(Dialog, { open, onOpenChange: setOpen }, createElement(DialogContent, { title: 'Add a product' }, createElement('p', null, 'Pick a product.'))),
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.body.innerHTML = '';
});

describe('HomeTour under dialogs', () => {
  it('hides the floating step while a dialog is open, then shows the same step again', async () => {
    const { rerender } = render(createElement(Home));
    expect(await screen.findByText('Changes wait for the lead')).toBeTruthy();

    rerender(createElement(Home, { dialog: true }));
    expect(await screen.findByRole('dialog', { name: 'Add a product' })).toBeTruthy();
    await waitFor(() => expect(screen.queryByText('Changes wait for the lead')).toBeNull());

    await userEvent.keyboard('{Escape}');
    expect(await screen.findByText('Changes wait for the lead')).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Add a product' })).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('counts open dialogs only: not popovers, not a dialog kept closed, not the tour itself', () => {
    const add = (html: string) => {
      const el = document.createElement('div');
      el.innerHTML = html;
      document.body.append(el);
      return el;
    };
    expect(dialogOpen()).toBe(false);
    add('<div role="dialog" data-open data-side="bottom">A popover</div>');
    add('<div hidden><div role="dialog" aria-modal="true">Search, closed</div></div>');
    add('<div class="dh-tour" role="dialog" data-open>The tour</div>');
    expect(dialogOpen()).toBe(false);
    const alert = add('<div role="alertdialog" data-open>Delete the team?</div>');
    expect(dialogOpen()).toBe(true);
    alert.remove();
    add('<div role="dialog" aria-modal="true">Account</div>');
    expect(dialogOpen()).toBe(true);
  });
});

// The tour is a transient overlay: opening it never changes the Harbor hero's height (no blank room reserved under
// what it points at, the regression of PR #1108). Checked on the layout contract, not in a browser: the hero holds the
// same boxes with the tour open or done, plus one anchor whose CSS takes no room.
describe('HomeTour takes no room in the hero', () => {
  const css = readFileSync(join(__dirname, '../../../styles/demo-home.css'), 'utf8');
  const homeCss = readFileSync(join(__dirname, '../../../styles/studio-home.css'), 'utf8');
  /** The declarations of one exact selector's rule. */
  const rule = (src: string, selector: string) => {
    const at = src.indexOf(`\n${selector} {`);
    expect(at, selector).toBeGreaterThan(-1);
    return src.slice(at, src.indexOf('}', at));
  };
  const empty: StudioHomeProps = {
    state: 'empty',
    greeting: 'Good morning, Sofia.',
    needs: [],
    branches: [],
    explorations: [],
    health: null,
    now: Date.parse('2026-11-12T10:00:00Z'),
    components: [],
    signedOut: { line: '', button: '', signIn: true },
    failed: null,
    startHrefs: { tokens: '#t', component: '#c', guidance: '#g' },
    contributor: true,
  };
  /** The hero's markup without the tour's anchor: the boxes that set its height. */
  const hero = (root: HTMLElement) => {
    const zone = root.querySelector<HTMLElement>('.sh-zone')!.cloneNode(true) as HTMLElement;
    // Base UI's helpers by the trigger (focus guards, the aria-owns span) are position: fixed and clipped: out of the flow.
    zone.querySelectorAll('.dh-tour-anchor, [style*="position: fixed"]').forEach((a) => a.remove());
    // Base UI ids differ between renders.
    return zone.outerHTML.replace(/ (id|aria-controls|aria-describedby|aria-labelledby)="[^"]*"/g, '');
  };

  it('keeps the hero the same with the tour open: no reserved room, the step floats outside it', async () => {
    const open = render(createElement(StudioHome, empty));
    expect(await screen.findByText('Where to start')).toBeTruthy();
    const withTour = open.container;
    const zone = withTour.querySelector<HTMLElement>('.sh-zone')!;
    // The step is portaled out of the hero; nothing inside the hero has a size of its own from the tour.
    expect(zone.contains(screen.getByText('Where to start'))).toBe(false);
    // (Base UI's focus guards are position: fixed, 1px and clipped: out of the flow.)
    const sized = [...zone.querySelectorAll<HTMLElement>('.dh-tour-room, [data-tour-inline], [style*="block-size"], [style*="height"]')];
    expect(sized.filter((el) => el.style.position !== 'fixed')).toEqual([]);
    // One anchor, beside the primary button in its row.
    const anchors = zone.querySelectorAll('.dh-tour-anchor');
    expect(anchors).toHaveLength(1);
    expect(anchors[0]!.classList.contains('dh-tour-anchor-beside')).toBe(true);
    expect(anchors[0]!.parentElement!.classList.contains('sh-start')).toBe(true);
    const openHero = hero(withTour);
    cleanup();

    localStorage.setItem('bridge.home.contributor-tour', 'done');
    const closed = render(createElement(StudioHome, empty));
    expect(screen.queryByText('Where to start')).toBeNull();
    expect(closed.container.querySelector('.dh-tour-anchor')).toBeNull();
    expect(hero(closed.container)).toBe(openHero);
  });

  it('gives the anchor no size and no gap, and reserves nothing (CSS contract)', () => {
    expect(css).not.toMatch(/dh-tour-room/);
    expect(css).not.toMatch(/dh-tour-inline/);
    const below = rule(css, '.dh-tour-anchor-below');
    expect(below).toMatch(/position: absolute;/);
    expect(below).toMatch(/block-size: 0;/);
    expect(below).not.toMatch(/margin/);
    const beside = rule(css, '.dh-tour-anchor-beside');
    expect(beside).toMatch(/inline-size: 0;/);
    expect(beside).not.toMatch(/margin|padding|min-|block-size/);
    // Its row has no gap, so a zero-width item adds no width; its height is the button's (align-self: stretch).
    expect(rule(homeCss, '.sh-start')).not.toMatch(/gap/);
    expect(rule(css, ':has(> .dh-tour-anchor-below)')).toMatch(/^\s*\n?:has\(> \.dh-tour-anchor-below\) \{\s*position: relative;\s*$/);
  });

  it('floats beside the button, over the drawing, and under a block elsewhere', () => {
    expect(tourSide('beside')).toEqual({ side: 'inline-end', align: 'start' });
    expect(tourSide('below')).toEqual({ side: 'bottom', align: 'start' });
  });
});
