import { useRef } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Button } from '../Button';
import { Popover, PopoverContent, PopoverTrigger } from './Popover';

function Step() {
  const next = useRef<HTMLButtonElement>(null);
  return (
    <Popover>
      <PopoverTrigger render={<Button>Open</Button>} />
      <PopoverContent title="Step 1" initialFocus={next}>
        <Button variant="ghost">Skip tour</Button>
        <Button ref={next}>Next</Button>
      </PopoverContent>
    </Popover>
  );
}

describe('Popover', () => {
  it('opens on the trigger and moves focus to initialFocus instead of the first button', async () => {
    render(<Step />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next' })).toHaveFocus());
  });
});

// The behaviors Popover.docs.json declares, each played with its keys (or its click outside).
describe('Popover behaviors', () => {
  function Details() {
    return (
      <Popover>
        <PopoverTrigger render={<Button variant="secondary">Token details</Button>} />
        <PopoverContent title="color.bg.default">
          <Button variant="ghost">Copy name</Button>
        </PopoverContent>
      </Popover>
    );
  }

  it('Enter or Space on the trigger opens it and focus moves to its first control', async () => {
    const user = userEvent.setup();
    render(<Details />);
    const trigger = screen.getByRole('button', { name: 'Token details' });
    trigger.focus();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy name' })).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Copy name' })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.keyboard(' ');
    expect(await screen.findByRole('button', { name: 'Copy name' })).toBeInTheDocument();
  });

  it('Escape closes it and focus returns to the trigger', async () => {
    const user = userEvent.setup();
    render(<Details />);
    const trigger = screen.getByRole('button', { name: 'Token details' });
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy name' })).toHaveFocus());
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Copy name' })).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('a click outside closes it', async () => {
    const user = userEvent.setup();
    render(<Details />);
    await user.click(screen.getByRole('button', { name: 'Token details' }));
    expect(await screen.findByRole('button', { name: 'Copy name' })).toBeInTheDocument();
    await user.click(document.body);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Copy name' })).not.toBeInTheDocument());
  });
});
