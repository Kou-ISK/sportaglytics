const noop = (): void => undefined;

const getElectronApi = (): Window['electronAPI'] => {
  return globalThis.window.electronAPI;
};

export const subscribeShortcutGuideMenuOpen = (
  callback: () => void,
): (() => void) => {
  const api = getElectronApi();
  if (!api?.onMenuShowShortcuts) {
    return noop;
  }

  try {
    return api.onMenuShowShortcuts(callback);
  } catch (error: unknown) {
    console.debug('[shortcutMenuGateway] subscribe failed', error);
    return noop;
  }
};
