import { renderToStaticMarkup } from 'react-dom/server';
import { fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { Switch } from '../components/Switch';
import { bindSwitches, switchHtml } from './index';

const classesOf = (html: string, sel: string) => {
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.querySelector(sel)?.className;
};

describe('switchHtml', () => {
  let unbind: (() => void) | null = null;
  afterEach(() => {
    unbind?.();
    unbind = null;
    document.body.innerHTML = '';
  });

  it('gives the label, track and thumb the same classes and state attributes as <Switch>', () => {
    for (const props of [{ size: 'sm' as const, checked: true }, { size: 'md' as const, checked: false }, { labelPlacement: 'start' as const }]) {
      const react = renderToStaticMarkup(<Switch label="Show demo history" {...props} />);
      const dom = switchHtml('Show demo history', props);
      expect(classesOf(dom, 'label')).toBe(classesOf(react, 'label'));
      expect(classesOf(dom, '[role="switch"]')).toBe(classesOf(react, '[role="switch"]'));
      expect(classesOf(dom, '[role="switch"] > span')).toBe(classesOf(react, '[role="switch"] > span'));
      const state = props.checked ? 'data-checked' : 'data-unchecked';
      expect(dom).toContain(`aria-checked="${Boolean(props.checked)}"`);
      expect(dom.match(new RegExp(state, 'g'))).toHaveLength(2);
    }
  });

  it('is named by its label, toggles on click once bound, fires change, and passes axe', async () => {
    document.body.innerHTML = switchHtml('Show <demo> history', { attributes: { 'data-hs-demo': true } });
    unbind = bindSwitches();
    const sw = screen.getByRole('switch', { name: 'Show <demo> history' });
    expect(sw).toHaveAttribute('data-hs-demo');
    const onChange = vi.fn();
    sw.addEventListener('change', onChange);
    fireEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
    expect(sw).toHaveAttribute('data-checked');
    expect(sw.firstElementChild).toHaveAttribute('data-checked');
    expect(onChange).toHaveBeenCalledTimes(1);
    await expectNoAxeViolations();
  });

  it('a disabled switch does not toggle', () => {
    document.body.innerHTML = switchHtml('Locked', { checked: true, disabled: true });
    unbind = bindSwitches();
    const sw = screen.getByRole('switch', { name: 'Locked' });
    fireEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });
});
