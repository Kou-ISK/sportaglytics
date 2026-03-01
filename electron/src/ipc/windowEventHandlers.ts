import { BrowserWindow, ipcMain } from 'electron';

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

  ipcMain.on('hotkeys-updated', () => {
    onHotkeysUpdated();
  });

  ipcMain.on('recent-packages:update', (_event, paths: string[]) => {
    if (Array.isArray(paths)) {
      onRecentPackagesUpdated(paths);
    }
  });

  ipcMain.on('set-window-title', (_event, title: string) => {
    const window = getMainWindow();
    if (window && !window.isDestroyed()) {
      window.setTitle(title);
    }
  });
};
