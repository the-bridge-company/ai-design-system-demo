import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { Stepper } from './Stepper';

const steps = [{ label: 'Choose Card padding' }, { label: 'Dana decides', meta: 'now, for 3 days' }, { label: 'Live in Acme Prints' }];

describe('Stepper', () => {
  it('is a labelled ordered list; the current step has aria-current="step" and the others say their state', async () => {
    render(<Stepper label="What happens next" steps={steps} current={1} />);
    const list = screen.getByRole('list', { name: 'What happens next' });
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveAttribute('data-status', 'done');
    expect(items[0]).toHaveTextContent('Choose Card padding, done');
    expect(items[1]).toHaveAttribute('aria-current', 'step');
    expect(items[1]).toHaveTextContent('Dana decidesnow, for 3 days');
    expect(items[2]).toHaveAttribute('data-status', 'upcoming');
    expect(items[2]).toHaveTextContent('Live in Acme Prints, to come');
    expect(items[0]).not.toHaveAttribute('aria-current');
    await expectNoAxeViolations();
  });

  it('without current every step is to come; past the end every step is done', () => {
    const { rerender } = render(<Stepper label="Steps" steps={steps} />);
    expect(screen.getAllByRole('listitem').map((li) => li.getAttribute('data-status'))).toEqual(['upcoming', 'upcoming', 'upcoming']);
    rerender(<Stepper label="Steps" steps={steps} current={3} orientation="horizontal" />);
    expect(screen.getAllByRole('listitem').map((li) => li.getAttribute('data-status'))).toEqual(['done', 'done', 'done']);
  });
});
