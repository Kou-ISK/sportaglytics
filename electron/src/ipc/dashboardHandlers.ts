import { BrowserWindow, dialog, ipcMain } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'path';
import { isFileDialogFilterArray, isStringPayload } from './ipcPayloadGuards';
import { getValidatedEventSenderWindow } from './windowSenderGuards';

interface RegisterDashboardHandlersOptions {
  getMainWindow: () => BrowserWindow | null;
}

let isRegistered = false;

export const registerDashboardHandlers = ({
  getMainWindow,
}: RegisterDashboardHandlersOptions): void => {
  if (isRegistered) {
    return;
  }
  isRegistered = true;

  ipcMain.handle(
    'analysis-dashboard:save-package',
    async (event, packagePath: unknown, content: unknown) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid dashboard save sender');
      }
      if (!isStringPayload(packagePath) || !isStringPayload(content)) {
        return false;
      }

      try {
        await fs.mkdir(packagePath, { recursive: true });
        const dashboardPath = path.join(packagePath, 'dashboard.json');
        await fs.writeFile(dashboardPath, content, 'utf-8');
        return true;
      } catch (error) {
        console.error('Failed to save dashboard package:', error);
        return false;
      }
    },
  );

  ipcMain.handle(
    'analysis-dashboard:read-package',
    async (event, packagePath: unknown) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid dashboard read sender');
      }
      if (!isStringPayload(packagePath)) {
        return null;
      }

      try {
        const dashboardPath = path.join(packagePath, 'dashboard.json');
        const content = await fs.readFile(dashboardPath, 'utf-8');
        return content;
      } catch (error) {
        console.error('Failed to read dashboard package:', error);
        return null;
      }
    },
  );

  ipcMain.handle(
    'analysis-dashboard:open-package-dialog',
    async (event, filters: unknown) => {
      const senderWindow = getValidatedEventSenderWindow(event);
      if (!senderWindow) {
        throw new Error('Invalid dashboard dialog sender');
      }
      if (!isFileDialogFilterArray(filters)) {
        return null;
      }

      const mainWindow = getMainWindow();
      const window =
        mainWindow && !mainWindow.isDestroyed() ? mainWindow : senderWindow;
      const result = await dialog.showOpenDialog(window, {
        properties: ['openFile', 'openDirectory'],
        filters,
      });
      return result.canceled ? null : result.filePaths[0];
    },
  );
};
