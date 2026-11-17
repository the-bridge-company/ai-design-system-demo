import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { Button } from '../Button';
import { AlertDialog, AlertDialogContent, AlertDialogTrigger, confirmTextMatches } from './AlertDialog';

function DeleteTeam({ onConfirm = () => {}, confirmText = 'Marketing team' }: { onConfirm?: () => void; confirmText?: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="danger" />}>Delete team</AlertDialogTrigger>
      <AlertDialogContent
        title="Delete Marketing team?"
        description="Everyone on the team loses access at once. This cannot be undone."
        confirmLabel="Delete this team"
        confirmText={confirmText}
        onConfirm={onConfirm}
      />
    </AlertDialog>
  );
}

const confirmButton = (dialog: HTMLElement) => Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Delete this team')!;

describe('AlertDialog with a text to type (confirmText)', () => {
  it('focuses the field, which says what to type, and keeps confirm off', async () => {
    const user = userEvent.setup();
    render(<DeleteTeam />);
    await user.click(screen.getByRole('button', { name: 'Delete team' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Delete Marketing team?' });
    const field = screen.getByRole('textbox', { name: 'Type "Marketing team" to confirm' });
    await waitFor(() => expect(field).toHaveFocus());
    expect(field).toHaveAccessibleDescription('Delete this team stays off until the text matches.');
    expect(confirmButton(dialog)).toBeDisabled();
    await expectNoAxeViolations(dialog);
  });

  it('turns confirm on once the text matches, and confirms', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DeleteTeam onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Delete team' }));
    const dialog = await screen.findByRole('alertdialog');
    const field = screen.getByRole('textbox');
    await user.type(field, 'Marketing tea');
    expect(confirmButton(dialog)).toBeDisabled();
    await user.click(confirmButton(dialog));
    expect(onConfirm).not.toHaveBeenCalled();
    await user.type(field, 'm');
    expect(confirmButton(dialog)).toBeEnabled();
    await expectNoAxeViolations(dialog);
    await user.click(confirmButton(dialog));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('Enter confirms only once the text matches', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<DeleteTeam onConfirm={onConfirm} />);
    await user.click(screen.getByRole('button', { name: 'Delete team' }));
    const field = await screen.findByRole('textbox');
    await waitFor(() => expect(field).toHaveFocus());
    await user.keyboard('marketing team{Enter}');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await user.clear(field);
    await user.keyboard('  Marketing team {Enter}');
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
  });

  it('starts empty each time it opens', async () => {
    const user = userEvent.setup();
    render(<DeleteTeam />);
    await user.click(screen.getByRole('button', { name: 'Delete team' }));
    await user.type(await screen.findByRole('textbox'), 'Marketing');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Delete team' }));
    expect(await screen.findByRole('textbox')).toHaveValue('');
  });

  it('takes a label of its own', async () => {
    const user = userEvent.setup();
    render(
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="danger" />}>Delete account</AlertDialogTrigger>
        <AlertDialogContent title="Delete your account?" description="This cannot be undone." confirmLabel="Delete my account" confirmText="ines@acme.dev" confirmTextLabel="Your email" />
      </AlertDialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Delete account' }));
    expect(await screen.findByRole('textbox', { name: 'Your email' })).toBeInTheDocument();
  });

  it('without confirmText, stays a plain confirmation with focus on Cancel', async () => {
    const user = userEvent.setup();
    render(
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="danger" />}>Delete tokens</AlertDialogTrigger>
        <AlertDialogContent title="Delete 3 tokens?" description="This cannot be undone." confirmLabel="Delete tokens" />
      </AlertDialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Delete tokens' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus());
    expect(Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Delete tokens')).toBeEnabled();
  });

  it('matches with outer spaces ignored, case-sensitive', () => {
    expect(confirmTextMatches(' Marketing team ', 'Marketing team')).toBe(true);
    expect(confirmTextMatches('marketing team', 'Marketing team')).toBe(false);
    expect(confirmTextMatches('Marketing  team', 'Marketing team')).toBe(false);
    expect(confirmTextMatches('', 'Marketing team')).toBe(false);
  });
});

// The behaviors AlertDialog.docs.json declares, each played with its keys (or its click outside).
describe('AlertDialog behaviors', () => {
  function DeleteTokens() {
    return (
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="danger" />}>Delete tokens</AlertDialogTrigger>
        <AlertDialogContent title="Delete 3 tokens?" description="This cannot be undone." confirmLabel="Delete tokens" />
      </AlertDialog>
    );
  }
  const locked = () => document.documentElement.hasAttribute('data-base-ui-scroll-locked');
  const confirm = (dialog: HTMLElement) => Array.from(dialog.querySelectorAll('button')).find((b) => b.textContent === 'Delete tokens')!;

  it('Enter or Space on the trigger opens it', async () => {
    const user = userEvent.setup();
    render(<DeleteTokens />);
    const trigger = screen.getByRole('button', { name: 'Delete tokens' });
    trigger.focus();
    await user.keyboard('{Enter}');
    await screen.findByRole('alertdialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.keyboard(' ');
    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
  });

  it('Escape closes it, nothing confirmed, and focus returns to the trigger', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <AlertDialog>
        <AlertDialogTrigger render={<Button variant="danger" />}>Delete tokens</AlertDialogTrigger>
        <AlertDialogContent title="Delete 3 tokens?" description="This cannot be undone." confirmLabel="Delete tokens" onConfirm={onConfirm} />
      </AlertDialog>,
    );
    const trigger = screen.getByRole('button', { name: 'Delete tokens' });
    await user.click(trigger);
    await screen.findByRole('alertdialog');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('Tab keeps the focus on its two buttons', async () => {
    const user = userEvent.setup();
    render(<DeleteTokens />);
    await user.click(screen.getByRole('button', { name: 'Delete tokens' }));
    const dialog = await screen.findByRole('alertdialog');
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    await waitFor(() => expect(cancel).toHaveFocus());
    await user.keyboard('{Tab}');
    await waitFor(() => expect(confirm(dialog)).toHaveFocus());
    await user.keyboard('{Tab}');
    await waitFor(() => expect(cancel).toHaveFocus());
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    await waitFor(() => expect(confirm(dialog)).toHaveFocus());
  });

  it('a click outside does not close it', async () => {
    const user = userEvent.setup();
    render(<DeleteTokens />);
    await user.click(screen.getByRole('button', { name: 'Delete tokens' }));
    await screen.findByRole('alertdialog');
    await user.click(document.body);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('pauses the page scroll while open', async () => {
    const user = userEvent.setup();
    render(<DeleteTokens />);
    await waitFor(() => expect(locked()).toBe(false));
    await user.click(screen.getByRole('button', { name: 'Delete tokens' }));
    await screen.findByRole('alertdialog');
    await waitFor(() => expect(locked()).toBe(true));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(locked()).toBe(false));
  });
});
