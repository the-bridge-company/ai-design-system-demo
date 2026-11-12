// Drawer outside React: parity of drawerHtml() with <DrawerContent>, and the Dialog behaviour it opens with.
import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { expectNoAxeViolations } from '../test/axe';
import { Drawer, DrawerContent, type DrawerContentProps, type DrawerSide } from '../components/Drawer';
import { closeDialog, drawerHtml, isDialogOpen, openDialog, trusted, type DrawerHtmlOptions } from './index';

/** Elements, classes, text and the attributes users and assistive tech see; ids, styles and framework internals dropped. */
function shape(el: Element): string {
  const keep = ['role', 'type', 'aria-label', 'aria-hidden'];
  const a = keep.filter((n) => el.hasAttribute(n)).map((n) => ` ${n}="${el.getAttribute(n)}"`);
  const cls = el.getAttribute('class');
  const kids = [...el.childNodes].map((n) => (n.nodeType === 3 ? n.textContent : n instanceof Element ? shape(n) : '')).join('');
  return `<${el.tagName.toLowerCase()}${cls ? ` class="${cls}"` : ''}${a.join('')}>${kids}</${el.tagName.toLowerCase()}>`;
}

const reactDrawer = async (side: DrawerSide, props: Omit<DrawerContentProps, 'title'> & { title: string }) => {
  const r = render(
    <Drawer defaultOpen side={side}>
      <DrawerContent {...props} />
    </Drawer>,
  );
  const popup = await r.findByRole('dialog');
  const out = {
    popup: shape(popup),
    viewport: popup.parentElement!.getAttribute('class'),
    name: document.getElementById(popup.getAttribute('aria-labelledby')!)!.textContent,
  };
  r.unmount();
  return out;
};

const domDrawer = (opts: DrawerHtmlOptions) => {
  document.body.innerHTML = drawerHtml(opts);
  const popup = document.querySelector('[role="dialog"]')!;
  const out = {
    popup: shape(popup),
    viewport: popup.parentElement!.getAttribute('class'),
    name: document.getElementById(popup.getAttribute('aria-labelledby')!)!.textContent,
  };
  document.body.innerHTML = '';
  return out;
};

afterEach(() => {
  for (const el of document.querySelectorAll('[data-bridge-dialog]')) closeDialog(el as HTMLElement);
  document.body.innerHTML = '';
});

describe('drawerHtml', () => {
  it.each([
    ['end', { title: 'color.bg.default' }, {}],
    ['start', { title: 'Filters', size: 'sm' as const, children: <p>Body</p> }, { body: '<p>Body</p>' }],
    ['bottom', { title: 'Details', size: 'lg' as const, hideClose: true, className: 'x' }, {}],
  ] as Array<[DrawerSide, DrawerContentProps & { title: string }, { body?: string }]>)('matches <Drawer side=%s> <DrawerContent %j>', async (side, props, html) => {
    const { children: _c, ...rest } = props;
    const react = await reactDrawer(side, props);
    const dom = domDrawer({ id: 'd', side, ...(rest as Omit<DrawerHtmlOptions, 'id'>), ...(html.body ? { body: trusted(html.body) } : {}) });
    expect(dom).toEqual(react);
  });

  it('opens and closes with the Dialog functions, focus inside then back', async () => {
    document.body.innerHTML = `<button id="opener">Open</button>${drawerHtml({ id: 'tok', title: 'color.bg.default', body: trusted('<a href="#x">Link</a>') })}`;
    const opener = document.getElementById('opener')!;
    opener.focus();
    openDialog('tok');
    expect(isDialogOpen('tok')).toBe(true);
    const popup = document.querySelector<HTMLElement>('[role="dialog"]')!;
    expect(popup).toHaveAttribute('aria-modal', 'true');
    expect(popup.contains(document.activeElement)).toBe(true);
    await expectNoAxeViolations(document.body);
    closeDialog('tok');
    expect(isDialogOpen('tok')).toBe(false);
    expect(document.activeElement).toBe(opener);
  });
});
