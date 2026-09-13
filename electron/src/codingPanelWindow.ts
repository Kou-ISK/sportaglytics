import { getRendererUrl } from './rendererUrl';
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
import {
  createPackageSession,
  getPackageSessionForSender,
  getPackageSessionForWindow,
  registerAuxiliaryWindow,
  unregisterAuxiliaryWindow,
  type PackageSession,
} from './packageSessionRegistry';

interface CodingSessionState { codingPanelWindow: BrowserWindow | null }
const states = new Map<string, CodingSessionState>();
let defaultMainWindow: BrowserWindow | null = null;

const CODING_PANEL_HASH_URL = getRendererUrl('/coding-panel');

export const setCodingPanelMainWindowRef = (window: BrowserWindow): void => {
  defaultMainWindow = window;
  createPackageSession(window);
};

const resolveSession = (window?: BrowserWindow | null): PackageSession | null => {
  const target = window ?? defaultMainWindow;
  return target
    ? getPackageSessionForWindow(target) ?? createPackageSession(target)
    : null;
};
const resolveSenderSession = (sender: Electron.WebContents): PackageSession | null =>
  getPackageSessionForSender(sender) ?? resolveSession(BrowserWindow.fromWebContents(sender));
const getState = (session: PackageSession): CodingSessionState => {
  const current = states.get(session.id);
  if (current) return current;
  const next = { codingPanelWindow: null };
  states.set(session.id, next);
  return next;
};

const focusOrCreate = (mainWindow?: BrowserWindow | null): BrowserWindow | null => {
  const session = resolveSession(mainWindow);
  if (!session) return null;
  const state = getState(session);
  if (state.codingPanelWindow && !state.codingPanelWindow.isDestroyed()) {
    state.codingPanelWindow.focus();
    return state.codingPanelWindow;
  }

  const codingPanelWindow = new BrowserWindow({
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
  state.codingPanelWindow = codingPanelWindow;
  registerAuxiliaryWindow(session, codingPanelWindow);
  applyWindowSecurity(codingPanelWindow);

  codingPanelWindow.loadURL(CODING_PANEL_HASH_URL);

  codingPanelWindow.on('closed', () => {
    state.codingPanelWindow = null;
    unregisterAuxiliaryWindow(session, codingPanelWindow);
  });

  return codingPanelWindow;
};

export const openCodingPanelWindow = async (
  mainWindow?: BrowserWindow | null,
): Promise<void> => {
  const window = focusOrCreate(mainWindow);
  if (!window) return;
  if (window.webContents.isLoading()) {
    await new Promise<void>((resolve) => {
      window.webContents.once('did-finish-load', () => resolve());
    });
  }
};

export const closeCodingPanelWindow = (mainWindow?: BrowserWindow | null): void => {
  if (mainWindow) {
    const session = resolveSession(mainWindow);
    if (session) getState(session).codingPanelWindow?.close();
    return;
  }
  for (const state of states.values()) {
    if (state.codingPanelWindow && !state.codingPanelWindow.isDestroyed()) state.codingPanelWindow.close();
  }
};

export const isCodingPanelWindowOpen = (mainWindow?: BrowserWindow | null): boolean => {
  if (mainWindow) {
    const session = resolveSession(mainWindow);
    const window = session ? getState(session).codingPanelWindow : null;
    return Boolean(window && !window.isDestroyed());
  }
  return [...states.values()].some(({ codingPanelWindow }) => codingPanelWindow && !codingPanelWindow.isDestroyed());
};

export const sendCodingPanelSync = (
  payload: CodingPanelWindowSyncPayload,
  mainWindow?: BrowserWindow | null,
): void => {
  const session = resolveSession(mainWindow);
  const codingPanelWindow = session ? getState(session).codingPanelWindow : null;
  if (codingPanelWindow && !codingPanelWindow.isDestroyed()) {
    codingPanelWindow.webContents.send(
      CODING_PANEL_WINDOW_CHANNELS.sync,
      payload,
    );
  }
};

const sendCodingPanelCommand = (
  session: PackageSession,
  command: CodingPanelWindowCommand,
): void => {
  if (!session.mainWindow.isDestroyed()) {
    session.mainWindow.webContents.send(CODING_PANEL_WINDOW_CHANNELS.command, command);
  }
};

export const registerCodingPanelWindowHandlers = (): void => {
  ipcMain.handle(CODING_PANEL_WINDOW_CHANNELS.openWindow, async (event) => {
    const senderWindow = getValidatedEventSenderWindow(event);
    const session = senderWindow ? resolveSession(senderWindow) : null;
    if (!senderWindow || !session) {
      throw new Error('Invalid coding panel open sender');
    }
    await openCodingPanelWindow(session.mainWindow);
  });

  ipcMain.handle(CODING_PANEL_WINDOW_CHANNELS.closeWindow, (event) => {
    const senderWindow = getValidatedEventSenderWindow(event);
    if (!senderWindow) {
      throw new Error('Invalid coding panel close sender');
    }

    const session = resolveSession(senderWindow);
    const state = session ? getState(session) : null;
    if (!session || !state) throw new Error('Invalid coding panel close sender');
    if (senderWindow === state.codingPanelWindow) {
      senderWindow.close();
      return;
    }
    if (senderWindow !== session.mainWindow) throw new Error('Invalid coding panel close sender');
    state.codingPanelWindow?.close();
  });

  ipcMain.handle(CODING_PANEL_WINDOW_CHANNELS.isWindowOpen, (event) => {
    const senderWindow = getValidatedEventSenderWindow(event);
    const session = senderWindow ? resolveSession(senderWindow) : null;
    if (!senderWindow || !session) {
      throw new Error('Invalid coding panel state sender');
    }
    const state = getState(session);
    if (senderWindow !== session.mainWindow && senderWindow !== state.codingPanelWindow) {
      throw new Error('Invalid coding panel state sender');
    }
    return Boolean(state.codingPanelWindow && !state.codingPanelWindow.isDestroyed());
  });

  ipcMain.on(
    CODING_PANEL_WINDOW_CHANNELS.syncToWindow,
    (event, payload: unknown) => {
      const session = resolveSenderSession(event.sender);
      if (!session || !isEventFromWindow(event, session.mainWindow) ||
          !isCodingPanelWindowSyncPayload(payload)) {
        return;
      }
      sendCodingPanelSync(payload, session.mainWindow);
    },
  );

  ipcMain.on(
    CODING_PANEL_WINDOW_CHANNELS.command,
    (event, command: unknown) => {
      const session = resolveSenderSession(event.sender);
      const codingPanelWindow = session ? getState(session).codingPanelWindow : null;
      if (!session || !isEventFromWindow(event, codingPanelWindow) ||
          !isCodingPanelWindowCommand(command)) {
        return;
      }
      sendCodingPanelCommand(session, command);
    },
  );
};
