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
