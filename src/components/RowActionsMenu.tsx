import * as React from 'react';
import {
  Dropdown,
  DropdownItem,
  DropdownList,
  MenuToggle,
  MenuToggleElement,
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import { useActiveRowMenu } from './ActiveRowMenuProvider';

export interface RowAction {
  key: string;
  label: string;
  onClick: () => void;
}

interface RowActionsMenuProps {
  /** Unique id for this row's menu, used to coordinate single-active-menu behavior. */
  menuId: string;
  actions: RowAction[];
  'data-test'?: string;
}

/**
 * Kebab (three-dot) row actions menu shared by all resource tables.
 *
 * - Positions the menu so it stays within the viewport (flips/shifts to avoid
 *   clipping by scrollable table containers) by rendering into `document.body`.
 * - Closes on outside click / Escape via `onOpenChange`.
 * - Coordinates with other row menus (same table or other tables) so only one
 *   menu is open at a time, via `useActiveRowMenu`.
 */
export const RowActionsMenu: React.FC<RowActionsMenuProps> = ({
  menuId,
  actions,
  'data-test': dataTest,
}) => {
  const { isOpen, toggle, close } = useActiveRowMenu(menuId);

  return (
    <Dropdown
      isOpen={isOpen}
      onSelect={close}
      onOpenChange={(nextOpen: boolean) => {
        if (!nextOpen) close();
      }}
      popperProps={{
        position: 'right',
        enableFlip: true,
        preventOverflow: true,
        appendTo: () => document.body,
      }}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          aria-label="kebab dropdown toggle"
          variant="plain"
          onClick={toggle}
          isExpanded={isOpen}
          icon={<EllipsisVIcon />}
        />
      )}
      shouldFocusToggleOnSelect
      data-test={dataTest}
    >
      <DropdownList>
        {actions.map((action) => (
          <DropdownItem key={action.key} onClick={action.onClick}>
            {action.label}
          </DropdownItem>
        ))}
      </DropdownList>
    </Dropdown>
  );
};
