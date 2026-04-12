const getElectronApi = (): Window['electronAPI'] => {
  return globalThis.window.electronAPI;
};

export const closeDetachedSettingsWindowIfOpen = async (): Promise<boolean> => {
  const api = getElectronApi();
  if (!api?.isSettingsWindowOpen || !api.closeSettingsWindow) {
    return false;
  }

  try {
    const isDetached = await api.isSettingsWindowOpen();
    if (!isDetached) {
      return false;
    }

    await api.closeSettingsWindow();
    return true;
  } catch (error: unknown) {
    console.debug(
      '[settingsWindowGateway] close detached window failed',
      error,
    );
    return false;
  }
};
