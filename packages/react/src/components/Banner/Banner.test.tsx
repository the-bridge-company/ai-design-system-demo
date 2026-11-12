import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Eye } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { Button } from '../Button';
import { Link } from '../Link';
import styles from './Banner.module.css';
import { Banner } from './Banner';

const c = (key: string) => styles[key] as string;
const TITLE = 'Viewing the library as change #118. Nothing is saved.';

describe('Banner', () => {
  it('is a region named by its title; the way back follows the title in Tab order', async () => {
    const onBack = vi.fn();
    render(
      <Banner icon={Eye} title={TITLE} actions={<Button size="sm" variant="secondary" onClick={onBack}>Back to latest library</Button>}>
        Publishing stays off until you go back.
      </Banner>,
    );
    const region = screen.getByRole('region', { name: TITLE });
    expect(region).toHaveTextContent('Publishing stays off until you go back.');
    expect(region.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Back to latest library' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onBack).toHaveBeenCalledTimes(1);
    await expectNoAxeViolations();
  });

  it('is not a live region', () => {
    render(<Banner title={TITLE} />);
    const region = screen.getByRole('region', { name: TITLE });
    expect(region).not.toHaveAttribute('aria-live');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('applies the appearance and sticky classes', () => {
    const { rerender } = render(<Banner title={TITLE} />);
    const region = () => screen.getByRole('region');
    expect(region()).toHaveClass(c('banner'), c('strong'));
    expect(region()).not.toHaveClass(c('stickyTop'));
    expect(region()).not.toHaveClass(c('stickyHeader'));
    rerender(<Banner title={TITLE} appearance="neutral" sticky="top" />);
    expect(region()).toHaveClass(c('neutral'), c('stickyTop'));
    expect(region()).not.toHaveClass(c('strong'));
    rerender(<Banner title={TITLE} appearance="harbor" />);
    expect(region()).toHaveClass(c('banner'), c('harbor'));
    expect(region()).not.toHaveClass(c('strong'));
    expect(region()).not.toHaveClass(c('neutral'));
    rerender(<Banner title={TITLE} sticky="below-header" />);
    expect(region()).toHaveClass(c('stickyHeader'));
    expect(region()).not.toHaveClass(c('stickyTop'));
  });

  it('two banners keep distinct names', async () => {
    render(
      <>
        <Banner title="Viewing the library as change #118." />
        <Banner appearance="neutral" title="Editing the Button guidelines" />
      </>,
    );
    expect(screen.getByRole('region', { name: 'Viewing the library as change #118.' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Editing the Button guidelines' })).toBeInTheDocument();
    await expectNoAxeViolations();
  });

  it('harbor: a designer note is a region named by its title, its link reached with Tab, no axe violations', async () => {
    render(
      <Banner appearance="harbor" icon={Eye} title="Ana Ruiz decides what joins the library." actions={<Link href="#how">How library review works</Link>}>
        Leave a comment on any piece; your lead sees it before deciding.
      </Banner>,
    );
    const region = screen.getByRole('region', { name: 'Ana Ruiz decides what joins the library.' });
    expect(region).toHaveClass(c('harbor'));
    expect(region).toHaveTextContent('Leave a comment on any piece');
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'How library review works' })).toHaveFocus();
    await expectNoAxeViolations();
  });
});
