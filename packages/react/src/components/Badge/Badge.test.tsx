import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { Badge } from './Badge';

describe('Badge count', () => {
  it('renders the count as static text, its tone ignored', async () => {
    render(
      <h3>
        Foundations{' '}
        <Badge appearance="count" size="sm" tone="danger" aria-label="5 pieces">
          5
        </Badge>
      </h3>,
    );
    const tag = screen.getByText('5');
    expect(tag).toHaveClass('badge', 'count', 'sm');
    expect(tag).not.toHaveClass('subtle');
    expect(tag).not.toHaveClass('solid');
    expect(tag).not.toHaveAttribute('role');
    await expectNoAxeViolations();
  });

  it('sits in a current item without changing its name', async () => {
    render(
      <nav aria-label="Groups">
        <ul>
          <li>
            <a href="#colors" aria-current="true">
              Colors <Badge appearance="count" size="sm">4</Badge>
            </a>
          </li>
          <li>
            <a href="#type">
              Type <Badge appearance="count" size="sm">1</Badge>
            </a>
          </li>
        </ul>
      </nav>,
    );
    expect(screen.getByRole('link', { name: 'Colors 4' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText('4').closest('[aria-current="true"]')).not.toBeNull();
    expect(screen.getByText('1').closest('[aria-current]')).toBeNull();
    await expectNoAxeViolations();
  });
});
