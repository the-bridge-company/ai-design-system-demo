// @vitest-environment jsdom
// The demo gate on the sample team: a click on a marked action ([data-demo-write]) opens the demo dialog, which says
// what that action does on a real team (lib/demo.ts demoActionLine), then that nothing is sent, with "Get started".
// A refused write without a named action (a GitHub write through Bridge) says what the visitor clicked last.
import '../../../../packages/react/src/test/setup';
import { screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeAll, describe, expect, it } from 'vitest';
import { bindDemoGate, openMakeItYours } from './demo-gate';
import { demoActionLine, DEMO_WORDS } from '../lib/demo';

const SAMPLE = 'acme-design-demo/bridge-demo-ds';

beforeAll(async () => {
  // The gate loads the dialog on first use; a cold load of its component graph takes seconds in jsdom. Load it once
  // here so each case times the click and the dialog, not the first import.
  await import('../components/ds/studio/MakeItYours');
  bindDemoGate({ repo: () => SAMPLE, login: () => 'dana@acme.example', write: () => false, signIn: () => false, known: () => true, visitor: () => true, subscribe: () => {} });
});

const dialogText = async () => (await screen.findByRole('dialog')).textContent ?? '';

async function closeDialog() {
  await userEvent.click(screen.getByRole('button', { name: DEMO_WORDS.keepExploring }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

describe('the demo dialog says what the action does', () => {
  it.each([
    ['send to Figma', 'Send to Figma'],
    ['keep an exploration', 'Done exploring'],
    ['send a build request', 'Send a build request'],
    ['comment on changes', 'Comment'],
  ])('%s', async (mark, label) => {
    const btn = document.createElement('button');
    btn.dataset.demoWrite = mark;
    btn.textContent = label;
    document.body.append(btn);
    await userEvent.click(btn);
    const text = await dialogText();
    expect(text).toContain('This is a sample team.');
    expect(text).toContain(demoActionLine([mark]));
    expect(text).toContain(DEMO_WORDS.dialogLead);
    expect(screen.getByRole('link', { name: DEMO_WORDS.getStarted })).toBeTruthy();
    await closeDialog();
    btn.remove();
  });

  it.each([
    ['start explorations', 'Start an exploration'],
    ['start an exploration', 'Start an exploration'],
    ['say the design looks right', 'Looks right'],
  ])('%s runs in this browser on the sample team: no dialog, the page handles the click', async (mark, label) => {
    const btn = document.createElement('button');
    btn.dataset.demoWrite = mark;
    btn.textContent = label;
    let ran = false;
    btn.addEventListener('click', () => (ran = true));
    document.body.append(btn);
    await userEvent.click(btn);
    expect(ran).toBe(true);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByRole('dialog')).toBeNull();
    btn.remove();
  });

  it('a refused action the server names (set-pm) gets its line', async () => {
    await openMakeItYours('set-pm');
    expect(await dialogText()).toContain(demoActionLine(['set-pm']));
    await closeDialog();
  });

  it('a refused write with no name: the last thing clicked ("Needs changes", then the form\'s Send)', async () => {
    for (const label of ['Needs changes', 'Send']) {
      const b = document.createElement('button');
      b.textContent = label;
      document.body.append(b);
      await userEvent.click(b);
      b.remove();
    }
    await openMakeItYours();
    expect(await dialogText()).toContain(demoActionLine(['Needs changes']));
    await closeDialog();
  });
});
