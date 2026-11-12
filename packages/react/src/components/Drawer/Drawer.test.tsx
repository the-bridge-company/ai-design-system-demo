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
