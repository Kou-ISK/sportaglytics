import { useCallback, useEffect, useState } from 'react';
import {
  getCurrentLocationHash,
  openDetachedSettingsWindow,
  subscribeCodeWindowExternalOpenForShell,
  subscribeLocationHashChange,
  subscribeOpenSettingsRequest,
} from '../shared/appShell/appShellGateway';

export type AppView =
  | 'main'
  | 'settings'
  | 'playlist'
  | 'analysis'
  | 'analysis-report';

const getViewFromHash = (): AppView => {
  const hash = getCurrentLocationHash();
  if (hash === '#/playlist') return 'playlist';
  if (hash === '#/settings') return 'settings';
  if (hash === '#/analysis') return 'analysis';
  if (hash.startsWith('#/analysis-report')) return 'analysis-report';
  return 'main';
};

export const useAppShellController = (): AppView => {
  const [currentView, setCurrentView] = useState<AppView>(getViewFromHash);

  const openSettingsView = useCallback(() => {
    void openDetachedSettingsWindow().then((opened) => {
      if (!opened) {
        setCurrentView('settings');
      }
    });
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentView(getViewFromHash());
    };

    return subscribeLocationHashChange(handleHashChange);
  }, []);

  useEffect(() => {
    return subscribeOpenSettingsRequest(openSettingsView);
  }, [openSettingsView]);

  useEffect(() => {
    const handleBackToMain = () => {
      setCurrentView('main');
    };

    globalThis.addEventListener('back-to-main', handleBackToMain);

    return () => {
      globalThis.removeEventListener('back-to-main', handleBackToMain);
    };
  }, []);

  useEffect(() => {
    return subscribeCodeWindowExternalOpenForShell(() => {
      openSettingsView();
    });
  }, [openSettingsView]);

  return currentView;
};
