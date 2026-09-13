import { getRendererUrl } from './rendererUrl';
import { BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import {
  TIMELINE_WINDOW_CHANNELS,
  isTimelineWindowCommand,
  isTimelineWindowClockPayload,
  isTimelineWindowSyncPayload,
  type TimelineWindowCommand,
  type TimelineWindowClockPayload,
  type TimelineWindowSyncPayload,
} from '../../src/types/ipc/timelineWindow';
import { isEventFromWindow } from './ipc/windowSenderGuards';
import { applyWindowSecurity } from './windowSecurity';
import {
  createPackageSession,
  getPackageSessionForSender,
  getPackageSessionForWindow,
  registerAuxiliaryWindow,
  unregisterAuxiliaryWindow,
  type PackageSession,
} from './packageSessionRegistry';

interface TimelineSessionState {
  timelineWindow: BrowserWindow | null;
  lastBounds: Electron.Rectangle | null;
}

const states = new Map<string, TimelineSessionState>();
let defaultMainWindow: BrowserWindow | null = null;

const TIMELINE_URL = getRendererUrl('/timeline');

export const setTimelineMainWindowRef = (window: BrowserWindow): void => {
  defaultMainWindow = window;
  createPackageSession(window);
};

const getSession = (window?: BrowserWindow | null): PackageSession | null => {
  const target = window ?? defaultMainWindow;
  if (!target) return null;
  return getPackageSessionForWindow(target) ?? createPackageSession(target);
};

const getSenderSession = (sender: Electron.WebContents): PackageSession | null =>
  getPackageSessionForSender(sender) ?? getSession(BrowserWindow.fromWebContents(sender));

const getState = (session: PackageSession): TimelineSessionState => {
  const current = states.get(session.id);
  if (current) return current;
  const next: TimelineSessionState = { timelineWindow: null, lastBounds: null };
  states.set(session.id, next);
  return next;
};

const sendVisibility = (session: PackageSession, isOpen: boolean): void => {
  if (!session.mainWindow.isDestroyed()) {
    session.mainWindow.webContents.send(TIMELINE_WINDOW_CHANNELS.visibility, isOpen);
  }
};

export const openTimelineWindow = async (
  mainWindow?: BrowserWindow | null,
): Promise<void> => {
  const session = getSession(mainWindow);
  if (!session) return;
  const state = getState(session);
  if (state.timelineWindow && !state.timelineWindow.isDestroyed()) {
    state.timelineWindow.focus();
    return;
  }

  const timelineWindow = new BrowserWindow({
    width: state.lastBounds?.width ?? 1280,
    height: state.lastBounds?.height ?? 430,
    x: state.lastBounds?.x,
    y: state.lastBounds?.y,
    minWidth: 720,
    minHeight: 260,
    title: 'タイムライン',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  state.timelineWindow = timelineWindow;
  registerAuxiliaryWindow(session, timelineWindow);
  applyWindowSecurity(timelineWindow);
  timelineWindow.loadURL(TIMELINE_URL);
  timelineWindow.on('close', () => {
    if (!timelineWindow.isDestroyed()) {
      state.lastBounds = timelineWindow.getBounds();
    }
  });
  timelineWindow.on('closed', () => {
    state.timelineWindow = null;
    unregisterAuxiliaryWindow(session, timelineWindow);
    sendVisibility(session, false);
  });
  timelineWindow.webContents.once('did-finish-load', () => {
    sendVisibility(session, true);
    if (!session.mainWindow.isDestroyed()) {
      session.mainWindow.webContents.send(TIMELINE_WINDOW_CHANNELS.command, {
        type: 'request-sync',
      } satisfies TimelineWindowCommand);
    }
  });
};

export const closeTimelineWindow = (): void => {
  for (const state of states.values()) state.timelineWindow?.close();
};

export const closeTimelineWindowForMainWindow = (window: BrowserWindow): void => {
  const session = getSession(window);
  if (session) getState(session).timelineWindow?.close();
};

export const registerTimelineWindowHandlers = (): void => {
  ipcMain.handle(TIMELINE_WINDOW_CHANNELS.openWindow, async (event) => {
    const session = getSenderSession(event.sender);
    if (!session || !isEventFromWindow(event, session.mainWindow)) {
      throw new Error('Invalid timeline window open sender');
    }
    await openTimelineWindow(session.mainWindow);
  });

  ipcMain.handle(TIMELINE_WINDOW_CHANNELS.closeWindow, (event) => {
    const session = getSenderSession(event.sender);
    const state = session ? getState(session) : null;
    if (!session || !state ||
        (!isEventFromWindow(event, state.timelineWindow) &&
          !isEventFromWindow(event, session.mainWindow))) {
      throw new Error('Invalid timeline window close sender');
    }
    state.timelineWindow?.close();
  });

  ipcMain.handle(TIMELINE_WINDOW_CHANNELS.isWindowOpen, (event) => {
    const session = getSenderSession(event.sender);
    const state = session ? getState(session) : null;
    if (!session || !state ||
        (!isEventFromWindow(event, session.mainWindow) &&
          !isEventFromWindow(event, state.timelineWindow))) {
      throw new Error('Invalid timeline window state sender');
    }
    return Boolean(state.timelineWindow && !state.timelineWindow.isDestroyed());
  });

  ipcMain.on(
    TIMELINE_WINDOW_CHANNELS.syncToWindow,
    (event, payload: unknown) => {
      const session = getSenderSession(event.sender);
      if (!session || !isEventFromWindow(event, session.mainWindow) ||
          !isTimelineWindowSyncPayload(payload)) {
        return;
      }
      const timelineWindow = getState(session).timelineWindow;
      if (timelineWindow && !timelineWindow.isDestroyed()) {
        timelineWindow.webContents.send(
          TIMELINE_WINDOW_CHANNELS.sync,
          payload satisfies TimelineWindowSyncPayload,
        );
      }
    },
  );

  ipcMain.on(
    TIMELINE_WINDOW_CHANNELS.clockToWindow,
    (event, payload: unknown) => {
      const session = getSenderSession(event.sender);
      if (!session || !isEventFromWindow(event, session.mainWindow) ||
          !isTimelineWindowClockPayload(payload)) {
        return;
      }
      const timelineWindow = getState(session).timelineWindow;
      if (timelineWindow && !timelineWindow.isDestroyed()) {
        timelineWindow.webContents.send(
          TIMELINE_WINDOW_CHANNELS.clock,
          payload satisfies TimelineWindowClockPayload,
        );
      }
    },
  );

  ipcMain.on(TIMELINE_WINDOW_CHANNELS.command, (event, command: unknown) => {
    const session = getSenderSession(event.sender);
    const timelineWindow = session ? getState(session).timelineWindow : null;
    if (!session || !isEventFromWindow(event, timelineWindow) ||
        !isTimelineWindowCommand(command)) {
      return;
    }
    if (!session.mainWindow.isDestroyed()) {
      session.mainWindow.webContents.send(TIMELINE_WINDOW_CHANNELS.command, command);
    }
  });
};
