/**
 * プレイリストウィンドウ管理モジュール
 */
import { BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import type {
  PlaylistSyncData,
  PlaylistCommand,
  Playlist,
} from '../../src/types/Playlist';

let playlistWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;

/**
 * メインウィンドウの参照を設定
 */
export function setMainWindowRef(win: BrowserWindow): void {
  mainWindow = win;
}

/**
 * プレイリストウィンドウを作成・表示
 */
export function createPlaylistWindow(): BrowserWindow {
  if (playlistWindow && !playlistWindow.isDestroyed()) {
    playlistWindow.focus();
    return playlistWindow;
  }

  playlistWindow = new BrowserWindow({
    width: 450,
    height: 700,
    minWidth: 350,
    minHeight: 400,
    title: 'プレイリスト',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
    // メインウィンドウの子ウィンドウとして設定（任意）
    // parent: mainWindow ?? undefined,
  });

  // プレイリスト専用ルートをロード（Hash routing使用）
  const mainURL = `file:${path.join(__dirname, '../../index.html')}#/playlist`;
  playlistWindow.loadURL(mainURL);

  // メニューバーを非表示（シンプルなウィンドウ）
  playlistWindow.setMenuBarVisibility(false);

  // ウィンドウが閉じられたときの処理
  playlistWindow.on('closed', () => {
    playlistWindow = null;
    // メインウィンドウに通知
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('playlist:window-closed');
    }
  });

  return playlistWindow;
}

/**
 * プレイリストウィンドウを閉じる
 */
export function closePlaylistWindow(): void {
  if (playlistWindow && !playlistWindow.isDestroyed()) {
    playlistWindow.close();
    playlistWindow = null;
  }
}

/**
 * プレイリストウィンドウが開いているか確認
 */
export function isPlaylistWindowOpen(): boolean {
  return playlistWindow !== null && !playlistWindow.isDestroyed();
}

/**
 * プレイリストウィンドウへデータを送信
 */
export function syncToPlaylistWindow(data: PlaylistSyncData): void {
  if (playlistWindow && !playlistWindow.isDestroyed()) {
    playlistWindow.webContents.send('playlist:sync', data);
  }
}

/**
 * IPCハンドラーを登録
 */
export function registerPlaylistHandlers(): void {
  // プレイリストウィンドウを開く
  ipcMain.handle('playlist:open-window', () => {
    createPlaylistWindow();
  });

  // プレイリストウィンドウを閉じる
  ipcMain.handle('playlist:close-window', () => {
    closePlaylistWindow();
  });

  // ウィンドウ状態確認
  ipcMain.handle('playlist:is-window-open', () => {
    return isPlaylistWindowOpen();
  });

  // メインウィンドウからプレイリストウィンドウへの同期
  ipcMain.on('playlist:sync-to-window', (_event, data: PlaylistSyncData) => {
    syncToPlaylistWindow(data);
  });

  // プレイリストウィンドウからメインウィンドウへのコマンド
  ipcMain.on('playlist:command', (_event, command: PlaylistCommand) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('playlist:command', command);
    }
  });

  // プレイリストファイルを保存（スタンドアロン形式）
  ipcMain.handle(
    'playlist:save-file',
    async (_event, playlist: Playlist): Promise<string | null> => {
      try {
        const { filePath } = await dialog.showSaveDialog({
          title: 'プレイリストを保存',
          defaultPath: `${playlist.name || 'playlist'}.stpl`,
          filters: [
            { name: 'SporTagLytics Playlist', extensions: ['stpl'] },
            { name: 'JSON', extensions: ['json'] },
          ],
        });

        if (!filePath) return null;

        // JSONとして保存
        const content = JSON.stringify(playlist, null, 2);
        await fs.writeFile(filePath, content, 'utf-8');
        console.log('[Playlist] Saved to:', filePath);
        return filePath;
      } catch (error) {
        console.error('[Playlist] Save error:', error);
        return null;
      }
    },
  );

  // プレイリストファイルを読み込み
  ipcMain.handle('playlist:load-file', async (): Promise<Playlist | null> => {
    try {
      const { filePaths } = await dialog.showOpenDialog({
        title: 'プレイリストを開く',
        filters: [
          { name: 'SporTagLytics Playlist', extensions: ['stpl'] },
          { name: 'JSON', extensions: ['json'] },
        ],
        properties: ['openFile'],
      });

      if (filePaths.length === 0) return null;

      const content = await fs.readFile(filePaths[0], 'utf-8');
      const playlist = JSON.parse(content) as Playlist;
      console.log('[Playlist] Loaded from:', filePaths[0]);
      return playlist;
    } catch (error) {
      console.error('[Playlist] Load error:', error);
      return null;
    }
  });
}
