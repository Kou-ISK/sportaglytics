/**
 * 設定ウィンドウ管理モジュール
 */
import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

let settingsWindow: BrowserWindow | null = null;

const SETTINGS_HASH_URL = `file:${path.join(__dirname, '../../index.html')}#/settings`;

const focusOrCreate = () => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return settingsWindow;
  }

  settingsWindow = new BrowserWindow({
    width: 1100,
    height: 800,
    minWidth: 900,
    minHeight: 700,
    title: '設定',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  });

  settingsWindow.loadURL(SETTINGS_HASH_URL);
  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });

  return settingsWindow;
};

export const openSettingsWindow = (): void => {
  focusOrCreate();
};

export const closeSettingsWindow = (): void => {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
    settingsWindow = null;
  }
};

export const isSettingsWindowOpen = (): boolean =>
  Boolean(settingsWindow && !settingsWindow.isDestroyed());

export const registerSettingsWindowHandlers = (): void => {
  ipcMain.handle('settings:open-window', () => {
    openSettingsWindow();
  });

  ipcMain.handle('settings:close-window', (event) => {
    // 呼び出し元のウィンドウを優先して閉じる（設定ウィンドウ内のボタン対応）
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (senderWindow && senderWindow === settingsWindow) {
      senderWindow.close();
      settingsWindow = null;
      return;
    }
    closeSettingsWindow();
  });

  ipcMain.handle('settings:is-window-open', () => {
    return isSettingsWindowOpen();
  });
};
