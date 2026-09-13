import { getRendererUrl } from '../rendererUrl';
import { BrowserWindow, dialog } from 'electron';
import * as path from 'path';
import type {
  PlaylistItem,
} from '../../../src/types/playlist/core';
import type { PlaylistSyncData } from '../../../src/types/playlist/window';
import { PLAYLIST_WINDOW_CHANNELS } from '../../../src/types/ipc/playlistWindow';
import { applyWindowSecurity } from '../windowSecurity';
import {
  getMainWindowRef,
  getPlaylistWindows,
  type PlaylistWindowInfo,
} from './state';
import {
  createPackageSession,
  getPackageSessionForWindow,
  registerAuxiliaryWindow,
  unregisterAuxiliaryWindow,
  type PackageSession,
} from '../packageSessionRegistry';

const generateWindowId = (): string => {
  return `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

const resolveSession = (owner?: BrowserWindow | null): PackageSession | null => {
  const mainWindow = owner ?? getMainWindowRef();
  if (!mainWindow) return null;
  return getPackageSessionForWindow(mainWindow) ?? createPackageSession(mainWindow);
};

export const createPlaylistWindow = (
  filePath?: string,
  owner?: BrowserWindow | null,
): BrowserWindow => {
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

  const session = resolveSession(owner);
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

  const mainURL = getRendererUrl('/playlist');
  window.loadURL(mainURL);
  window.setMenuBarVisibility(false);

  playlistWindows.set(windowId, {
    window,
    filePath: filePath || null,
    isDirty: false,
    sessionId: session?.id ?? null,
    session,
  });
  if (session) registerAuxiliaryWindow(session, window);

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
      window.webContents.send(PLAYLIST_WINDOW_CHANNELS.requestSave);
      return;
    }

    if (choice.response === 1) {
      info.isDirty = false;
      window.destroy();
    }
  });

  window.on('closed', () => {
    playlistWindows.delete(windowId);
    if (session) unregisterAuxiliaryWindow(session, window);
    if (session && !session.mainWindow.isDestroyed()) {
      session.mainWindow.webContents.send(PLAYLIST_WINDOW_CHANNELS.windowClosed, windowId);
    }
  });

  return window;
};

export const sendPlaylistFileToWindow = (
  filePath: string,
  owner?: BrowserWindow | null,
): void => {
  const win = createPlaylistWindow(filePath, owner);
  const send = () =>
    win.webContents.send(PLAYLIST_WINDOW_CHANNELS.externalOpen, filePath);
  // New renderers request their document after subscribing in preload.
  if (!win.webContents.isLoading()) send();
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

export const closePlaylistWindowsForMainWindow = (owner: BrowserWindow): void => {
  const session = resolveSession(owner);
  if (!session) return;
  for (const info of getPlaylistWindows().values()) {
    if (info.sessionId === session.id && !info.window.isDestroyed()) info.window.close();
  }
};

export const closePlaylistWindow = (owner?: BrowserWindow | null): void => {
  const playlistWindows = getPlaylistWindows();
  const session = resolveSession(owner);
  const firstWindow = [...playlistWindows.values()].find(
    (info) => !session || info.sessionId === session.id,
  );
  if (firstWindow && !firstWindow.window.isDestroyed()) {
    firstWindow.window.close();
  }
};

export const isPlaylistWindowOpen = (owner?: BrowserWindow | null): boolean => {
  const playlistWindows = getPlaylistWindows();
  const session = resolveSession(owner);
  for (const [, info] of playlistWindows) {
    if (!info.window.isDestroyed() && (!session || info.sessionId === session.id)) {
      return true;
    }
  }
  return false;
};

export const getOpenWindowCount = (owner?: BrowserWindow | null): number => {
  const playlistWindows = getPlaylistWindows();
  const session = resolveSession(owner);
  let count = 0;
  for (const [, info] of playlistWindows) {
    if (!info.window.isDestroyed() && (!session || info.sessionId === session.id)) {
      count += 1;
    }
  }
  return count;
};

export const addItemToAllWindows = (item: PlaylistItem, owner?: BrowserWindow | null): void => {
  const playlistWindows = getPlaylistWindows();
  const session = resolveSession(owner);
  for (const [, info] of playlistWindows) {
    if (!info.window.isDestroyed() && (!session || info.sessionId === session.id)) {
      info.window.webContents.send(PLAYLIST_WINDOW_CHANNELS.addItem, item);
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

export const syncToPlaylistWindow = (data: PlaylistSyncData, owner?: BrowserWindow | null): void => {
  const playlistWindows = getPlaylistWindows();
  const session = resolveSession(owner);
  const firstWindow = [...playlistWindows.values()].find(
    (info) => !session || info.sessionId === session.id,
  );
  if (firstWindow && !firstWindow.window.isDestroyed()) {
    firstWindow.window.webContents.send(PLAYLIST_WINDOW_CHANNELS.sync, data);
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

export const setPlaylistWindowTitleForSender = (
  sender: Electron.WebContents,
  title: string,
): boolean => {
  const info = getWindowInfoBySender(sender);
  if (!info || info.window.isDestroyed()) {
    return false;
  }

  info.window.setTitle(title);
  return true;
};
