import { BrowserWindow, dialog, ipcMain } from 'electron';
import * as fs from 'node:fs/promises';

interface RegisterFileHandlersOptions {
  getMainWindow: () => BrowserWindow | null;
}

let isRegistered = false;

export const registerFileHandlers = ({
  getMainWindow,
}: RegisterFileHandlersOptions): void => {
  if (isRegistered) {
    return;
  }
  isRegistered = true;

  ipcMain.handle(
    'save-file-dialog',
    async (
      _event,
      defaultPath: string,
      filters: { name: string; extensions: string[] }[],
    ) => {
      const window = getMainWindow();
      const result = window
        ? await dialog.showSaveDialog(window, {
            defaultPath,
            filters,
          })
        : await dialog.showSaveDialog({
            defaultPath,
            filters,
          });
      return result.canceled ? null : result.filePath;
    },
  );

  ipcMain.handle(
    'open-file-dialog',
    async (_event, filters: { name: string; extensions: string[] }[]) => {
      const window = getMainWindow();
      const result = window
        ? await dialog.showOpenDialog(window, {
            properties: ['openFile'],
            filters,
          })
        : await dialog.showOpenDialog({
            properties: ['openFile'],
            filters,
          });
      return result.canceled ? null : result.filePaths[0];
    },
  );

  ipcMain.handle(
    'write-text-file',
    async (_event, filePath: string, content: string) => {
      try {
        await fs.writeFile(filePath, content, 'utf-8');
        return true;
      } catch (error) {
        console.error('Failed to write file:', error);
        return false;
      }
    },
  );

  ipcMain.handle(
    'write-binary-file',
    async (_event, filePath: string, base64Content: string) => {
      try {
        const buffer = Buffer.from(base64Content, 'base64');
        await fs.writeFile(filePath, buffer);
        return true;
      } catch (error) {
        console.error('Failed to write binary file:', error);
        return false;
      }
    },
  );

  ipcMain.handle(
    'capture-window-region-png',
    async (
      event,
      rect: { x: number; y: number; width: number; height: number },
    ) => {
      try {
        if (!rect) return null;
        const x = Math.max(0, Math.round(rect.x));
        const y = Math.max(0, Math.round(rect.y));
        const width = Math.max(1, Math.round(rect.width));
        const height = Math.max(1, Math.round(rect.height));
        const image = await event.sender.capturePage({ x, y, width, height });
        if (!image || image.isEmpty()) return null;
        return image.toPNG().toString('base64');
      } catch (error) {
        console.error('Failed to capture window region as PNG:', error);
        return null;
      }
    },
  );

  ipcMain.handle('read-text-file', async (_event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.error('Failed to read file:', error);
      return null;
    }
  });

  ipcMain.handle('read-binary-file', async (_event, filePath: string) => {
    try {
      const content = await fs.readFile(filePath);
      return content.toString('base64');
    } catch (error) {
      console.error('Failed to read binary file:', error);
      return null;
    }
  });
};
