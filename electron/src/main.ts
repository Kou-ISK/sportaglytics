import { app, BrowserWindow, Menu, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'node:fs/promises';
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

  // ファイル保存ダイアログ
  ipcMain.handle(
    'save-file-dialog',
    async (
      _event,
      defaultPath: string,
      filters: { name: string; extensions: string[] }[],
    ) => {
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath,
        filters,
      });
      return result.canceled ? null : result.filePath;
    },
  );

  // ファイル選択ダイアログ
  ipcMain.handle(
    'open-file-dialog',
    async (_event, filters: { name: string; extensions: string[] }[]) => {
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters,
      });
      return result.canceled ? null : result.filePaths[0];
    },
  );

  // テキストファイル書き込み
  ipcMain.handle(
    'write-text-file',
    async (_event, filePath: string, content: string) => {
      try {
        await fs.writeFile(filePath, content, 'utf-8');
        return true;
      } catch (error) {
        console.error('Failed to write file:', error);
        return false;
      }
    },
  );

  // テキストファイル読み込み
  ipcMain.handle('read-text-file', async (_event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.error('Failed to read file:', error);
      return null;
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
