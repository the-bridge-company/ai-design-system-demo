import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import { useState } from 'react';
import { showTabsPanel } from '../../dom';
import { Tab, Tabs, TabsList, TabsPanel, watchOverflowEdges } from './Tabs';

function Example({ activateOnFocus = false, onValueChange }: { activateOnFocus?: boolean; onValueChange?: (v: unknown) => void }) {
  return (
    <Tabs defaultValue="tokens" onValueChange={onValueChange}>
      <TabsList aria-label="Library views" activateOnFocus={activateOnFocus}>
        <Tab value="tokens">Tokens</Tab>
        <Tab value="components">Components</Tab>
        <Tab value="archived" disabled>Archived</Tab>
        <Tab value="changelog">Changelog</Tab>
      </TabsList>
      <TabsPanel value="tokens">Token table</TabsPanel>
      <TabsPanel value="components">Component list</TabsPanel>
      <TabsPanel value="archived">Archived items</TabsPanel>
      <TabsPanel value="changelog">Release notes</TabsPanel>
    </Tabs>
  );
}

describe('Tabs', () => {
  it('exposes tablist, tabs and a labelled panel', async () => {
    render(<Example />);
    expect(screen.getByRole('tablist', { name: 'Library views' })).toBeInTheDocument();
    const tokens = screen.getByRole('tab', { name: 'Tokens' });
    expect(tokens).toHaveAttribute('aria-selected', 'true');
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveTextContent('Token table');
    expect(tokens.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(tokens.id);
    await expectNoAxeViolations();
  });

  it('arrow keys move focus, disabled tabs cannot be selected, Enter selects', async () => {
    const onValueChange = vi.fn();
    render(<Example onValueChange={onValueChange} />);
    await userEvent.tab();
    expect(screen.getByRole('tab', { name: 'Tokens' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Components' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    const archived = screen.getByRole('tab', { name: 'Archived' });
    if (document.activeElement === archived) {
      await userEvent.keyboard('{Enter}');
      expect(archived).toHaveAttribute('aria-selected', 'false');
      await userEvent.keyboard('{ArrowRight}');
    }
    expect(screen.getByRole('tab', { name: 'Changelog' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('tab', { name: 'Changelog' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Release notes');
    expect(onValueChange).toHaveBeenCalledWith('changelog');
  });

  it('activateOnFocus selects on arrow', async () => {
    render(<Example activateOnFocus />);
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Components' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Component list');
  });
});

// The tabs on their own (an island) and the panels after them, outside the Tabs root (static, or holding islands).
function LinkedExample({ onShow }: { onShow?: (v: string) => void }) {
  const [value, setValue] = useState('usage');
  const pick = (v: unknown) => {
    setValue(String(v));
    showTabsPanel(document, String(v));
    onShow?.(String(v));
  };
  return (
    <>
      <Tabs value={value} onValueChange={pick}>
        <TabsList aria-label="Button documentation">
          <Tab value="usage" id="tab-usage-btn" aria-controls="tab-usage">
            Usage
          </Tab>
          <Tab value="code" id="tab-code-btn" aria-controls="tab-code">
            Code
          </Tab>
        </TabsList>
      </Tabs>
      <TabsPanel value="usage" id="tab-usage" tabId="tab-usage-btn">
        When to use it
      </TabsPanel>
      <TabsPanel value="code" id="tab-code" tabId="tab-code-btn" hidden>
        Props
      </TabsPanel>
    </>
  );
}

describe('TabsPanel outside its Tabs root', () => {
  it('renders a linked panel: labelled by its tab, focusable, marked with its value', async () => {
    render(<LinkedExample />);
    const usage = screen.getByRole('tab', { name: 'Usage' });
    const panel = screen.getByRole('tabpanel', { name: 'Usage' });
    expect(panel).toHaveTextContent('When to use it');
    expect(panel).toHaveAttribute('tabindex', '0');
    expect(panel).toHaveAttribute('data-tabs-panel', 'usage');
    expect(usage).toHaveAttribute('aria-controls', panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(usage.id);
    await expectNoAxeViolations();
  });

  it('starts shown without script (no hidden unless the page sets it)', () => {
    render(
      <>
        <TabsPanel value="a" tabId="t-a">A</TabsPanel>
        <TabsPanel value="b" tabId="t-b">B</TabsPanel>
      </>,
    );
    expect(screen.getByText('A')).toBeVisible();
    expect(screen.getByText('B')).toBeVisible();
  });

  it('the keyboard picks a tab and showTabsPanel shows its panel', async () => {
    const onShow = vi.fn();
    render(<LinkedExample onShow={onShow} />);
    await userEvent.tab();
    expect(screen.getByRole('tab', { name: 'Usage' })).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}{Enter}');
    expect(onShow).toHaveBeenCalledWith('code');
    expect(screen.getByRole('tab', { name: 'Code' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel', { name: 'Code' })).toHaveTextContent('Props');
    expect(screen.getByText('When to use it')).not.toBeVisible();
    await userEvent.tab();
    expect(screen.getByRole('tabpanel', { name: 'Code' })).toHaveFocus();
  });
});

describe('showTabsPanel', () => {
  it('shows the panel of the value, hides the rest in scope only, and returns it', () => {
    document.body.innerHTML =
      '<section id="one"><div data-tabs-panel="a">A</div><div data-tabs-panel="b">B</div></section>' +
      '<section id="two"><div data-tabs-panel="a">other A</div></section>';
    const one = document.getElementById('one')!;
    const shown = showTabsPanel(one, 'b');
    expect(shown?.textContent).toBe('B');
    expect(one.querySelector<HTMLElement>('[data-tabs-panel="a"]')!.hidden).toBe(true);
    expect(document.querySelector<HTMLElement>('#two [data-tabs-panel]')!.hidden).toBe(false);
    expect(showTabsPanel(one, 'missing')).toBeNull();
    document.body.innerHTML = '';
  });
});

describe('watchOverflowEdges', () => {
  const list = (scrollWidth: number, clientWidth: number) => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth });
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth });
    return el;
  };

  it('marks the end of a row that scrolls, then both edges, then the start once at the end', () => {
    const el = list(600, 390);
    const stop = watchOverflowEdges(el);
    expect(el.hasAttribute('data-overflow-end')).toBe(true);
    expect(el.hasAttribute('data-overflow-start')).toBe(false);
    el.scrollLeft = 100;
    el.dispatchEvent(new Event('scroll'));
    expect(el.hasAttribute('data-overflow-start')).toBe(true);
    expect(el.hasAttribute('data-overflow-end')).toBe(true);
    el.scrollLeft = 210;
    el.dispatchEvent(new Event('scroll'));
    expect(el.hasAttribute('data-overflow-end')).toBe(false);
    stop();
  });

  it('marks nothing when every tab fits', () => {
    const el = list(300, 390);
    watchOverflowEdges(el)();
    expect(el.hasAttribute('data-overflow-start') || el.hasAttribute('data-overflow-end')).toBe(false);
  });
});

// The panel's ring is for the keyboard (Tabs.module.css: :focus-visible only, a pointer focus draws none); a click on
// a control inside the panel leaves focus on that control, so the panel never takes it.
describe('TabsPanel focus', () => {
  it('a click on a button inside the panel leaves focus on the button', async () => {
    render(
      <Tabs defaultValue="a">
        <TabsList aria-label="Parts">
          <Tab value="a">A</Tab>
        </TabsList>
        <TabsPanel value="a">
          <button type="button">Smile</button>
        </TabsPanel>
      </Tabs>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Smile' }));
    expect(screen.getByRole('button', { name: 'Smile' })).toHaveFocus();
    expect(screen.getByRole('tabpanel')).not.toHaveFocus();
  });
});

// The selected look and the focus ring are CSS contracts, checked in apps/docs-site/src/lib/tab-like-controls.test.ts
// (Vitest empties stylesheets here, and jsdom has no :focus-visible).
describe('Tabs selection', () => {
  it('a clicked tab is selected and has no axe violations', async () => {
    render(<Example />);
    await userEvent.click(screen.getByRole('tab', { name: 'Components' }));
    expect(screen.getByRole('tab', { name: 'Components' })).toHaveAttribute('aria-selected', 'true');
    await expectNoAxeViolations();
  });
});
