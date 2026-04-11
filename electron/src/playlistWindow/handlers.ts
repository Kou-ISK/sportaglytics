import { dialog, ipcMain } from 'electron';
import * as path from 'path';
import type { PlaylistFileLoadResult } from '../../../src/types/playlist/core';
import {
  PLAYLIST_WINDOW_CHANNELS,
  isPlaylist,
  isPlaylistCommand,
  isPlaylistItem,
  isPlaylistSyncData,
} from '../../../src/types/ipc/playlistWindow';
import { getValidatedEventSenderWindow, isEventFromWindow } from '../ipc/windowSenderGuards';
import {
  addItemToAllWindows,
  closePlaylistWindow,
  createPlaylistWindow,
  getOpenWindowCount,
  getWindowInfoBySender,
  isPlaylistWindowOpen,
  isSenderPlaylistWindow,
  setPlaylistWindowTitleForSender,
  syncToPlaylistWindow,
} from './windowManager';
import { getFfmpegPathRef, getMainWindowRef, getPlaylistWindows } from './state';
import { loadPlaylistFromPath, savePlaylistToPath } from './storage';

export const registerPlaylistHandlers = (): void => {
  ipcMain.handle(
    PLAYLIST_WINDOW_CHANNELS.openWindow,
    (event, filePath?: unknown) => {
      if (!getValidatedEventSenderWindow(event)) {
        throw new Error('Invalid playlist open sender');
      }

      createPlaylistWindow(typeof filePath === 'string' ? filePath : undefined);
    },
  );

  ipcMain.handle(PLAYLIST_WINDOW_CHANNELS.closeWindow, (event) => {
    if (!getValidatedEventSenderWindow(event)) {
      throw new Error('Invalid playlist close sender');
    }

    closePlaylistWindow();
  });

  ipcMain.handle(PLAYLIST_WINDOW_CHANNELS.isWindowOpen, (event) => {
    if (!getValidatedEventSenderWindow(event)) {
      throw new Error('Invalid playlist state sender');
    }
    return isPlaylistWindowOpen();
  });

  ipcMain.handle(PLAYLIST_WINDOW_CHANNELS.getOpenCount, (event) => {
    if (!getValidatedEventSenderWindow(event)) {
      throw new Error('Invalid playlist count sender');
    }
    return getOpenWindowCount();
  });

  ipcMain.handle(
    PLAYLIST_WINDOW_CHANNELS.addItemToAllWindows,
    (event, item: unknown) => {
      if (!isEventFromWindow(event, getMainWindowRef()) || !isPlaylistItem(item)) {
        return;
      }

      addItemToAllWindows(item);
    },
  );

  ipcMain.on(PLAYLIST_WINDOW_CHANNELS.syncToWindow, (event, data: unknown) => {
    if (!isEventFromWindow(event, getMainWindowRef()) || !isPlaylistSyncData(data)) {
      return;
    }

    syncToPlaylistWindow(data);
  });

  ipcMain.on(PLAYLIST_WINDOW_CHANNELS.command, (event, command: unknown) => {
    if (!isSenderPlaylistWindow(event.sender) || !isPlaylistCommand(command)) {
      return;
    }

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
      mainWindow.webContents.send(PLAYLIST_WINDOW_CHANNELS.command, command);
    }
  });

  ipcMain.on(PLAYLIST_WINDOW_CHANNELS.savedAndClose, (event) => {
    if (!isSenderPlaylistWindow(event.sender)) {
      return;
    }

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
    PLAYLIST_WINDOW_CHANNELS.saveFile,
    async (event, playlist: unknown): Promise<string | null> => {
      try {
        if (!isSenderPlaylistWindow(event.sender) || !isPlaylist(playlist)) {
          return null;
        }

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
    PLAYLIST_WINDOW_CHANNELS.saveFileAs,
    async (event, playlist: unknown): Promise<string | null> => {
      try {
        if (!isSenderPlaylistWindow(event.sender) || !isPlaylist(playlist)) {
          return null;
        }

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
    PLAYLIST_WINDOW_CHANNELS.loadFile,
    async (
      event,
      givenPath?: unknown,
    ): Promise<PlaylistFileLoadResult | null> => {
      try {
        if (!getValidatedEventSenderWindow(event)) {
          return null;
        }

        let targetPath = typeof givenPath === 'string' ? givenPath : undefined;
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

  ipcMain.on(
    PLAYLIST_WINDOW_CHANNELS.setWindowTitle,
    (event, title: unknown) => {
      if (!isSenderPlaylistWindow(event.sender) || typeof title !== 'string') {
        return;
      }

      setPlaylistWindowTitleForSender(event.sender, title);
    },
  );
};
