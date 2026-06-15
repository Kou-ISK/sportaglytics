import { BrowserWindow, ipcMain } from 'electron';
import { isStringArray, isStringPayload } from './ipcPayloadGuards';
import { getValidatedEventSenderWindow } from './windowSenderGuards';

interface RegisterWindowEventHandlersOptions {
  getMainWindow: () => BrowserWindow | null;
  onHotkeysUpdated: () => void;
  onRecentPackagesUpdated: (paths: string[]) => void;
}

let isRegistered = false;

export const registerWindowEventHandlers = ({
  getMainWindow,
  onHotkeysUpdated,
  onRecentPackagesUpdated,
}: RegisterWindowEventHandlersOptions): void => {
  if (isRegistered) {
    return;
  }
  isRegistered = true;

  ipcMain.on('hotkeys-updated', (event) => {
    if (!getValidatedEventSenderWindow(event)) {
      return;
    }

    onHotkeysUpdated();
  });

  ipcMain.on('recent-packages:update', (event, paths: unknown) => {
    if (!getValidatedEventSenderWindow(event)) {
      return;
    }

    if (isStringArray(paths)) {
      onRecentPackagesUpdated(paths);
    }
  });

  ipcMain.on('set-window-title', (event, title: unknown) => {
    if (!getValidatedEventSenderWindow(event) || !isStringPayload(title)) {
      return;
    }

    const window = getMainWindow();
    if (window && !window.isDestroyed()) {
      window.setTitle(title);
    }
  });
};
