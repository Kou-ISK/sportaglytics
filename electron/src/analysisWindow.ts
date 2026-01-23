/**
 * 分析ウィンドウ管理モジュール
 */
import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';

let analysisWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;

const ANALYSIS_HASH_URL = `file:${path.join(__dirname, '../../index.html')}#/analysis`;

export const setAnalysisMainWindowRef = (window: BrowserWindow): void => {
  mainWindow = window;
};

const focusOrCreate = () => {
  if (analysisWindow && !analysisWindow.isDestroyed()) {
    analysisWindow.focus();
    return analysisWindow;
  }

  analysisWindow = new BrowserWindow({
    width: 1200,
    height: 900,
    minWidth: 900,
    minHeight: 700,
    title: '分析',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  });

  analysisWindow.loadURL(ANALYSIS_HASH_URL);

  analysisWindow.on('closed', () => {
    analysisWindow = null;
  });

  return analysisWindow;
};

export const openAnalysisWindow = async (): Promise<void> => {
  const window = focusOrCreate();
  if (window.webContents.isLoading()) {
    await new Promise<void>((resolve) => {
      window.webContents.once('did-finish-load', () => resolve());
    });
  }
};

export const closeAnalysisWindow = (): void => {
  if (analysisWindow && !analysisWindow.isDestroyed()) {
    analysisWindow.close();
    analysisWindow = null;
  }
};

export const isAnalysisWindowOpen = (): boolean =>
  Boolean(analysisWindow && !analysisWindow.isDestroyed());

export const sendAnalysisSync = (payload: unknown): void => {
  if (analysisWindow && !analysisWindow.isDestroyed()) {
    analysisWindow.webContents.send('analysis:sync', payload);
  }
};

export const registerAnalysisWindowHandlers = (): void => {
  ipcMain.handle('analysis:open-window', async () => {
    await openAnalysisWindow();
  });

  ipcMain.handle('analysis:close-window', (event) => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    if (senderWindow && senderWindow === analysisWindow) {
      senderWindow.close();
      analysisWindow = null;
      return;
    }
    closeAnalysisWindow();
  });

  ipcMain.handle('analysis:is-window-open', () => {
    return isAnalysisWindowOpen();
  });

  ipcMain.on('analysis:sync-to-window', (_event, payload) => {
    sendAnalysisSync(payload);
  });

  ipcMain.on('analysis:jump-to-segment', (_event, segment) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('analysis:jump-to-segment', segment);
    }
  });
};
