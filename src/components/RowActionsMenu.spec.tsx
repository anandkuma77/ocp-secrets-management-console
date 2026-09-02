import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RowActionsMenu } from './RowActionsMenu';
import { ActiveRowMenuProvider } from './ActiveRowMenuProvider';

describe('RowActionsMenu', () => {
  it('renders actions and calls onClick, closing the menu on selection', async () => {
    const user = userEvent.setup();
    const onInspect = jest.fn();
    const onDelete = jest.fn();

    render(
      <RowActionsMenu
        menuId="row-1"
        actions={[
          { key: 'inspect', label: 'Inspect Certificate', onClick: onInspect },
          { key: 'delete', label: 'Delete Certificate', onClick: onDelete },
        ]}
      />,
    );

    await user.click(screen.getByRole('button', { name: /kebab dropdown toggle/i }));
    expect(screen.getByRole('menuitem', { name: 'Inspect Certificate' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Delete Certificate' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Delete Certificate' }));

    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onInspect).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.queryByRole('menuitem', { name: 'Delete Certificate' }),
      ).not.toBeInTheDocument();
    });
  });

  it('closes the menu when clicking outside of it', async () => {
    const user = userEvent.setup();

    render(
      <div>
        <RowActionsMenu
          menuId="row-1"
          actions={[{ key: 'inspect', label: 'Inspect Certificate', onClick: jest.fn() }]}
        />
        <div data-test="outside">Outside content</div>
      </div>,
    );

    await user.click(screen.getByRole('button', { name: /kebab dropdown toggle/i }));
    expect(screen.getByRole('menuitem', { name: 'Inspect Certificate' })).toBeInTheDocument();

    await user.click(screen.getByText('Outside content'));

    await waitFor(() => {
      expect(
        screen.queryByRole('menuitem', { name: 'Inspect Certificate' }),
      ).not.toBeInTheDocument();
    });
  });

  it('only allows one menu to be open at a time across rows when using ActiveRowMenuProvider', async () => {
    const user = userEvent.setup();

    render(
      <ActiveRowMenuProvider>
        <RowActionsMenu
          menuId="row-1"
          actions={[{ key: 'inspect', label: 'Inspect Row 1', onClick: jest.fn() }]}
        />
        <RowActionsMenu
          menuId="row-2"
          actions={[{ key: 'inspect', label: 'Inspect Row 2', onClick: jest.fn() }]}
        />
      </ActiveRowMenuProvider>,
    );

    const [toggle1, toggle2] = screen.getAllByRole('button', { name: /kebab dropdown toggle/i });

    await user.click(toggle1);
    expect(screen.getByRole('menuitem', { name: 'Inspect Row 1' })).toBeInTheDocument();

    await user.click(toggle2);
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Inspect Row 1' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('menuitem', { name: 'Inspect Row 2' })).toBeInTheDocument();
  });

  it('closes a menu opened via ActiveRowMenuProvider when clicking outside', async () => {
    const user = userEvent.setup();

    render(
      <ActiveRowMenuProvider>
        <div>
          <RowActionsMenu
            menuId="row-1"
            actions={[{ key: 'inspect', label: 'Inspect Row 1', onClick: jest.fn() }]}
          />
          <div data-test="outside">Outside content</div>
        </div>
      </ActiveRowMenuProvider>,
    );

    await user.click(screen.getByRole('button', { name: /kebab dropdown toggle/i }));
    expect(screen.getByRole('menuitem', { name: 'Inspect Row 1' })).toBeInTheDocument();

    await user.click(screen.getByText('Outside content'));

    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Inspect Row 1' })).not.toBeInTheDocument();
    });
  });

  it.each(['Secret', 'Certificate'])(
    'formats kebab actions as "Inspect %s" / "Delete %s" instead of the old static labels',
    async (kind) => {
      const user = userEvent.setup();

      render(
        <RowActionsMenu
          menuId={`row-${kind}`}
          actions={[
            { key: 'inspect', label: `Inspect ${kind}`, onClick: jest.fn() },
            { key: 'delete', label: `Delete ${kind}`, onClick: jest.fn() },
          ]}
        />,
      );

      await user.click(screen.getByRole('button', { name: /kebab dropdown toggle/i }));

      expect(screen.getByRole('menuitem', { name: `Inspect ${kind}` })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: `Delete ${kind}` })).toBeInTheDocument();

      // Old static labels without the resource kind suffix must no longer be present.
      expect(screen.queryByRole('menuitem', { name: 'Inspect' })).not.toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
    },
  );
});
