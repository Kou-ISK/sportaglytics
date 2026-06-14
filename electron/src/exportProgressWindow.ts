import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import {
  EXPORT_PROGRESS_WINDOW_CHANNELS,
  type ExportProgressWindowState,
} from '../../src/types/ipc/exportProgressWindow';
import { getValidatedEventSenderWindow } from './ipc/windowSenderGuards';
import { applyWindowSecurity } from './windowSecurity';

let progressWindow: BrowserWindow | null = null;
const progressStates = new Map<string, ExportProgressWindowState>();

const EXPORT_PROGRESS_HASH_URL = `file:${path.join(
  __dirname,
  '../../index.html',
)}#/export-progress`;

const focusOrCreate = (): BrowserWindow => {
  if (progressWindow && !progressWindow.isDestroyed()) {
    progressWindow.focus();
    return progressWindow;
  }

  progressWindow = new BrowserWindow({
    width: 420,
    height: 260,
    minWidth: 360,
    minHeight: 220,
    title: '映像書き出し',
    resizable: true,
    minimizable: true,
    maximizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  applyWindowSecurity(progressWindow);
  progressWindow.setMenuBarVisibility(false);
  progressWindow.loadURL(EXPORT_PROGRESS_HASH_URL);
  progressWindow.on('closed', () => {
    progressWindow = null;
  });

  return progressWindow;
};

const sendState = (state: ExportProgressWindowState): void => {
  if (!progressWindow || progressWindow.isDestroyed()) {
    return;
  }

  progressWindow.webContents.send(EXPORT_PROGRESS_WINDOW_CHANNELS.sync, state);
};

export const openExportProgressWindow = async (): Promise<void> => {
  const window = focusOrCreate();
  if (window.webContents.isLoading()) {
    await new Promise<void>((resolve) => {
      window.webContents.once('did-finish-load', () => resolve());
    });
  }
};

export const updateExportProgressWindow = (
  state: ExportProgressWindowState,
): void => {
  progressStates.set(state.id, state);
  void openExportProgressWindow().then(() => sendState(state));
};

export const registerExportProgressWindowHandlers = (): void => {
  ipcMain.handle(EXPORT_PROGRESS_WINDOW_CHANNELS.requestState, (event) => {
    if (!getValidatedEventSenderWindow(event)) {
      throw new Error('Invalid export progress state sender');
    }
    const states = Array.from(progressStates.values());
    const latest = states.length > 0 ? states[states.length - 1] : null;
    if (latest) {
      sendState(latest);
    }
    return latest;
  });
};
