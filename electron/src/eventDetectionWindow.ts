import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'node:path';
import { getRendererUrl } from './rendererUrl';
import { applyWindowSecurity } from './windowSecurity';
import {
  getPackageSessionForSender,
  registerAuxiliaryWindow,
  unregisterAuxiliaryWindow,
} from './packageSessionRegistry';
import { isEventFromWindow } from './ipc/windowSenderGuards';
import {
  EVENT_DETECTION_WINDOW_CHANNELS as channels,
  isEventDetectionWindowCommand,
  isEventDetectionWindowState,
  type EventDetectionWindowState,
} from '../../src/types/ipc/eventDetectionWindow';

interface WindowState {
  window: BrowserWindow | null;
  snapshot: EventDetectionWindowState | null;
}
const states = new Map<string, WindowState>();

/** Main video owns inference and Timeline edits; this window only sends form commands. */
export const registerEventDetectionWindowHandlers = (): void => {
  let quitting = false;
  app.on('before-quit', () => {
    quitting = true;
  });
  ipcMain.handle(channels.open, (event) => {
    const session = getPackageSessionForSender(event.sender);
    if (!session || !isEventFromWindow(event, session.mainWindow))
      throw new Error('Invalid event detection window owner');
    let state = states.get(session.id);
    if (!state) {
      state = { window: null, snapshot: null };
      states.set(session.id, state);
    }
    if (state.window && !state.window.isDestroyed()) {
      if (state.window.isMinimized()) state.window.restore();
      state.window.show();
      state.window.focus();
      return;
    }
    const area = screen.getDisplayMatching(
      session.mainWindow.getBounds(),
    ).workArea;
    const width = Math.min(980, area.width),
      height = Math.min(780, area.height);
    const window = new BrowserWindow({
      width,
      height,
      minWidth: Math.min(680, area.width),
      minHeight: Math.min(480, area.height),
      x: Math.round(area.x + (area.width - width) / 2),
      y: Math.round(area.y + (area.height - height) / 2),
      title: '自動イベント検出',
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        webSecurity: true,
      },
    });
    state.window = window;
    registerAuxiliaryWindow(session, window);
    applyWindowSecurity(window);
    window.setMenuBarVisibility(false);
    window.once('ready-to-show', () => {
      if (!window.isDestroyed() && state?.snapshot?.open) window.show();
    });
    // Closing the surface must not cancel an analysis owned by the main video.
    window.on('close', (event) => {
      if (!quitting && !session.mainWindow.isDestroyed()) {
        event.preventDefault();
        window.hide();
      }
    });
    const onOwnerClosed = (): void => {
      if (!window.isDestroyed()) window.destroy();
      states.delete(session.id);
    };
    session.mainWindow.once('closed', onOwnerClosed);
    window.on('closed', () => {
      unregisterAuxiliaryWindow(session, window);
      session.mainWindow.removeListener('closed', onOwnerClosed);
      states.delete(session.id);
    });
    void window.loadURL(getRendererUrl('/event-detection'));
  });
  ipcMain.on(channels.publish, (event, payload: unknown) => {
    const session = getPackageSessionForSender(event.sender);
    if (
      !session ||
      !isEventFromWindow(event, session.mainWindow) ||
      (payload !== null && !isEventDetectionWindowState(payload))
    )
      return;
    const previous = states.get(session.id);
    if (!previous?.window && !payload?.open) {
      states.delete(session.id);
      return;
    }
    const state = previous ?? { window: null, snapshot: null };
    state.snapshot = payload;
    states.set(session.id, state);
    if (state.window && !state.window.isDestroyed()) {
      state.window.webContents.send(channels.state, payload);
      if (!payload?.open) state.window.hide();
    }
  });
  ipcMain.handle(channels.request, (event) => {
    const session = getPackageSessionForSender(event.sender);
    const state = session ? states.get(session.id) : undefined;
    if (!state || !isEventFromWindow(event, state.window))
      throw new Error('Invalid event detection state sender');
    return state.snapshot;
  });
  ipcMain.handle(channels.hide, (event) => {
    const session = getPackageSessionForSender(event.sender);
    const state = session ? states.get(session.id) : undefined;
    if (
      !session ||
      !state ||
      (!isEventFromWindow(event, state.window) &&
        !isEventFromWindow(event, session.mainWindow))
    )
      throw new Error('Invalid event detection hide sender');
    if (state.window && !state.window.isDestroyed()) state.window.hide();
  });
  ipcMain.on(channels.command, (event, command: unknown) => {
    const session = getPackageSessionForSender(event.sender);
    const state = session ? states.get(session.id) : undefined;
    if (
      !session ||
      !state ||
      !isEventFromWindow(event, state.window) ||
      !isEventDetectionWindowCommand(command)
    )
      return;
    session.mainWindow.webContents.send(channels.command, command);
  });
};
