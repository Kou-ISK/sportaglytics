import { app, ipcMain, BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { DEFAULT_SETTINGS } from '../../src/types/settings/defaults';
import { normalizeAppSettings } from '../../src/types/settings/normalizers';
import type { AppSettings } from '../../src/types/settings/coreTypes';

type UnknownRecord = Record<string, unknown>;

const isPlainObject = (value: unknown): value is UnknownRecord => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const isErrnoException = (value: unknown): value is NodeJS.ErrnoException => {
  return isPlainObject(value) && typeof value.code === 'string';
};

/**
 * 設定ファイルのパスを取得
 */
const getSettingsPath = (): string => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'settings.json');
};

const getValidatedSenderWindow = (
  event: IpcMainInvokeEvent,
): BrowserWindow | null => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (!senderWindow || senderWindow.isDestroyed()) {
    return null;
  }
  return senderWindow;
};

const broadcastSettingsUpdated = (settings: AppSettings): void => {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send('settings:updated', settings);
    }
  });
};

/**
 * 設定を読み込む
 */
export const loadSettings = async (): Promise<AppSettings> => {
  const settingsPath = getSettingsPath();
  try {
    const data = await fs.readFile(settingsPath, 'utf-8');
    return normalizeAppSettings(JSON.parse(data) as unknown);
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') {
      console.info(
        'Settings file not found (first launch), creating with defaults',
      );
      void saveSettings(normalizeAppSettings(DEFAULT_SETTINGS)).catch(
        (saveError) => {
          console.error('Failed to save default settings:', saveError);
        },
      );
    } else {
      console.warn('Settings file invalid, using defaults:', error);
    }
    return normalizeAppSettings(DEFAULT_SETTINGS);
  }
};

/**
 * 設定を保存する
 */
export const saveSettings = async (settings: AppSettings): Promise<boolean> => {
  const settingsPath = getSettingsPath();
  const normalizedSettings = normalizeAppSettings(settings);
  try {
    const dir = path.dirname(settingsPath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      settingsPath,
      JSON.stringify(normalizedSettings, null, 2),
      'utf-8',
    );
    return true;
  } catch (error) {
    console.error('Failed to save settings:', error);
    return false;
  }
};

/**
 * IPCハンドラを登録
 */
export const registerSettingsHandlers = (): void => {
  ipcMain.handle('settings:load', async (event) => {
    if (!getValidatedSenderWindow(event)) {
      throw new Error('Invalid settings load sender');
    }

    return await loadSettings();
  });

  ipcMain.handle('settings:save', async (event, settings: unknown) => {
    if (!getValidatedSenderWindow(event) || !isPlainObject(settings)) {
      return false;
    }

    const normalizedSettings = normalizeAppSettings(settings);
    const ok = await saveSettings(normalizedSettings);
    if (ok) {
      broadcastSettingsUpdated(normalizedSettings);
    }
    return ok;
  });

  ipcMain.handle('settings:reset', async (event) => {
    if (!getValidatedSenderWindow(event)) {
      throw new Error('Invalid settings reset sender');
    }

    const defaultSettings = normalizeAppSettings(DEFAULT_SETTINGS);
    const ok = await saveSettings(defaultSettings);
    if (ok) {
      broadcastSettingsUpdated(defaultSettings);
    }
    return defaultSettings;
  });
};
