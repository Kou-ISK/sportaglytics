import { getRendererUrl } from './rendererUrl';
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
import {
  createPackageSession,
  getPackageSessionForSender,
  getPackageSessionForWindow,
  registerAuxiliaryWindow,
  unregisterAuxiliaryWindow,
  type PackageSession,
} from './packageSessionRegistry';

interface AnalysisSessionState {
  analysisWindow: BrowserWindow | null;
}

const states = new Map<string, AnalysisSessionState>();
let defaultMainWindow: BrowserWindow | null = null;

const ANALYSIS_HASH_URL = getRendererUrl('/analysis');

export const setAnalysisMainWindowRef = (window: BrowserWindow): void => {
  defaultMainWindow = window;
  createPackageSession(window);
};

const resolveSession = (window?: BrowserWindow | null): PackageSession | null => {
  const owner = window ?? defaultMainWindow;
  return owner
    ? getPackageSessionForWindow(owner) ?? createPackageSession(owner)
    : null;
};

const resolveSenderSession = (sender: Electron.WebContents): PackageSession | null =>
  getPackageSessionForSender(sender) ?? resolveSession(BrowserWindow.fromWebContents(sender));

const getState = (session: PackageSession): AnalysisSessionState => {
  const current = states.get(session.id);
  if (current) return current;
  const next = { analysisWindow: null };
  states.set(session.id, next);
  return next;
};

const focusOrCreate = (mainWindow?: BrowserWindow | null): BrowserWindow | null => {
  const session = resolveSession(mainWindow);
  if (!session) return null;
  const state = getState(session);
  if (state.analysisWindow && !state.analysisWindow.isDestroyed()) {
    state.analysisWindow.focus();
    return state.analysisWindow;
  }

  const analysisWindow = new BrowserWindow({
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
  state.analysisWindow = analysisWindow;
  registerAuxiliaryWindow(session, analysisWindow);
  applyWindowSecurity(analysisWindow);

  analysisWindow.loadURL(ANALYSIS_HASH_URL);

  analysisWindow.on('closed', () => {
    state.analysisWindow = null;
    unregisterAuxiliaryWindow(session, analysisWindow);
  });

  return analysisWindow;
};

export const openAnalysisWindow = async (
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

export const closeAnalysisWindow = (mainWindow?: BrowserWindow | null): void => {
  if (mainWindow) {
    getState(resolveSession(mainWindow)!).analysisWindow?.close();
    return;
  }
  for (const state of states.values()) {
    if (state.analysisWindow && !state.analysisWindow.isDestroyed()) state.analysisWindow.close();
  }
};

export const isAnalysisWindowOpen = (mainWindow?: BrowserWindow | null): boolean => {
  if (mainWindow) {
    const session = resolveSession(mainWindow);
    return Boolean(session && getState(session).analysisWindow && !getState(session).analysisWindow?.isDestroyed());
  }
  return [...states.values()].some(({ analysisWindow }) => analysisWindow && !analysisWindow.isDestroyed());
};

export const sendAnalysisSync = (
  payload: AnalysisWindowSyncPayload,
  mainWindow?: BrowserWindow | null,
): void => {
  const session = resolveSession(mainWindow);
  const analysisWindow = session ? getState(session).analysisWindow : null;
  if (analysisWindow && !analysisWindow.isDestroyed()) {
    analysisWindow.webContents.send(ANALYSIS_WINDOW_CHANNELS.sync, payload);
  }
};

export const sendAnalysisDashboardFileToWindow = async (
  filePath: string,
  mainWindow?: BrowserWindow | null,
): Promise<void> => {
  await openAnalysisWindow(mainWindow);
  const session = resolveSession(mainWindow);
  const analysisWindow = session ? getState(session).analysisWindow : null;
  if (analysisWindow && !analysisWindow.isDestroyed()) {
    analysisWindow.webContents.send(
      ANALYSIS_WINDOW_CHANNELS.dashboardExternalOpen,
      filePath,
    );
  }
};

export const registerAnalysisWindowHandlers = (): void => {
  ipcMain.handle(ANALYSIS_WINDOW_CHANNELS.openWindow, async (event) => {
    const senderWindow = getValidatedEventSenderWindow(event);
    const session = resolveSession(senderWindow);
    if (!senderWindow || !session) {
      throw new Error('Invalid analysis open sender');
    }
    await openAnalysisWindow(session.mainWindow);
  });

  ipcMain.handle(ANALYSIS_WINDOW_CHANNELS.closeWindow, (event) => {
    const senderWindow = getValidatedEventSenderWindow(event);
    if (!senderWindow) {
      throw new Error('Invalid analysis close sender');
    }

    const session = resolveSession(senderWindow);
    if (!session) throw new Error('Invalid analysis close sender');
    const state = getState(session);
    if (senderWindow === state.analysisWindow) {
      senderWindow.close();
      return;
    }
    if (senderWindow !== session.mainWindow) throw new Error('Invalid analysis close sender');
    state.analysisWindow?.close();
  });

  ipcMain.handle(ANALYSIS_WINDOW_CHANNELS.isWindowOpen, (event) => {
    const senderWindow = getValidatedEventSenderWindow(event);
    const session = resolveSession(senderWindow);
    if (!senderWindow || !session) {
      throw new Error('Invalid analysis state sender');
    }
    const state = getState(session);
    if (senderWindow !== session.mainWindow && senderWindow !== state.analysisWindow) {
      throw new Error('Invalid analysis state sender');
    }
    return Boolean(state.analysisWindow && !state.analysisWindow.isDestroyed());
  });

  ipcMain.on(ANALYSIS_WINDOW_CHANNELS.syncToWindow, (event, payload: unknown) => {
    const session = resolveSenderSession(event.sender);
    if (!session || !isEventFromWindow(event, session.mainWindow) || !isAnalysisWindowSyncPayload(payload)) {
      return;
    }
    sendAnalysisSync(payload, session.mainWindow);
  });

  ipcMain.on(ANALYSIS_WINDOW_CHANNELS.jumpToSegment, (event, segment: unknown) => {
    const session = resolveSenderSession(event.sender);
    const analysisWindow = session ? getState(session).analysisWindow : null;
    if (!session || !isEventFromWindow(event, analysisWindow) || !isTimelineData(segment)) {
      return;
    }

    if (!session.mainWindow.isDestroyed()) {
      session.mainWindow.webContents.send(ANALYSIS_WINDOW_CHANNELS.jumpToSegment, segment);
    }
  });

  ipcMain.on(
    ANALYSIS_WINDOW_CHANNELS.createAiPlaylist,
    (event, payload: unknown) => {
      const session = resolveSenderSession(event.sender);
      const analysisWindow = session ? getState(session).analysisWindow : null;
      if (!session || !isEventFromWindow(event, analysisWindow) ||
          !isAnalysisAiPlaylistPayload(payload)) {
        return;
      }

      if (!session.mainWindow.isDestroyed()) {
        session.mainWindow.webContents.send(
          ANALYSIS_WINDOW_CHANNELS.createAiPlaylist,
          payload,
        );
      }
    },
  );
};
