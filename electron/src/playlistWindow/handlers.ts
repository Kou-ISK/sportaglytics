import { dialog, ipcMain } from 'electron';
import * as path from 'path';
import type {
  Playlist,
  PlaylistCommand,
  PlaylistItem,
  PlaylistSyncData,
} from '../../../src/types/Playlist';
import {
  addItemToAllWindows,
  closePlaylistWindow,
  createPlaylistWindow,
  getOpenWindowCount,
  getWindowInfoBySender,
  isPlaylistWindowOpen,
  isSenderPlaylistWindow,
  syncToPlaylistWindow,
} from './windowManager';
import { getFfmpegPathRef, getMainWindowRef, getPlaylistWindows } from './state';
import { loadPlaylistFromPath, savePlaylistToPath } from './storage';

export const registerPlaylistHandlers = (): void => {
  ipcMain.handle('playlist:open-window', (_event, filePath?: string) => {
    createPlaylistWindow(filePath);
  });

  ipcMain.handle('playlist:close-window', () => {
    closePlaylistWindow();
  });

  ipcMain.handle('playlist:is-window-open', () => {
    return isPlaylistWindowOpen();
  });

  ipcMain.handle('playlist:get-open-count', () => {
    return getOpenWindowCount();
  });

  ipcMain.handle('playlist:add-item-to-all-windows', (_event, item: PlaylistItem) => {
    addItemToAllWindows(item);
  });

  ipcMain.on('playlist:sync-to-window', (_event, data: PlaylistSyncData) => {
    syncToPlaylistWindow(data);
  });

  ipcMain.on('playlist:command', (event, command: PlaylistCommand) => {
    if (command?.type === 'set-dirty') {
      const playlistWindows = getPlaylistWindows();
      for (const [windowId, info] of playlistWindows) {
        if (info.window.webContents === event.sender) {
          info.isDirty = !!command.isDirty;
          console.log(
            `[Playlist] Window ${windowId} isDirty set to:`,
            command.isDirty,
          );
          break;
        }
      }
    }

    const mainWindow = getMainWindowRef();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('playlist:command', command);
    }
  });

  ipcMain.on('playlist:saved-and-close', (event) => {
    const sender = event.sender;
    const playlistWindows = getPlaylistWindows();
    for (const [windowId, info] of playlistWindows) {
      if (info.window.webContents === sender) {
        console.log(`[Playlist] Closing window ${windowId} after save`);
        info.isDirty = false;
        if (!info.window.isDestroyed()) {
          info.window.destroy();
        }
        break;
      }
    }
  });

  ipcMain.handle(
    'playlist:save-file',
    async (event, playlist: Playlist): Promise<string | null> => {
      try {
        const windowInfo = getWindowInfoBySender(event.sender);
        let targetPath = windowInfo?.filePath;

        if (!targetPath) {
          const { filePath } = await dialog.showSaveDialog({
            title: 'プレイリストを保存',
            defaultPath: `${playlist.name || 'playlist'}.stpl`,
            filters: [{ name: 'SporTagLytics Playlist', extensions: ['stpl'] }],
          });

          if (!filePath) return null;
          targetPath = filePath;
        }

        const ffmpegPath = getFfmpegPathRef();
        if (!ffmpegPath) {
          throw new Error('FFmpeg path not set');
        }

        await savePlaylistToPath(targetPath, playlist, event, ffmpegPath);

        if (windowInfo) {
          windowInfo.filePath = targetPath;
          windowInfo.isDirty = false;
        }

        return targetPath;
      } catch (error) {
        console.error('[Playlist] Save error:', error);
        await dialog.showMessageBox({
          type: 'error',
          title: '保存エラー',
          message: 'プレイリストの保存に失敗しました',
          detail: error instanceof Error ? error.message : String(error),
          buttons: ['OK'],
        });
        return null;
      }
    },
  );

  ipcMain.handle(
    'playlist:save-file-as',
    async (event, playlist: Playlist): Promise<string | null> => {
      try {
        const windowInfo = getWindowInfoBySender(event.sender);
        const currentPath = windowInfo?.filePath;
        const defaultName = currentPath
          ? path.basename(currentPath, '.stpl')
          : playlist.name || 'playlist';

        const { filePath } = await dialog.showSaveDialog({
          title: '名前を付けて保存',
          defaultPath: `${defaultName}.stpl`,
          filters: [{ name: 'SporTagLytics Playlist', extensions: ['stpl'] }],
        });

        if (!filePath) return null;

        const ffmpegPath = getFfmpegPathRef();
        if (!ffmpegPath) {
          throw new Error('FFmpeg path not set');
        }

        await savePlaylistToPath(filePath, playlist, event, ffmpegPath);

        if (windowInfo) {
          windowInfo.filePath = filePath;
          windowInfo.isDirty = false;
        }

        await dialog.showMessageBox({
          type: 'info',
          title: '保存完了',
          message: 'プレイリストを保存しました',
          detail: `保存先: ${filePath}`,
          buttons: ['OK'],
        });

        return filePath;
      } catch (error) {
        console.error('[Playlist] Save-as error:', error);
        await dialog.showMessageBox({
          type: 'error',
          title: '保存エラー',
          message: 'プレイリストの保存に失敗しました',
          detail: error instanceof Error ? error.message : String(error),
          buttons: ['OK'],
        });

        return null;
      }
    },
  );

  ipcMain.handle(
    'playlist:load-file',
    async (
      event,
      givenPath?: string,
    ): Promise<{ playlist: Playlist; filePath: string } | null> => {
      try {
        let targetPath = givenPath;
        if (!targetPath) {
          const { filePaths } = await dialog.showOpenDialog({
            title: 'プレイリストを開く',
            filters: [{ name: 'SporTagLytics Playlist', extensions: ['stpl'] }],
            properties: ['openFile', 'openDirectory'],
          });
          if (filePaths.length === 0) return null;
          targetPath = filePaths[0];
        }
        if (!targetPath) return null;

        const resolvedPlaylist = await loadPlaylistFromPath(targetPath);

        console.log('[Playlist] Loaded from:', targetPath);

        if (!isSenderPlaylistWindow(event.sender)) {
          createPlaylistWindow(targetPath);
        } else {
          const windowInfo = getWindowInfoBySender(event.sender);
          if (windowInfo) {
            windowInfo.filePath = targetPath;
            windowInfo.isDirty = false;
            console.log('[Playlist] Updated window info with filePath:', targetPath);
          }
        }

        return { playlist: resolvedPlaylist, filePath: targetPath };
      } catch (error) {
        console.error('[Playlist] Load error:', error);
        await dialog.showErrorBox(
          '読み込みエラー',
          `プレイリストの読み込みに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      }
    },
  );
};
