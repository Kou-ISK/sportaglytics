import { getRendererUrl } from '../rendererUrl';
import { BrowserWindow, dialog } from 'electron';
import * as path from 'path';
import type { PlaylistItem } from '../../../src/types/playlist/core';
import type { PlaylistSyncData } from '../../../src/types/playlist/window';
import { PLAYLIST_WINDOW_CHANNELS } from '../../../src/types/ipc/playlistWindow';
import { applyWindowSecurity } from '../windowSecurity';
import {
  cancelPlaylistDocumentLoad,
  playlistDocumentRevision,
} from './documentLoad';
import {
  getMainWindowRef,
  getPlaylistWindows,
  type PlaylistDelivery,
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

const resolveSession = (
  owner?: BrowserWindow | null,
): PackageSession | null => {
  const mainWindow = owner ?? getMainWindowRef();
  if (!mainWindow || mainWindow.isDestroyed()) return null;
  return (
    getPackageSessionForWindow(mainWindow) ?? createPackageSession(mainWindow)
  );
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

  const info: PlaylistWindowInfo = {
    window,
    filePath: null,
    initialFilePath: filePath,
    isDirty: false,
    sessionId: session?.id ?? null,
    session,
    rendererReady: false,
    pendingDeliveries: [],
  };
  playlistWindows.set(windowId, info);
  window.webContents.on('did-start-loading', () => {
    info.rendererReady = false;
    cancelPlaylistDocumentLoad(info);
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
    cancelPlaylistDocumentLoad(info);
    playlistWindows.delete(windowId);
    if (session) unregisterAuxiliaryWindow(session, window);
    if (session && !session.mainWindow.isDestroyed()) {
      session.mainWindow.webContents.send(
        PLAYLIST_WINDOW_CHANNELS.windowClosed,
        windowId,
      );
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

export const closePlaylistWindowsForMainWindow = (
  owner: BrowserWindow,
): void => {
  const session = resolveSession(owner);
  if (!session) return;
  for (const info of getPlaylistWindows().values()) {
    if (info.sessionId === session.id && !info.window.isDestroyed())
      info.window.close();
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
    if (
      !info.window.isDestroyed() &&
      (!session || info.sessionId === session.id)
    ) {
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
    if (
      !info.window.isDestroyed() &&
      (!session || info.sessionId === session.id)
    ) {
      count += 1;
    }
  }
  return count;
};

const destinationLabel = (info: PlaylistWindowInfo): string => {
  const file = info.filePath ?? info.initialFilePath;
  return file
    ? `${path.basename(file, '.stpl')}（${path.basename(path.dirname(file))}）`
    : info.window.getTitle();
};

const pendingDestinationPick = new WeakSet<BrowserWindow>();

export const deliverItemsToPlaylistWindow = async (
  items: PlaylistItem[],
  owner: BrowserWindow,
): Promise<boolean> => {
  const session = getPackageSessionForWindow(owner);
  if (!session || !items.length || pendingDestinationPick.has(owner)) {
    return false;
  }

  const windows = getPlaylistWindows();
  const candidates = () =>
    [...windows.values()].filter(
      (info) => info.sessionId === session.id && !info.window.isDestroyed(),
    );
  let targets = candidates();
  if (!targets.length) {
    createPlaylistWindow(undefined, owner);
    targets = candidates();
  }
  if (!targets.length) return false;

  let target = targets[0];
  if (targets.length > 1) {
    const packagePath = session.packagePath;
    const choices = targets.map((info) => ({
      info,
      file: info.filePath,
      revision: playlistDocumentRevision(info),
    }));
    pendingDestinationPick.add(owner);
    try {
      const { response } = await dialog.showMessageBox(owner, {
        type: 'question',
        title: 'プレイリストに追加',
        message: `${items.length} 件を追加するプレイリストを選択`,
        buttons: [
          'キャンセル',
          ...targets.map(
            (info, index) => `${index + 1}. ${destinationLabel(info)}`,
          ),
        ],
        cancelId: 0,
        defaultId: 0,
        noLink: true,
        normalizeAccessKeys: false,
      });
      const selected = choices[response - 1];
      if (!selected) return false;

      // Do not silently switch to another window if the chosen document has
      // closed, been replaced, or the submitting window changed package.
      if (
        owner.isDestroyed() ||
        getPackageSessionForWindow(owner) !== session ||
        session.packagePath !== packagePath ||
        !candidates().includes(selected.info) ||
        selected.info.filePath !== selected.file ||
        playlistDocumentRevision(selected.info) !== selected.revision
      ) {
        if (!owner.isDestroyed()) {
          await dialog.showMessageBox(owner, {
            type: 'info',
            message:
              '追加先が変更されたため、プレイリストには追加されませんでした。',
            detail: '追加先を開いた状態で、もう一度追加してください。',
          });
        }
        return false;
      }
      target = selected.info;
    } finally {
      pendingDestinationPick.delete(owner);
    }
  }

  target.isDirty = true;
  for (const item of items) {
    deliverToPlaylistWindow(target, { type: 'add-item', item });
  }
  return true;
};

export const setWindowDirty = (windowId: string, isDirty: boolean): void => {
  const info = getPlaylistWindows().get(windowId);
  if (info) {
    info.isDirty = isDirty;
  }
};

export const syncToPlaylistWindow = (
  data: PlaylistSyncData,
  owner?: BrowserWindow | null,
): void => {
  const playlistWindows = getPlaylistWindows();
  const session = resolveSession(owner);
  const firstWindow = [...playlistWindows.values()].find(
    (info) => !session || info.sessionId === session.id,
  );
  if (firstWindow && !firstWindow.window.isDestroyed()) {
    deliverToPlaylistWindow(firstWindow, { type: 'sync', data });
  }
};

const deliverToPlaylistWindow = (
  info: PlaylistWindowInfo,
  delivery: PlaylistDelivery,
): void => {
  if (!info.rendererReady) {
    info.pendingDeliveries.push(delivery);
    return;
  }
  if (delivery.type === 'add-item') {
    info.window.webContents.send(
      PLAYLIST_WINDOW_CHANNELS.addItem,
      delivery.item,
    );
  } else {
    info.window.webContents.send(PLAYLIST_WINDOW_CHANNELS.sync, delivery.data);
  }
};

/** request-sync is sent only after the renderer registers every item/sync listener. */
export const markPlaylistRendererReady = (
  sender: Electron.WebContents,
): void => {
  const info = getWindowInfoBySender(sender);
  if (!info || info.window.isDestroyed()) return;
  info.rendererReady = true;
  for (const delivery of info.pendingDeliveries.splice(0)) {
    deliverToPlaylistWindow(info, delivery);
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

export const isSenderPlaylistWindow = (
  sender: Electron.WebContents,
): boolean => {
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
