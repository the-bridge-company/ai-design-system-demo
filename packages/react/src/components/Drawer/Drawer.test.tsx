import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { Button } from '../Button';
import { Drawer, DrawerContent, DrawerTrigger } from './Drawer';

function stubHeights(scrollHeight: number, clientHeight: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(scrollHeight);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(clientHeight);
}

function Changes() {
  return (
    <Drawer>
      <DrawerTrigger render={<Button variant="secondary" />}>Review changes</DrawerTrigger>
      <DrawerContent title="Token changes" description="Read them all before you approve.">
        <p>color.surface.default moved to the new neutral ramp.</p>
      </DrawerContent>
    </Drawer>
  );
}

async function open() {
  const user = userEvent.setup();
  render(<Changes />);
  await user.click(screen.getByRole('button', { name: 'Review changes' }));
  const dialog = await screen.findByRole('dialog', { name: 'Token changes' });
  return { user, dialog };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Drawer', () => {
  it('opens named by its title and keeps focus inside', async () => {
    stubHeights(100, 100);
    const { dialog } = await open();
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await expectNoAxeViolations(dialog);
  });

  it('a body that overflows is a focusable region named by the title', async () => {
    stubHeights(2000, 400);
    const { user, dialog } = await open();
    const region = await screen.findByRole('region', { name: 'Token changes' });
    expect(region).toHaveAttribute('tabindex', '0');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    // Initial focus is unchanged (Base UI decides); from the close button, Tab reaches the body next.
    screen.getByRole('button', { name: 'Close panel' }).focus();
    await user.tab();
    expect(region).toHaveFocus();
    await expectNoAxeViolations(dialog);
  });

  it('a body that fits adds no tab stop', async () => {
    stubHeights(200, 400);
    const { dialog } = await open();
    const body = screen.getByText(/color.surface.default/).parentElement!;
    expect(body).not.toHaveAttribute('tabindex');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    await expectNoAxeViolations(dialog);
  });

  it('keepMounted: the body and footer exist before the first open, hidden, and the sheet opens as usual', async () => {
    stubHeights(100, 100);
    const user = userEvent.setup();
    render(
      <Drawer>
        <DrawerTrigger render={<Button variant="secondary" />}>Review changes</DrawerTrigger>
        <DrawerContent keepMounted title="Token changes" footer={<button type="button" data-send>Send for review</button>}>
          <div data-review-body>Filled by a script</div>
        </DrawerContent>
      </Drawer>,
    );
    // Closed: in the DOM for a script to bind, but not shown to anyone.
    const body = document.querySelector('[data-review-body]');
    const send = document.querySelector('[data-send]');
    expect(body).not.toBeNull();
    expect(send).not.toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send for review' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Review changes' }));
    const dialog = await screen.findByRole('dialog', { name: 'Token changes' });
    // Same nodes as before the open: what the script bound is what the user gets.
    expect(dialog).toContainElement(body as HTMLElement);
    expect(dialog).toContainElement(send as HTMLElement);
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await expectNoAxeViolations(dialog);

    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(document.querySelector('[data-review-body]')).toBe(body);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Review changes' })).toHaveFocus());
  });
});

// The behaviors Drawer.docs.json declares, each played with its keys (or its click outside).
describe('Drawer behaviors', () => {
  function Filters({ disablePointerDismissal = false }: { disablePointerDismissal?: boolean }) {
    return (
      <Drawer disablePointerDismissal={disablePointerDismissal}>
        <DrawerTrigger render={<Button variant="secondary" />}>Filters</DrawerTrigger>
        <DrawerContent title="Filters" footer={<Button>Apply</Button>}>
          <p>Status</p>
        </DrawerContent>
      </Drawer>
    );
  }
  const locked = () => document.documentElement.hasAttribute('data-base-ui-scroll-locked');

  it('Enter or Space on the trigger opens it, focus moves inside, Escape closes and focus returns', async () => {
    stubHeights(100, 100);
    const user = userEvent.setup();
    render(<Filters />);
    const trigger = screen.getByRole('button', { name: 'Filters' });
    trigger.focus();
    await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Filters' });
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.keyboard(' ');
    expect(await screen.findByRole('dialog', { name: 'Filters' })).toBeInTheDocument();
  });

  it('Tab keeps the focus inside: past the last control it wraps to the first', async () => {
    stubHeights(100, 100);
    const user = userEvent.setup();
    render(<Filters />);
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    const dialog = await screen.findByRole('dialog');
    const close = screen.getByRole('button', { name: 'Close panel' });
    const apply = screen.getByRole('button', { name: 'Apply' });
    // The sheet itself takes the focus first, then Tab walks its controls.
    await waitFor(() => expect(dialog).toHaveFocus());
    await user.keyboard('{Tab}');
    await waitFor(() => expect(close).toHaveFocus());
    await user.keyboard('{Tab}');
    await waitFor(() => expect(apply).toHaveFocus());
    await user.keyboard('{Tab}');
    await waitFor(() => expect(close).toHaveFocus());
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    await waitFor(() => expect(apply).toHaveFocus());
  });

  it('a click outside closes it, unless disablePointerDismissal', async () => {
    stubHeights(100, 100);
    const user = userEvent.setup();
    const { unmount } = render(<Filters />);
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await screen.findByRole('dialog');
    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    unmount();
    render(<Filters disablePointerDismissal />);
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await screen.findByRole('dialog');
    await user.click(document.body);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('pauses the page scroll while open', async () => {
    stubHeights(100, 100);
    const user = userEvent.setup();
    render(<Filters />);
    await waitFor(() => expect(locked()).toBe(false));
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await screen.findByRole('dialog');
    await waitFor(() => expect(locked()).toBe(true));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(locked()).toBe(false));
  });
});
