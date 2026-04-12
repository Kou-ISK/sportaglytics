const noop = (): void => undefined;

const getElectronApi = (): Window['electronAPI'] => {
  return globalThis.window.electronAPI;
};

export const getCurrentLocationHash = (): string => {
  return globalThis.window.location.hash;
};

export const subscribeLocationHashChange = (
  callback: () => void,
): (() => void) => {
  globalThis.window.addEventListener('hashchange', callback);
  return () => {
    globalThis.window.removeEventListener('hashchange', callback);
  };
};

export const openDetachedSettingsWindow = async (): Promise<boolean> => {
  const api = getElectronApi();
  if (!api?.openSettingsWindow) {
    return false;
  }

  try {
    await api.openSettingsWindow();
    return true;
  } catch (error: unknown) {
    console.debug('[appShellGateway] open settings window failed', error);
    return false;
  }
};

export const subscribeOpenSettingsRequest = (
  callback: () => void,
): (() => void) => {
  const api = getElectronApi();
  if (!api?.onOpenSettings || !api.offOpenSettings) {
    return noop;
  }

  try {
    api.onOpenSettings(callback);
    return () => {
      api.offOpenSettings(callback);
    };
  } catch (error: unknown) {
    console.debug('[appShellGateway] open settings subscribe failed', error);
    return noop;
  }
};

export const subscribeCodeWindowExternalOpenForShell = (
  callback: () => void,
): (() => void) => {
  const api = getElectronApi();
  if (!api?.codeWindow?.onExternalOpen) {
    return noop;
  }

  try {
    return api.codeWindow.onExternalOpen(callback);
  } catch (error: unknown) {
    console.debug('[appShellGateway] code window external open failed', error);
    return noop;
  }
};
