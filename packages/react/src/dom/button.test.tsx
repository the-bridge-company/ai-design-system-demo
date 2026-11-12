// Parity: buttonHtml and iconButtonHtml return exactly the markup <Button> and <IconButton> render.
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Pencil, Undo2, X } from 'lucide-react';
import { expectNoAxeViolations } from '../test/axe';
import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';
import { buttonClassName, buttonHtml, iconButtonHtml, trusted } from './index';

describe('buttonHtml', () => {
  it.each([
    ['Save', {}, <Button>Save</Button>],
    ['Undo', { variant: 'secondary' as const, size: 'sm' as const, attributes: { 'data-ed-undo': '2' } }, <Button variant="secondary" size="sm" data-ed-undo="2">Undo</Button>],
    ['Archive "old"', { variant: 'secondary' as const, size: 'lg' as const, className: 'row-action' }, <Button variant="secondary" size="lg" className="row-action">Archive "old"</Button>],
    ['Done', { disabled: true }, <Button disabled>Done</Button>],
    ['Show diff', { variant: 'secondary' as const, pressed: false }, <Button variant="secondary" pressed={false}>Show diff</Button>],
    ['Edit', { iconStart: 'pencil' as const, fullWidth: true }, <Button iconStart={Pencil} fullWidth>Edit</Button>],
    ['Close', { variant: 'ghost' as const, iconEnd: 'x' as const }, <Button variant="ghost" iconEnd={X}>Close</Button>],
    [
      'Open the change',
      { href: '?pr=4&x=1', iconStart: 'pencil' as const, attributes: { 'data-open-pr': '4', target: '_blank', rel: 'noopener' } },
      <Button iconStart={Pencil} render={<a href="?pr=4&x=1" />} data-open-pr="4" {...({ target: '_blank', rel: 'noopener' } as object)}>
        Open the change
      </Button>,
    ],
  ])('matches <Button> for %j %j', (label, opts, el) => {
    expect(buttonHtml(label, opts)).toBe(renderToStaticMarkup(el));
  });

  it('gives the same class list as <Button>', () => {
    expect(buttonClassName({ variant: 'secondary', size: 'lg' })).toBe('button secondary lg');
  });

  it('passes trusted markup through and stays accessible', async () => {
    document.body.innerHTML = `<p>${buttonHtml(trusted('Open <b>Button</b>'), { variant: 'secondary' })}</p>`;
    expect(document.querySelector('button')).toHaveAccessibleName('Open Button');
    await expectNoAxeViolations();
  });
});

describe('iconButtonHtml', () => {
  it.each([
    ['x' as const, 'Close token details', {}, <IconButton icon={X} label="Close token details" />],
    ['undo-2' as const, 'Undo', { size: 'sm' as const, attributes: { 'data-xe-undo': '0', title: 'Undo' } }, <IconButton icon={Undo2} label="Undo" size="sm" data-xe-undo="0" title="Undo" />],
  ])('matches <IconButton icon=%s>', (icon, label, opts, el) => {
    expect(iconButtonHtml(icon, label, opts)).toBe(renderToStaticMarkup(el));
  });
});
