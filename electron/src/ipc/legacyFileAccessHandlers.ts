import { app, BrowserWindow, dialog } from 'electron';
import * as fs from 'node:fs/promises';
import { refreshAppMenu } from '../menuBar';
import { registerHandleWithAliases } from './registerHandleWithAliases';

interface RegisterLegacyFileAccessHandlersOptions {
  getMainWindow: () => BrowserWindow | null;
}

let isRegistered = false;

const openDirectoryDialog = async (
  mainWindow: BrowserWindow | null,
): Promise<string | undefined> => {
  const options: Electron.OpenDialogOptions = {
    properties: ['openDirectory'],
    message: 'パッケージを選択する',
    filters: [
      {
        name: 'パッケージファイル',
        extensions: ['pkg'],
      },
    ],
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled) return undefined;
  const selected = result.filePaths[0];
  if (!selected) return undefined;
  try {
    app.addRecentDocument(selected);
  } catch (error) {
    console.warn('addRecentDocument failed', error);
  }
  try {
    refreshAppMenu();
  } catch (error) {
    console.warn('refreshAppMenu failed', error);
  }
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
        extensions: ['mov', 'mp4'],
      },
    ],
  };
  const result = mainWindow
    ? await dialog.showOpenDialog(mainWindow, options)
    : await dialog.showOpenDialog(options);
  if (result.canceled) return undefined;
  return result.filePaths[0];
};

export const registerLegacyFileAccessHandlers = ({
  getMainWindow,
}: RegisterLegacyFileAccessHandlersOptions): void => {
  if (isRegistered) {
    return;
  }
  isRegistered = true;

  registerHandleWithAliases(
    'files:open-directory',
    ['open-directory'],
    async () => {
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
    async () => {
      try {
        return await openVideoFileDialog(getMainWindow());
      } catch (error) {
        console.error('open file dialog error:', error);
        return undefined;
      }
    },
  );

  registerHandleWithAliases(
    'timeline:export-json',
    ['export-timeline'],
    async (_event, filePath: string, source: unknown) => {
      const serialized = JSON.stringify(source);
      await fs.writeFile(filePath, serialized, 'utf-8');
    },
  );

  registerHandleWithAliases(
    'files:exists',
    ['check-file-exists'],
    async (_event, filePath: string) => {
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
    async (_event, filePath: string) => {
      try {
        const data = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(data);
      } catch (error) {
        console.error(`JSONファイル読み込みエラー: ${filePath}`, error);
        throw error;
      }
    },
  );
};
