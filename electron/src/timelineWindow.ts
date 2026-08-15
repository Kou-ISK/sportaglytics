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

let mainWindow: BrowserWindow | null = null;
let timelineWindow: BrowserWindow | null = null;
let lastBounds: Electron.Rectangle | null = null;

const TIMELINE_URL = `file:${path.join(__dirname, '../../index.html')}#/timeline`;

export const setTimelineMainWindowRef = (window: BrowserWindow): void => {
  mainWindow = window;
};

const sendVisibility = (isOpen: boolean): void => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(TIMELINE_WINDOW_CHANNELS.visibility, isOpen);
  }
};

export const openTimelineWindow = async (): Promise<void> => {
  if (timelineWindow && !timelineWindow.isDestroyed()) {
    timelineWindow.focus();
    return;
  }

  timelineWindow = new BrowserWindow({
    width: lastBounds?.width ?? 1280,
    height: lastBounds?.height ?? 430,
    x: lastBounds?.x,
    y: lastBounds?.y,
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
  applyWindowSecurity(timelineWindow);
  timelineWindow.loadURL(TIMELINE_URL);
  timelineWindow.on('close', () => {
    if (timelineWindow && !timelineWindow.isDestroyed()) {
      lastBounds = timelineWindow.getBounds();
    }
  });
  timelineWindow.on('closed', () => {
    timelineWindow = null;
    sendVisibility(false);
  });
  timelineWindow.webContents.once('did-finish-load', () => {
    sendVisibility(true);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(TIMELINE_WINDOW_CHANNELS.command, {
        type: 'request-sync',
      } satisfies TimelineWindowCommand);
    }
  });
};

export const closeTimelineWindow = (): void => {
  timelineWindow?.close();
};

export const registerTimelineWindowHandlers = (): void => {
  ipcMain.handle(TIMELINE_WINDOW_CHANNELS.openWindow, async (event) => {
    if (!isEventFromWindow(event, mainWindow)) {
      throw new Error('Invalid timeline window open sender');
    }
    await openTimelineWindow();
  });

  ipcMain.handle(TIMELINE_WINDOW_CHANNELS.closeWindow, (event) => {
    if (
      !isEventFromWindow(event, timelineWindow) &&
      !isEventFromWindow(event, mainWindow)
    ) {
      throw new Error('Invalid timeline window close sender');
    }
    closeTimelineWindow();
  });

  ipcMain.handle(TIMELINE_WINDOW_CHANNELS.isWindowOpen, (event) => {
    if (
      !isEventFromWindow(event, mainWindow) &&
      !isEventFromWindow(event, timelineWindow)
    ) {
      throw new Error('Invalid timeline window state sender');
    }
    return Boolean(timelineWindow && !timelineWindow.isDestroyed());
  });

  ipcMain.on(
    TIMELINE_WINDOW_CHANNELS.syncToWindow,
    (event, payload: unknown) => {
      if (
        !isEventFromWindow(event, mainWindow) ||
        !isTimelineWindowSyncPayload(payload)
      ) {
        return;
      }
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
      if (
        !isEventFromWindow(event, mainWindow) ||
        !isTimelineWindowClockPayload(payload)
      ) {
        return;
      }
      if (timelineWindow && !timelineWindow.isDestroyed()) {
        timelineWindow.webContents.send(
          TIMELINE_WINDOW_CHANNELS.clock,
          payload satisfies TimelineWindowClockPayload,
        );
      }
    },
  );

  ipcMain.on(TIMELINE_WINDOW_CHANNELS.command, (event, command: unknown) => {
    if (
      !isEventFromWindow(event, timelineWindow) ||
      !isTimelineWindowCommand(command)
    ) {
      return;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(TIMELINE_WINDOW_CHANNELS.command, command);
    }
  });
};
