import { app, BrowserWindow, Menu, ipcMain } from 'electron';
import * as path from 'path';
import { Utils, setMainWindow } from './utils';
import { registerShortcuts } from './shortCutKey';
import { menuBar } from './menuBar';
import { registerSettingsHandlers, loadSettings } from './settingsManager';

// ローカル動画の自動再生を許可
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

const mainURL = `file:${__dirname}/../../index.html`;

const createWindow = async () => {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 1000,
    icon: path.join(__dirname, '../../public/icon.icns'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // ローカル file:// リソースを許可（開発用）
      webSecurity: false,
      // セキュリティ: Preloadスクリプトからのみブリッジする
      contextIsolation: true,
      // Electron 31対応: sandboxは無効化（レガシー動作を維持）
      sandbox: false,
    },
  });
  setMainWindow(mainWindow);
  mainWindow.loadURL(mainURL);

  // 設定を読み込んでホットキーを登録
  const settings = await loadSettings();
  registerShortcuts(mainWindow, settings.hotkeys);

  Menu.setApplicationMenu(menuBar);

  // ホットキー設定が更新されたら再登録
  ipcMain.on('hotkeys-updated', () => {
    loadSettings().then((updatedSettings) => {
      registerShortcuts(mainWindow, updatedSettings.hotkeys);
    });
  });

  // ウィンドウタイトル更新用のIPCハンドラ
  ipcMain.on('set-window-title', (_event, title: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setTitle(title);
    }
  });
};
Utils();
registerSettingsHandlers();

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
