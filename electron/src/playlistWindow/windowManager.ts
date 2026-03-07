import { BrowserWindow, dialog } from 'electron';
import * as path from 'path';
import type {
  PlaylistItem,
  PlaylistSyncData,
} from '../../../src/types/Playlist';
import { applyWindowSecurity } from '../windowSecurity';
import {
  getMainWindowRef,
  getPlaylistWindows,
  type PlaylistWindowInfo,
} from './state';

const generateWindowId = (): string => {
  return `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const createPlaylistWindow = (filePath?: string): BrowserWindow => {
  const playlistWindows = getPlaylistWindows();
  const windowId = filePath || generateWindowId();

  if (playlistWindows.has(windowId)) {
    const info = playlistWindows.get(windowId);
    if (info && !info.window.isDestroyed()) {
      info.window.focus();
      return info.window;
    }
    playlistWindows.delete(windowId);
  }

  const offset = playlistWindows.size * 50;

  const window = new BrowserWindow({
    width: 450,
    height: 700,
    x: 100 + offset,
    y: 100 + offset,
    minWidth: 350,
    minHeight: 400,
    title: filePath ? path.basename(filePath, '.stpl') : 'プレイリスト',
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  applyWindowSecurity(window);

  const mainURL = `file:${path.join(__dirname, '../../../index.html')}#/playlist`;
  window.loadURL(mainURL);
  window.setMenuBarVisibility(false);

  playlistWindows.set(windowId, {
    window,
    filePath: filePath || null,
    isDirty: false,
  });

  window.on('close', async (e) => {
    const info = playlistWindows.get(windowId);
    if (!info || !info.isDirty) return;

    e.preventDefault();

    const isOverwrite = !!info.filePath;
    const choice = await dialog.showMessageBox(window, {
      type: 'question',
      buttons: ['保存', '保存しない', 'キャンセル'],
      defaultId: 0,
      cancelId: 2,
      title: '未保存の変更',
      message: isOverwrite
        ? 'プレイリストの変更内容を上書き保存して閉じますか？'
        : 'プレイリストに未保存の変更があります',
      detail: isOverwrite
        ? '既存のファイルを上書き保存してウィンドウを閉じます。よろしいですか？\n（「保存しない」を選ぶと変更は破棄されます）'
        : '変更を保存しますか？',
    });

    if (choice.response === 0) {
      window.webContents.send('playlist:request-save');
      return;
    }

    if (choice.response === 1) {
      info.isDirty = false;
      window.destroy();
    }
  });

  window.on('closed', () => {
    playlistWindows.delete(windowId);
    const mainWindow = getMainWindowRef();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('playlist:window-closed', windowId);
    }
  });

  window.webContents.on('ipc-message', (_event, channel, title: string) => {
    if (channel === 'playlist:set-window-title') {
      window.setTitle(title);
    }
  });

  return window;
};

export const sendPlaylistFileToWindow = (filePath: string): void => {
  const win = createPlaylistWindow(filePath);
  const send = () => win.webContents.send('playlist:external-open', filePath);
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', send);
  } else {
    send();
  }
};

export const closeAllPlaylistWindows = (): void => {
  const playlistWindows = getPlaylistWindows();
  for (const [, info] of playlistWindows) {
    if (!info.window.isDestroyed()) {
      info.window.close();
    }
  }
  playlistWindows.clear();
};

export const closePlaylistWindow = (): void => {
  const playlistWindows = getPlaylistWindows();
  const firstWindow = playlistWindows.values().next().value;
  if (firstWindow && !firstWindow.window.isDestroyed()) {
    firstWindow.window.close();
  }
};

export const isPlaylistWindowOpen = (): boolean => {
  const playlistWindows = getPlaylistWindows();
  for (const [, info] of playlistWindows) {
    if (!info.window.isDestroyed()) {
      return true;
    }
  }
  return false;
};

export const getOpenWindowCount = (): number => {
  const playlistWindows = getPlaylistWindows();
  let count = 0;
  for (const [, info] of playlistWindows) {
    if (!info.window.isDestroyed()) {
      count += 1;
    }
  }
  return count;
};

export const addItemToAllWindows = (item: PlaylistItem): void => {
  const playlistWindows = getPlaylistWindows();
  for (const [, info] of playlistWindows) {
    if (!info.window.isDestroyed()) {
      info.window.webContents.send('playlist:add-item', item);
      info.isDirty = true;
    }
  }
};

export const setWindowDirty = (windowId: string, isDirty: boolean): void => {
  const info = getPlaylistWindows().get(windowId);
  if (info) {
    info.isDirty = isDirty;
  }
};

export const syncToPlaylistWindow = (data: PlaylistSyncData): void => {
  const playlistWindows = getPlaylistWindows();
  const firstWindow = playlistWindows.values().next().value;
  if (firstWindow && !firstWindow.window.isDestroyed()) {
    firstWindow.window.webContents.send('playlist:sync', data);
  }
};

export const getWindowInfoBySender = (
  sender: Electron.WebContents,
): PlaylistWindowInfo | null => {
  const senderWindow = BrowserWindow.fromWebContents(sender);
  if (!senderWindow) return null;

  const playlistWindows = getPlaylistWindows();
  for (const [, info] of playlistWindows) {
    if (info.window === senderWindow) {
      return info;
    }
  }
  return null;
};

export const isSenderPlaylistWindow = (sender: Electron.WebContents): boolean => {
  const senderWindow = BrowserWindow.fromWebContents(sender);
  if (!senderWindow) return false;
  const playlistWindows = getPlaylistWindows();
  return Array.from(playlistWindows.values()).some(
    (info) => info.window === senderWindow,
  );
};
