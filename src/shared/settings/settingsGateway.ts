import type { AppSettings, ThemeMode } from '../../types/settings/coreTypes';

const getElectronApi = (): Window['electronAPI'] => {
  return globalThis.window.electronAPI;
};

export const loadThemeModeSetting = async (): Promise<ThemeMode | null> => {
  const api = getElectronApi();
  if (!api?.loadSettings) {
    return null;
  }

  try {
    const settings = await api.loadSettings();
    return settings.themeMode;
  } catch (error: unknown) {
    console.debug('[settingsGateway] load theme mode failed', error);
    return null;
  }
};

export const loadAppSettings = async (): Promise<AppSettings> => {
  const api = getElectronApi();
  if (!api?.loadSettings) {
    throw new Error('Electron API is not available');
  }

  return await api.loadSettings();
};

export const saveAppSettings = async (
  settings: AppSettings,
): Promise<boolean> => {
  const api = getElectronApi();
  if (!api?.saveSettings) {
    throw new Error('Electron API is not available');
  }

  return await api.saveSettings(settings);
};

export const resetAppSettings = async (): Promise<AppSettings> => {
  const api = getElectronApi();
  if (!api?.resetSettings) {
    throw new Error('Electron API is not available');
  }

  return await api.resetSettings();
};

export const subscribeAppSettingsUpdated = (
  callback: () => void,
): (() => void) => {
  const api = getElectronApi();
  if (!api?.onSettingsUpdated) {
    return () => undefined;
  }

  const unsubscribe = api.onSettingsUpdated(callback);
  return typeof unsubscribe === 'function' ? unsubscribe : () => undefined;
};
