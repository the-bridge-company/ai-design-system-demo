// @vitest-environment jsdom
// Settings, Claude: Remove on a connection asks first in an AlertDialog (the Delete pattern, plain: it cannot be
// undone), Cancel keeps it, Remove connection removes it and says so. Axe clean.
import '../../../../../../packages/react/src/test/setup';
import { createElement } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations } from '../../../../../../packages/react/src/test/axe';

vi.mock('../../../scripts/repo-context', () => ({ repoContext: () => ({ owner: 'acme', repo: 'ds', defaultBranch: 'main', hosted: true }) }));
vi.mock('./MeasureSetting', () => ({ default: () => null }));
const removeConnection = vi.fn(async () => {});
const connection = { id: 'c1', client: 'Claude Desktop', by: 'Dana Kim', createdAt: '2026-10-20T00:00:00Z', lastUsedAt: '2026-10-25T00:00:00Z', mine: false };
vi.mock('../../../scripts/connector-api', () => ({
  listConnections: async () => ({ connections: [connection], canManage: true }),
  removeConnection: (...a: unknown[]) => removeConnection(...(a as [])),
}));

const { default: ClaudeConnector } = await import('./ClaudeConnector');

describe('Remove a connection', () => {
  beforeEach(() => removeConnection.mockClear());

  it('asks first, and Cancel keeps the connection', async () => {
    const user = userEvent.setup();
    render(createElement(ClaudeConnector));
    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('alertdialog', { name: "Remove Dana Kim's connection?" });
    expect(dialog).toHaveTextContent('Claude Desktop stops working with Bridge at once. This cannot be undone');
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Cancel' })).toHaveFocus());
    await expectNoAxeViolations(dialog);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(removeConnection).not.toHaveBeenCalled();
    expect(screen.getByText('Dana Kim, Claude Desktop')).toBeInTheDocument();
  });

  it('removes it once confirmed, and says so', async () => {
    const user = userEvent.setup();
    render(createElement(ClaudeConnector));
    await user.click(await screen.findByRole('button', { name: 'Remove' }));
    const dialog = await screen.findByRole('alertdialog');
    await user.click(within(dialog).getByRole('button', { name: 'Remove connection' }));
    await waitFor(() => expect(removeConnection).toHaveBeenCalledWith('acme/ds', 'c1'));
    expect(await screen.findByText(/Removed\. That Claude no longer works with Bridge/)).toBeInTheDocument();
    expect(screen.queryByText('Dana Kim, Claude Desktop')).toBeNull();
  });
});
