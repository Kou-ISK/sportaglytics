import { BrowserWindow, dialog, ipcMain } from 'electron';
import * as fs from 'node:fs/promises';
import { isPlainObject, toOptionalString } from './ipcPayloadGuards';
import { getValidatedEventSenderWindow } from './windowSenderGuards';

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
    async (event, codeWindow: unknown, filePath?: unknown) => {
      const senderWindow = getValidatedEventSenderWindow(event);
      if (!senderWindow) {
        throw new Error('Invalid code window save sender');
      }
      if (!isPlainObject(codeWindow)) {
        return null;
      }

      try {
        let targetPath = toOptionalString(filePath);
        if (!targetPath) {
          const window = getMainWindow();
          const parentWindow =
            window && !window.isDestroyed() ? window : senderWindow;
          const result = await dialog.showSaveDialog(parentWindow, {
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

  ipcMain.handle('code-window:load-file', async (event, filePath?: unknown) => {
    const senderWindow = getValidatedEventSenderWindow(event);
    if (!senderWindow) {
      throw new Error('Invalid code window load sender');
    }

    try {
      let targetPath = toOptionalString(filePath);
      if (!targetPath) {
        const window = getMainWindow();
        const parentWindow =
          window && !window.isDestroyed() ? window : senderWindow;
        const result = await dialog.showOpenDialog(parentWindow, {
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
      const codeWindow = JSON.parse(content) as unknown;
      return { codeWindow, filePath: targetPath };
    } catch (error) {
      console.error('Failed to load code window file:', error);
      return null;
    }
  });

  ipcMain.handle('code-window:peek-external-open', async (event) => {
    if (!getValidatedEventSenderWindow(event)) {
      throw new Error('Invalid code window peek sender');
    }

    return pendingCodeWindowExternalOpen;
  });

  ipcMain.handle(
    'code-window:consume-external-open',
    async (event, expectedPath?: unknown) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid code window consume sender');
      }

      if (!pendingCodeWindowExternalOpen) return null;
      const normalizedExpectedPath = toOptionalString(expectedPath);
      if (
        normalizedExpectedPath &&
        pendingCodeWindowExternalOpen !== normalizedExpectedPath
      ) {
        return null;
      }
      const nextPath = pendingCodeWindowExternalOpen;
      pendingCodeWindowExternalOpen = null;
      return nextPath;
    },
  );
};
