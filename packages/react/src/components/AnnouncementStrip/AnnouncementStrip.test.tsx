import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CalendarCheck } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { Link } from '../Link';
import styles from './AnnouncementStrip.module.css';
import { AnnouncementStrip } from './AnnouncementStrip';

const c = (key: string) => styles[key] as string;

const strip = (props: Partial<Parameters<typeof AnnouncementStrip>[0]> = {}) => (
  <AnnouncementStrip label="Founding teams" icon={CalendarCheck} action={<Link href="/pricing/#founding">Read the commitment</Link>} {...props}>
    Paid plans open in 2027. Teams created by 31 March 2027 stay <strong>FREE</strong>, with no end date.
  </AnnouncementStrip>
);

describe('AnnouncementStrip', () => {
  it('is a complementary landmark named by its label, with the message and one link reached by Tab', async () => {
    render(strip());
    const region = screen.getByRole('complementary', { name: 'Founding teams' });
    expect(region).toHaveTextContent('Paid plans open in 2027. Teams created by 31 March 2027 stay FREE, with no end date.');
    expect(region.querySelector('strong')).toHaveTextContent('FREE');
    expect(region.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    await userEvent.tab();
    expect(screen.getByRole('link', { name: 'Read the commitment' })).toHaveFocus();
    await expectNoAxeViolations();
  });

  it('is not a live region and has no close button', () => {
    render(strip());
    const region = screen.getByRole('complementary');
    expect(region).not.toHaveAttribute('aria-live');
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('harbor by default, neutral on request', async () => {
    const { rerender } = render(strip());
    expect(screen.getByRole('complementary')).toHaveClass(c('strip'), c('harbor'));
    rerender(strip({ appearance: 'neutral' }));
    expect(screen.getByRole('complementary')).toHaveClass(c('strip'), c('neutral'));
    expect(screen.getByRole('complementary')).not.toHaveClass(c('harbor'));
    await expectNoAxeViolations();
  });

  it('works without an icon or a link', () => {
    render(<AnnouncementStrip label="Notice">Bridge is free for every team today.</AnnouncementStrip>);
    const region = screen.getByRole('complementary', { name: 'Notice' });
    expect(region.querySelector('svg')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('with href, the whole strip is one link whose text is the message, and no separate action shows', async () => {
    const { container } = render(
      <AnnouncementStrip label="Founding teams" icon={CalendarCheck} href="/pricing/#founding" action={<Link href="/x">Read the commitment</Link>}>
        Teams created by 31 March 2027 stay <strong>FREE</strong>.
      </AnnouncementStrip>,
    );
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute('href', '/pricing/#founding');
    expect(links[0]).toHaveTextContent('Teams created by 31 March 2027 stay FREE.');
    expect(screen.getByRole('complementary', { name: 'Founding teams' })).toContainElement(links[0]!);
    await expectNoAxeViolations(container);
  });
});
