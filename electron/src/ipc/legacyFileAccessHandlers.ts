import { BrowserWindow, dialog } from 'electron';
import * as fs from 'node:fs/promises';
import { isStringPayload } from './ipcPayloadGuards';
import { registerHandleWithAliases } from './registerHandleWithAliases';
import { getValidatedEventSenderWindow } from './windowSenderGuards';

interface RegisterLegacyFileAccessHandlersOptions {
  getMainWindow: () => BrowserWindow | null;
}

let isRegistered = false;

const openDirectoryDialog = async (
  mainWindow: BrowserWindow | null,
): Promise<string | undefined> => {
  const options: Electron.OpenDialogOptions = {
    properties: ['openDirectory', 'treatPackageAsDirectory'],
    message: '新しいプロジェクトの保存先フォルダを選択する',
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled) return undefined;
  const selected = result.filePaths[0];
  if (!selected) return undefined;
  return selected;
};

const openVideoFileDialog = async (
  mainWindow: BrowserWindow | null,
): Promise<string | undefined> => {
  const options: Electron.OpenDialogOptions = {
    properties: ['openFile'],
    message: 'ファイルを選択する',
    filters: [
      {
        name: '映像ファイル',
        extensions: ['mov', 'mp4', 'm4v', 'webm'],
      },
    ],
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled) return undefined;
  return result.filePaths[0];
};

const openVideoFilesDialog = async (
  mainWindow: BrowserWindow | null,
): Promise<string[]> => {
  const options: Electron.OpenDialogOptions = {
    properties: ['openFile', 'multiSelections'],
    message: '同じアングルへ追加する映像を順番に選択',
    filters: [
      {
        name: '映像ファイル',
        extensions: ['mov', 'mp4', 'm4v', 'webm'],
      },
    ],
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  return result.canceled ? [] : result.filePaths;
};

export const registerLegacyFileAccessHandlers = ({
  getMainWindow,
}: RegisterLegacyFileAccessHandlersOptions): void => {
  if (isRegistered) {
    return;
  }
  isRegistered = true;

  registerHandleWithAliases('package:select-path', [], async (event) => {
    const window = getValidatedEventSenderWindow(event);
    if (!window) throw new Error('Invalid package selection sender');
    // The same picker accepts package bundles and ordinary project folders.
    // Main validates their contents after selection, independently of the name.
    const options: Electron.OpenDialogOptions = {
      properties:
        process.platform === 'darwin'
          ? ['openFile', 'openDirectory']
          : ['openDirectory'],
      message: '開くファイルまたはフォルダを選択する',
    };
    const main = getMainWindow();
    const result = await dialog.showOpenDialog(
      main && !main.isDestroyed() ? main : window,
      options,
    );
    return result.canceled ? '' : (result.filePaths[0] ?? '');
  });

  registerHandleWithAliases(
    'files:open-directory',
    ['open-directory'],
    async (event) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid open directory sender');
      }

      try {
        return await openDirectoryDialog(getMainWindow());
      } catch (error) {
        console.error('open directory dialog error:', error);
        return undefined;
      }
    },
  );

  registerHandleWithAliases(
    'files:open-video-file',
    ['open-file'],
    async (event) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid open video file sender');
      }

      try {
        return await openVideoFileDialog(getMainWindow());
      } catch (error) {
        console.error('open file dialog error:', error);
        return undefined;
      }
    },
  );

  registerHandleWithAliases('files:open-video-files', [], async (event) => {
    if (!getValidatedEventSenderWindow(event)) {
      throw new Error('Invalid open video files sender');
    }
    try {
      return await openVideoFilesDialog(getMainWindow());
    } catch (error) {
      console.error('open video files dialog error:', error);
      return [];
    }
  });

  registerHandleWithAliases(
    'timeline:export-json',
    ['export-timeline'],
    async (event, filePath: unknown, source: unknown) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid timeline export sender');
      }
      if (!isStringPayload(filePath)) {
        throw new Error('Invalid timeline export payload');
      }

      const serialized = JSON.stringify(source);
      await fs.writeFile(filePath, serialized, 'utf-8');
    },
  );

  registerHandleWithAliases(
    'files:exists',
    ['check-file-exists'],
    async (event, filePath: unknown) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid file exists sender');
      }
      if (!isStringPayload(filePath)) {
        return false;
      }

      try {
        await fs.access(filePath);
        console.log(`ファイル存在確認: ${filePath} - 存在します`);
        return true;
      } catch (error) {
        console.log(`ファイル存在確認: ${filePath} - 存在しません`, error);
        return false;
      }
    },
  );

  registerHandleWithAliases(
    'files:read-json',
    ['read-json-file'],
    async (event, filePath: unknown) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid read JSON sender');
      }
      if (!isStringPayload(filePath)) {
        throw new Error('Invalid JSON file path');
      }

      try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data) as unknown;
      } catch (error) {
        console.error(`JSONファイル読み込みエラー: ${filePath}`, error);
        throw error;
      }
    },
  );
};
