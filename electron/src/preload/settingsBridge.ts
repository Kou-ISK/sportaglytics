import type { IpcRenderer, IpcRendererEvent } from 'electron';
import type { IElectronAPI } from '../../../src/renderer';
import type { AppSettings } from '../../../src/types/Settings';

type SettingsBridgeKeys =
  | 'loadSettings'
  | 'saveSettings'
  | 'resetSettings'
  | 'onSettingsUpdated'
  | 'onOpenSettings'
  | 'offOpenSettings'
  | 'openSettingsWindow'
  | 'closeSettingsWindow'
  | 'isSettingsWindowOpen';

export const createSettingsBridge = (
  ipcRenderer: IpcRenderer,
): Pick<IElectronAPI, SettingsBridgeKeys> => {
  const settingsBridge = {
    loadSettings: async () => {
      try {
        return await ipcRenderer.invoke('settings:load');
      } catch (error) {
        console.error('Error loading settings:', error);
        throw error;
      }
    },
    saveSettings: async (settings: unknown) => {
      try {
        return await ipcRenderer.invoke('settings:save', settings);
      } catch (error) {
        console.error('Error saving settings:', error);
        return false;
      }
    },
    resetSettings: async () => {
      try {
        return await ipcRenderer.invoke('settings:reset');
      } catch (error) {
        console.error('Error resetting settings:', error);
        throw error;
      }
    },
    onSettingsUpdated: (
      callback: (settings: AppSettings) => void,
    ): (() => void) | void => {
      const wrapped = (_event: IpcRendererEvent, payload: AppSettings) =>
        callback(payload);
      ipcRenderer.on('settings:updated', wrapped);
      return () => ipcRenderer.removeListener('settings:updated', wrapped);
    },
    onOpenSettings: (callback: () => void) => {
      try {
        ipcRenderer.removeAllListeners('menu-open-settings');
      } catch (error) {
        console.warn('Failed to remove listeners:', error);
      }
      ipcRenderer.on(
        'menu-open-settings',
        callback as unknown as (event: IpcRendererEvent) => void,
      );
    },
    offOpenSettings: (callback: () => void) => {
      try {
        ipcRenderer.removeListener(
          'menu-open-settings',
          callback as unknown as (event: IpcRendererEvent) => void,
        );
      } catch {
        // noop
      }
    },
    openSettingsWindow: async () => {
      try {
        await ipcRenderer.invoke('settings:open-window');
      } catch (error) {
        console.error('Error opening settings window:', error);
      }
    },
    closeSettingsWindow: async () => {
      try {
        await ipcRenderer.invoke('settings:close-window');
      } catch (error) {
        console.error('Error closing settings window:', error);
      }
    },
    isSettingsWindowOpen: async () => {
      try {
        return await ipcRenderer.invoke('settings:is-window-open');
      } catch (error) {
        console.error('Error checking settings window state:', error);
        return false;
      }
    },
  } satisfies Pick<IElectronAPI, SettingsBridgeKeys>;

  return settingsBridge;
};
