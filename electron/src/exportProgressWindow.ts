import { getRendererUrl } from './rendererUrl';
import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import {
  EXPORT_PROGRESS_WINDOW_CHANNELS,
  type ExportProgressWindowState,
  type CancelExportResult,
} from '../../src/types/ipc/exportProgressWindow';
import {
  getValidatedEventSenderWindow,
  isEventFromWindow,
} from './ipc/windowSenderGuards';
import { applyWindowSecurity } from './windowSecurity';

let progressWindow: BrowserWindow | null = null;
const progressStates = new Map<string, ExportProgressWindowState>();
let cancelExport: ((id: string) => CancelExportResult) | undefined;
export const setExportCancelHandler = (
  handler: (id: string) => CancelExportResult,
): void => {
  cancelExport = handler;
};

const EXPORT_PROGRESS_HASH_URL = getRendererUrl('/export-progress');

const getOrCreate = (): BrowserWindow => {
  if (progressWindow && !progressWindow.isDestroyed()) {
    return progressWindow;
  }

  progressWindow = new BrowserWindow({
    width: 420,
    height: 260,
    useContentSize: true,
    minWidth: 360,
    minHeight: 220,
    title: '映像書き出し',
    resizable: true,
    minimizable: true,
    maximizable: false,
    show: false,
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

export const openExportProgressWindow = async (
  activate = true,
  reveal = false,
): Promise<void> => {
  const window = getOrCreate();
  if (window.webContents.isLoading()) {
    await new Promise<void>((resolve) => {
      window.webContents.once('did-finish-load', () => resolve());
    });
  }
  if (window.isDestroyed()) return;
  if (!window.isVisible()) {
    window.showInactive();
  }
  if (activate) {
    window.focus();
  } else if (reveal && !window.isDestroyed()) {
    if (window.isMinimized()) window.restore();
    window.moveTop();
  }
};

export const updateExportProgressWindow = (
  state: ExportProgressWindowState,
): void => {
  progressStates.delete(state.id);
  progressStates.set(state.id, state);
  void openExportProgressWindow(false).then(() => sendState(state));
};

export const registerExportProgressWindowHandlers = (): void => {
  ipcMain.handle(
    EXPORT_PROGRESS_WINDOW_CHANNELS.cancel,
    (event, id: unknown) => {
      if (!isEventFromWindow(event, progressWindow))
        throw new Error('Invalid export cancel sender');
      if (typeof id !== 'string' || id.length === 0 || id.length > 128)
        return 'not-found';
      const states = Array.from(progressStates.values());
      const latest = states[states.length - 1];
      if (!latest || latest.id !== id || latest.status !== 'running')
        return 'not-found';
      const result = cancelExport?.(id) ?? 'not-found';
      if (result === 'accepted')
        updateExportProgressWindow({
          ...latest,
          status: 'cancelling',
          message: '書き出しを中止しています…',
          updatedAt: Date.now(),
        });
      return result;
    },
  );
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
