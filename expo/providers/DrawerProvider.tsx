import { useState, useCallback, useMemo } from 'react';
import createContextHook from '@nkzw/create-context-hook';

export const [DrawerProvider, useDrawer] = createContextHook(() => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const openDrawer = useCallback(() => setIsOpen(true), []);
  const closeDrawer = useCallback(() => setIsOpen(false), []);
  const toggleDrawer = useCallback(() => setIsOpen((prev) => !prev), []);

  return useMemo(() => ({
    isOpen,
    openDrawer,
    closeDrawer,
    toggleDrawer,
  }), [isOpen, openDrawer, closeDrawer, toggleDrawer]);
});
