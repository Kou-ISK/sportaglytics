import { useCallback, useEffect, useState } from 'react';

export type AppView =
  | 'main'
  | 'settings'
  | 'playlist'
  | 'analysis'
  | 'analysis-report';

const getViewFromHash = (): AppView => {
  const hash = globalThis.window.location.hash;
  if (hash === '#/playlist') return 'playlist';
  if (hash === '#/settings') return 'settings';
  if (hash === '#/analysis') return 'analysis';
  if (hash.startsWith('#/analysis-report')) return 'analysis-report';
  return 'main';
};

export const useAppShellController = (): AppView => {
  const [currentView, setCurrentView] = useState<AppView>(getViewFromHash);

  const openSettingsView = useCallback(() => {
    const api = globalThis.window.electronAPI;
    if (api?.openSettingsWindow) {
      void api.openSettingsWindow();
      return;
    }

    setCurrentView('settings');
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentView(getViewFromHash());
    };

    globalThis.window.addEventListener('hashchange', handleHashChange);
    return () =>
      globalThis.window.removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    const api = globalThis.window.electronAPI;
    if (!api) {
      return;
    }

    api.onOpenSettings(openSettingsView);

    return () => {
      api.offOpenSettings(openSettingsView);
    };
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
    const api = globalThis.window.electronAPI;
    if (!api?.codeWindow?.onExternalOpen) {
      return;
    }

    return api.codeWindow.onExternalOpen(() => {
      openSettingsView();
    });
  }, [openSettingsView]);

  return currentView;
};
