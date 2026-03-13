import { useEffect } from 'react';

export const useShortcutGuideMenuOpen = (onOpen: () => void): void => {
  useEffect(() => {
    const unsubscribe =
      globalThis.window.electronAPI?.onMenuShowShortcuts?.(onOpen);

    return () => {
      if (!unsubscribe) {
        return;
      }

      try {
        unsubscribe();
      } catch (error) {
        console.debug('shortcut menu cleanup error', error);
      }
    };
  }, [onOpen]);
};
