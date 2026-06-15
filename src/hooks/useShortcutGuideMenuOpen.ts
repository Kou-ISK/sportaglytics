import { useEffect } from 'react';
import { subscribeShortcutGuideMenuOpen } from '../shared/menu/shortcutMenuGateway';

export const useShortcutGuideMenuOpen = (onOpen: () => void): void => {
  useEffect(() => {
    const unsubscribe = subscribeShortcutGuideMenuOpen(onOpen);

    return () => {
      try {
        unsubscribe();
      } catch (error) {
        console.debug('shortcut menu cleanup error', error);
      }
    };
  }, [onOpen]);
};
