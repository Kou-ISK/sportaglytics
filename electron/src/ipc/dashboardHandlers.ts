import { BrowserWindow, dialog, ipcMain } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'path';

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
    async (_event, packagePath: string, content: string) => {
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
    async (_event, packagePath: string) => {
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
    async (_event, filters: { name: string; extensions: string[] }[]) => {
      const window = getMainWindow();
      const result = window
        ? await dialog.showOpenDialog(window, {
            properties: ['openFile', 'openDirectory'],
            filters,
          })
        : await dialog.showOpenDialog({
            properties: ['openFile', 'openDirectory'],
            filters,
          });
      return result.canceled ? null : result.filePaths[0];
    },
  );
};
