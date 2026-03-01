import { BrowserWindow, dialog, ipcMain } from 'electron';
import * as fs from 'node:fs/promises';

interface RegisterCodeWindowHandlersOptions {
  getMainWindow: () => BrowserWindow | null;
}

let isRegistered = false;
let pendingCodeWindowExternalOpen: string | null = null;

export const setPendingCodeWindowExternalOpen = (
  filePath: string | null,
): void => {
  pendingCodeWindowExternalOpen = filePath;
};

export const getPendingCodeWindowExternalOpen = (): string | null => {
  return pendingCodeWindowExternalOpen;
};

export const registerCodeWindowHandlers = ({
  getMainWindow,
}: RegisterCodeWindowHandlersOptions): void => {
  if (isRegistered) {
    return;
  }
  isRegistered = true;

  ipcMain.handle(
    'code-window:save-file',
    async (_event, codeWindow: unknown, filePath?: string) => {
      try {
        let targetPath = filePath;
        if (!targetPath) {
          const window = getMainWindow();
          const result = window
            ? await dialog.showSaveDialog(window, {
                defaultPath: 'CodeWindow.stcw',
                filters: [
                  { name: 'コードウィンドウファイル', extensions: ['stcw'] },
                  { name: 'すべてのファイル', extensions: ['*'] },
                ],
              })
            : await dialog.showSaveDialog({
                defaultPath: 'CodeWindow.stcw',
                filters: [
                  { name: 'コードウィンドウファイル', extensions: ['stcw'] },
                  { name: 'すべてのファイル', extensions: ['*'] },
                ],
              });
          if (result.canceled || !result.filePath) return null;
          targetPath = result.filePath;
        }

        const content = JSON.stringify(codeWindow, null, 2);
        await fs.writeFile(targetPath, content, 'utf-8');
        return targetPath;
      } catch (error) {
        console.error('Failed to save code window file:', error);
        return null;
      }
    },
  );

  ipcMain.handle('code-window:load-file', async (_event, filePath?: string) => {
    try {
      let targetPath = filePath;
      if (!targetPath) {
        const window = getMainWindow();
        const result = window
          ? await dialog.showOpenDialog(window, {
              properties: ['openFile'],
              filters: [
                { name: 'コードウィンドウファイル', extensions: ['stcw'] },
                { name: 'すべてのファイル', extensions: ['*'] },
              ],
            })
          : await dialog.showOpenDialog({
              properties: ['openFile'],
              filters: [
                { name: 'コードウィンドウファイル', extensions: ['stcw'] },
                { name: 'すべてのファイル', extensions: ['*'] },
              ],
            });
        if (result.canceled || result.filePaths.length === 0) return null;
        targetPath = result.filePaths[0];
      }

      const content = await fs.readFile(targetPath, 'utf-8');
      const codeWindow = JSON.parse(content);
      return { codeWindow, filePath: targetPath };
    } catch (error) {
      console.error('Failed to load code window file:', error);
      return null;
    }
  });

  ipcMain.handle('code-window:peek-external-open', async () => {
    return pendingCodeWindowExternalOpen;
  });

  ipcMain.handle(
    'code-window:consume-external-open',
    async (_event, expectedPath?: string) => {
      if (!pendingCodeWindowExternalOpen) return null;
      if (expectedPath && pendingCodeWindowExternalOpen !== expectedPath) {
        return null;
      }
      const nextPath = pendingCodeWindowExternalOpen;
      pendingCodeWindowExternalOpen = null;
      return nextPath;
    },
  );
};
