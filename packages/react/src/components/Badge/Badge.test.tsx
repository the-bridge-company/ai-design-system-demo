import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { SegmentedControl } from '../SegmentedControl';
import { SidebarNav, SidebarNavItem, SidebarNavSection } from '../SidebarNav';
import { Tab, Tabs, TabsList } from '../Tabs';
import { Badge } from './Badge';

describe('Badge count', () => {
  it('renders the count tag as static text, its tone ignored', async () => {
    render(
      <p>
        Explorations{' '}
        <Badge appearance="count" size="sm" tone="danger" aria-label="2 waiting on you">
          2
        </Badge>
      </p>,
    );
    const tag = screen.getByText('2');
    expect(tag).toHaveClass('badge', 'count', 'sm');
    expect(tag).not.toHaveClass('subtle');
    expect(tag).not.toHaveAttribute('role');
    await expectNoAxeViolations();
  });

  it('is the one count tag of Tabs, SegmentedControl and SidebarNav', async () => {
    render(
      <>
        <Tabs defaultValue="open">
          <TabsList aria-label="Reviews">
            <Tab value="open" count={3}>
              Open
            </Tab>
            <Tab value="done" count={12}>
              Done
            </Tab>
          </TabsList>
        </Tabs>
        <SegmentedControl label="Status" items={[{ value: 'all', label: 'All', count: 8 }, { value: 'mine', label: 'Mine', count: 2 }]} defaultValue="all" />
        <SidebarNav aria-label="Studio">
          <SidebarNavSection title="Studio">
            <SidebarNavItem href="/explorations" active count={4}>
              Explorations
            </SidebarNavItem>
            <SidebarNavItem href="/review" count={5}>
              Library review
            </SidebarNavItem>
          </SidebarNavSection>
        </SidebarNav>
      </>,
    );
    for (const n of ['3', '12', '8', '2', '4', '5']) {
      const tag = screen.getByText(n);
      expect(tag).toHaveClass('badge', 'count', 'sm');
    }
    // The selected tab, checked segment and current nav item hold their count: the context that takes the stronger tone.
    expect(screen.getByText('3').closest('[aria-selected="true"]')).not.toBeNull();
    expect(screen.getByText('8').closest('[aria-checked="true"]')).not.toBeNull();
    expect(screen.getByText('4').closest('[aria-current="page"]')).not.toBeNull();
    expect(screen.getByText('5').closest('[aria-current="page"]')).toBeNull();
    expect(screen.getByRole('link', { name: 'Explorations 4' })).toBeInTheDocument();
    await expectNoAxeViolations();
  });
});
