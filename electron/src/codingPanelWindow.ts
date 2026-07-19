import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import type {
  CodingPanelWindowCommand,
  CodingPanelWindowSyncPayload,
} from '../../src/types/ipc/codingPanelWindow';
import {
  CODING_PANEL_WINDOW_CHANNELS,
  isCodingPanelWindowCommand,
  isCodingPanelWindowSyncPayload,
} from '../../src/types/ipc/codingPanelWindow';
import {
  getValidatedEventSenderWindow,
  isEventFromWindow,
} from './ipc/windowSenderGuards';
import { applyWindowSecurity } from './windowSecurity';

let codingPanelWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;

const CODING_PANEL_HASH_URL = `file:${path.join(
  __dirname,
  '../../index.html',
)}#/coding-panel`;

export const setCodingPanelMainWindowRef = (window: BrowserWindow): void => {
  mainWindow = window;
};

const focusOrCreate = (): BrowserWindow => {
  if (codingPanelWindow && !codingPanelWindow.isDestroyed()) {
    codingPanelWindow.focus();
    return codingPanelWindow;
  }

  codingPanelWindow = new BrowserWindow({
    width: 520,
    height: 760,
    minWidth: 360,
    minHeight: 420,
    title: 'コードパネル',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  applyWindowSecurity(codingPanelWindow);

  codingPanelWindow.loadURL(CODING_PANEL_HASH_URL);

  codingPanelWindow.on('closed', () => {
    codingPanelWindow = null;
  });

  return codingPanelWindow;
};

export const openCodingPanelWindow = async (): Promise<void> => {
  const window = focusOrCreate();
  if (window.webContents.isLoading()) {
    await new Promise<void>((resolve) => {
      window.webContents.once('did-finish-load', () => resolve());
    });
  }
};

export const closeCodingPanelWindow = (): void => {
  if (codingPanelWindow && !codingPanelWindow.isDestroyed()) {
    codingPanelWindow.close();
    codingPanelWindow = null;
  }
};

export const isCodingPanelWindowOpen = (): boolean =>
  Boolean(codingPanelWindow && !codingPanelWindow.isDestroyed());

export const sendCodingPanelSync = (
  payload: CodingPanelWindowSyncPayload,
): void => {
  if (codingPanelWindow && !codingPanelWindow.isDestroyed()) {
    codingPanelWindow.webContents.send(
      CODING_PANEL_WINDOW_CHANNELS.sync,
      payload,
    );
  }
};

const sendCodingPanelCommand = (command: CodingPanelWindowCommand): void => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(CODING_PANEL_WINDOW_CHANNELS.command, command);
  }
};

export const registerCodingPanelWindowHandlers = (): void => {
  ipcMain.handle(CODING_PANEL_WINDOW_CHANNELS.openWindow, async (event) => {
    if (!getValidatedEventSenderWindow(event)) {
      throw new Error('Invalid coding panel open sender');
    }
    await openCodingPanelWindow();
  });

  ipcMain.handle(CODING_PANEL_WINDOW_CHANNELS.closeWindow, (event) => {
    const senderWindow = getValidatedEventSenderWindow(event);
    if (!senderWindow) {
      throw new Error('Invalid coding panel close sender');
    }

    if (senderWindow === codingPanelWindow) {
      senderWindow.close();
      codingPanelWindow = null;
      return;
    }
    closeCodingPanelWindow();
  });

  ipcMain.handle(CODING_PANEL_WINDOW_CHANNELS.isWindowOpen, (event) => {
    if (!getValidatedEventSenderWindow(event)) {
      throw new Error('Invalid coding panel state sender');
    }
    return isCodingPanelWindowOpen();
  });

  ipcMain.on(
    CODING_PANEL_WINDOW_CHANNELS.syncToWindow,
    (event, payload: unknown) => {
      if (
        !isEventFromWindow(event, mainWindow) ||
        !isCodingPanelWindowSyncPayload(payload)
      ) {
        return;
      }
      sendCodingPanelSync(payload);
    },
  );

  ipcMain.on(
    CODING_PANEL_WINDOW_CHANNELS.command,
    (event, command: unknown) => {
      if (
        !isEventFromWindow(event, codingPanelWindow) ||
        !isCodingPanelWindowCommand(command)
      ) {
        return;
      }
      sendCodingPanelCommand(command);
    },
  );
};
