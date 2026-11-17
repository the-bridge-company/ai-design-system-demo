import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { AlertDialog, AlertDialogContent, AlertDialogTrigger } from '../AlertDialog';
import { Button } from '../Button';
import { Input } from '../Input';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from './Dialog';

function RenameDialog() {
  return (
    <Dialog>
      <DialogTrigger render={<Button variant="secondary" />}>Rename token</DialogTrigger>
      <DialogContent
        title="Rename token"
        description="References update in the next release."
        footer={<DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>}
      >
        <Input label="New name" defaultValue="color.signal.default" />
      </DialogContent>
    </Dialog>
  );
}

describe('Dialog', () => {
  it('opens from the trigger, is named by its title and moves focus inside', async () => {
    const user = userEvent.setup();
    render(<RenameDialog />);
    const trigger = screen.getByRole('button', { name: 'Rename token' });
    await user.click(trigger);
    const dialog = await screen.findByRole('dialog', { name: 'Rename token' });
    expect(dialog).toHaveAccessibleDescription('References update in the next release.');
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    await expectNoAxeViolations(dialog);
  });

  it('Escape closes it and focus returns to the trigger', async () => {
    const user = userEvent.setup();
    render(<RenameDialog />);
    const trigger = screen.getByRole('button', { name: 'Rename token' });
    trigger.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('dialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('the close button and DialogClose close it', async () => {
    const user = userEvent.setup();
    render(<RenameDialog />);
    await user.click(screen.getByRole('button', { name: 'Rename token' }));
    await user.click(await screen.findByRole('button', { name: 'Close dialog' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Rename token' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});

// The behaviors Dialog.docs.json declares, each played with its keys (or its click outside).
describe('Dialog behaviors', () => {
  const locked = () => document.documentElement.hasAttribute('data-base-ui-scroll-locked');

  it('Space on the trigger opens it too', async () => {
    const user = userEvent.setup();
    render(<RenameDialog />);
    screen.getByRole('button', { name: 'Rename token' }).focus();
    await user.keyboard(' ');
    expect(await screen.findByRole('dialog', { name: 'Rename token' })).toBeInTheDocument();
  });

  it('Tab and Shift+Tab keep the focus inside: past the last control it wraps to the first', async () => {
    const user = userEvent.setup();
    render(<RenameDialog />);
    await user.click(screen.getByRole('button', { name: 'Rename token' }));
    await screen.findByRole('dialog');
    const field = screen.getByRole('textbox', { name: 'New name' });
    const close = screen.getByRole('button', { name: 'Close dialog' });
    await waitFor(() => expect(field).toHaveFocus());
    await user.keyboard('{Tab}');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());
    await user.keyboard('{Tab}');
    await waitFor(() => expect(close).toHaveFocus());
    await user.keyboard('{Tab}');
    await waitFor(() => expect(field).toHaveFocus());
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    await waitFor(() => expect(close).toHaveFocus());
  });

  it('a click outside closes it, unless disablePointerDismissal', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<RenameDialog />);
    await user.click(screen.getByRole('button', { name: 'Rename token' }));
    await screen.findByRole('dialog');
    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    unmount();
    render(
      <Dialog disablePointerDismissal>
        <DialogTrigger render={<Button variant="secondary" />}>Rename token</DialogTrigger>
        <DialogContent title="Rename token" />
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Rename token' }));
    await screen.findByRole('dialog');
    await user.click(document.body);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('pauses the page scroll while open', async () => {
    const user = userEvent.setup();
    render(<RenameDialog />);
    await waitFor(() => expect(locked()).toBe(false));
    await user.click(screen.getByRole('button', { name: 'Rename token' }));
    await screen.findByRole('dialog');
    await waitFor(() => expect(locked()).toBe(true));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(locked()).toBe(false));
  });
});

describe('AlertDialog', () => {
  it('is an alertdialog, focuses Cancel first and confirms', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="danger" />}>Delete tokens</AlertDialogTrigger>
        <AlertDialogContent
          title="Delete 3 tokens?"
          description="Components that use them fall back to their defaults. This cannot be undone."
          confirmLabel="Delete tokens"
          onConfirm={onConfirm}
        />
      </AlertDialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Delete tokens' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete 3 tokens?' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());
    await expectNoAxeViolations(dialog);
    const confirm = Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Delete tokens')!;
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });
});
