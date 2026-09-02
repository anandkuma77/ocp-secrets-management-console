import * as React from 'react';

interface ActiveRowMenuContextValue {
  activeMenuId: string | null;
  setActiveMenuId: React.Dispatch<React.SetStateAction<string | null>>;
}

const ActiveRowMenuContext = React.createContext<ActiveRowMenuContextValue | undefined>(undefined);

/**
 * Coordinates row-action (kebab) menus across all resource tables on a page so that
 * opening one menu automatically closes any other menu, even across different tables.
 * Wrap the page/section that renders multiple resource tables with this provider.
 */
export const ActiveRowMenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeMenuId, setActiveMenuId] = React.useState<string | null>(null);
  const value = React.useMemo(() => ({ activeMenuId, setActiveMenuId }), [activeMenuId]);

  return <ActiveRowMenuContext.Provider value={value}>{children}</ActiveRowMenuContext.Provider>;
};

/**
 * Tracks whether the menu identified by `menuId` is the single active row menu.
 * When rendered outside an `ActiveRowMenuProvider` (e.g. in isolated unit tests or
 * standalone usage), falls back to component-local state so each menu still behaves
 * independently rather than throwing.
 */
export function useActiveRowMenu(menuId: string) {
  const context = React.useContext(ActiveRowMenuContext);
  const [localActiveMenuId, setLocalActiveMenuId] = React.useState<string | null>(null);

  const activeMenuId = context ? context.activeMenuId : localActiveMenuId;
  const setActiveMenuId = context ? context.setActiveMenuId : setLocalActiveMenuId;

  const isOpen = activeMenuId === menuId;

  const toggle = React.useCallback(() => {
    setActiveMenuId((prev) => (prev === menuId ? null : menuId));
  }, [menuId, setActiveMenuId]);

  const close = React.useCallback(() => {
    setActiveMenuId((prev) => (prev === menuId ? null : prev));
  }, [menuId, setActiveMenuId]);

  return { isOpen, toggle, close };
}
