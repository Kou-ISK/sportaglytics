import {
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainInvokeEvent,
} from 'electron';
import * as fs from 'node:fs/promises';
import {
  isCaptureRegionPayload,
  isFileDialogFilterArray,
  isStringPayload,
} from './ipcPayloadGuards';
import { getValidatedEventSenderWindow } from './windowSenderGuards';

interface RegisterFileHandlersOptions {
  getMainWindow: () => BrowserWindow | null;
}

let isRegistered = false;

const getDialogParentWindow = (
  event: IpcMainInvokeEvent,
  getMainWindow: () => BrowserWindow | null,
): BrowserWindow => {
  const senderWindow = getValidatedEventSenderWindow(event);
  if (!senderWindow) {
    throw new Error('Invalid file IPC sender');
  }

  const mainWindow = getMainWindow();
  return mainWindow && !mainWindow.isDestroyed() ? mainWindow : senderWindow;
};

export const registerFileHandlers = ({
  getMainWindow,
}: RegisterFileHandlersOptions): void => {
  if (isRegistered) {
    return;
  }
  isRegistered = true;

  ipcMain.handle(
    'save-file-dialog',
    async (event, defaultPath: unknown, filters: unknown) => {
      const window = getDialogParentWindow(event, getMainWindow);
      if (!isStringPayload(defaultPath) || !isFileDialogFilterArray(filters)) {
        throw new Error('Invalid save file dialog payload');
      }

      const result = await dialog.showSaveDialog(window, {
        defaultPath,
        filters,
      });
      return result.canceled ? null : result.filePath;
    },
  );

  ipcMain.handle('open-file-dialog', async (event, filters: unknown) => {
    const window = getDialogParentWindow(event, getMainWindow);
    if (!isFileDialogFilterArray(filters)) {
      throw new Error('Invalid open file dialog payload');
    }

    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      filters,
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle(
    'write-text-file',
    async (event, filePath: unknown, content: unknown) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid write text file sender');
      }
      if (!isStringPayload(filePath) || !isStringPayload(content)) {
        return false;
      }

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
    async (event, filePath: unknown, base64Content: unknown) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid write binary file sender');
      }
      if (!isStringPayload(filePath) || !isStringPayload(base64Content)) {
        return false;
      }

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

  ipcMain.handle('capture-window-region-png', async (event, rect: unknown) => {
    const senderWindow = getValidatedEventSenderWindow(event);
    if (!senderWindow) {
      throw new Error('Invalid capture window sender');
    }
    if (!isCaptureRegionPayload(rect)) {
      return null;
    }

    try {
      const x = Math.max(0, Math.round(rect.x));
      const y = Math.max(0, Math.round(rect.y));
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const image = await senderWindow.webContents.capturePage({
        x,
        y,
        width,
        height,
      });
      if (!image || image.isEmpty()) return null;
      return image.toPNG().toString('base64');
    } catch (error) {
      console.error('Failed to capture window region as PNG:', error);
      return null;
    }
  });

  ipcMain.handle('read-text-file', async (event, filePath: unknown) => {
    if (!getValidatedEventSenderWindow(event)) {
      throw new Error('Invalid read text file sender');
    }
    if (!isStringPayload(filePath)) {
      return null;
    }

    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return content;
    } catch (error) {
      console.error('Failed to read file:', error);
      return null;
    }
  });

  ipcMain.handle('read-binary-file', async (event, filePath: unknown) => {
    if (!getValidatedEventSenderWindow(event)) {
      throw new Error('Invalid read binary file sender');
    }
    if (!isStringPayload(filePath)) {
      return null;
    }

    try {
      const content = await fs.readFile(filePath);
      return content.toString('base64');
    } catch (error) {
      console.error('Failed to read binary file:', error);
      return null;
    }
  });
};
