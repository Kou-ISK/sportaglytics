/**
 * 分析ウィンドウ管理モジュール
 */
import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import type { AnalysisWindowSyncPayload } from '../../src/types/ipc/analysisWindow';
import {
  ANALYSIS_WINDOW_CHANNELS,
  isAnalysisAiPlaylistPayload,
  isAnalysisWindowSyncPayload,
  isTimelineData,
} from '../../src/types/ipc/analysisWindow';
import { getValidatedEventSenderWindow, isEventFromWindow } from './ipc/windowSenderGuards';
import { applyWindowSecurity } from './windowSecurity';

let analysisWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;

const ANALYSIS_HASH_URL = `file:${path.join(__dirname, '../../index.html')}#/analysis`;

export const setAnalysisMainWindowRef = (window: BrowserWindow): void => {
  mainWindow = window;
};

const focusOrCreate = (): BrowserWindow => {
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
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  applyWindowSecurity(analysisWindow);

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

export const sendAnalysisSync = (payload: AnalysisWindowSyncPayload): void => {
  if (analysisWindow && !analysisWindow.isDestroyed()) {
    analysisWindow.webContents.send(ANALYSIS_WINDOW_CHANNELS.sync, payload);
  }
};

export const sendAnalysisDashboardFileToWindow = async (
  filePath: string,
): Promise<void> => {
  await openAnalysisWindow();
  if (analysisWindow && !analysisWindow.isDestroyed()) {
    analysisWindow.webContents.send(
      ANALYSIS_WINDOW_CHANNELS.dashboardExternalOpen,
      filePath,
    );
  }
};

export const registerAnalysisWindowHandlers = (): void => {
  ipcMain.handle(ANALYSIS_WINDOW_CHANNELS.openWindow, async (event) => {
    if (!getValidatedEventSenderWindow(event)) {
      throw new Error('Invalid analysis open sender');
    }
    await openAnalysisWindow();
  });

  ipcMain.handle(ANALYSIS_WINDOW_CHANNELS.closeWindow, (event) => {
    const senderWindow = getValidatedEventSenderWindow(event);
    if (!senderWindow) {
      throw new Error('Invalid analysis close sender');
    }

    if (senderWindow && senderWindow === analysisWindow) {
      senderWindow.close();
      analysisWindow = null;
      return;
    }
    closeAnalysisWindow();
  });

  ipcMain.handle(ANALYSIS_WINDOW_CHANNELS.isWindowOpen, (event) => {
    if (!getValidatedEventSenderWindow(event)) {
      throw new Error('Invalid analysis state sender');
    }
    return isAnalysisWindowOpen();
  });

  ipcMain.on(ANALYSIS_WINDOW_CHANNELS.syncToWindow, (event, payload: unknown) => {
    if (!isEventFromWindow(event, mainWindow) || !isAnalysisWindowSyncPayload(payload)) {
      return;
    }
    sendAnalysisSync(payload);
  });

  ipcMain.on(ANALYSIS_WINDOW_CHANNELS.jumpToSegment, (event, segment: unknown) => {
    if (!isEventFromWindow(event, analysisWindow) || !isTimelineData(segment)) {
      return;
    }

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(ANALYSIS_WINDOW_CHANNELS.jumpToSegment, segment);
    }
  });

  ipcMain.on(
    ANALYSIS_WINDOW_CHANNELS.createAiPlaylist,
    (event, payload: unknown) => {
      if (
        !isEventFromWindow(event, analysisWindow) ||
        !isAnalysisAiPlaylistPayload(payload)
      ) {
        return;
      }

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(
          ANALYSIS_WINDOW_CHANNELS.createAiPlaylist,
          payload,
        );
      }
    },
  );
};
