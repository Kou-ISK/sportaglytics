/**
 * プレイリストウィンドウ管理モジュール
 */
import { BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
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

export function sendPlaylistFileToWindow(filePath: string): void {
  const win = createPlaylistWindow();
  const send = () => win.webContents.send('playlist:external-open', filePath);
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', send);
  } else {
    send();
  }
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
  const findPackageRoot = (startDir: string): string | null => {
    let current = startDir;
    while (true) {
      const meta = path.join(current, '.metadata', 'config.json');
      if (existsSync(meta)) return current;
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
    return null;
  };

  const resolveVideoPath = (
    original: string | undefined,
    playlistPath?: string,
    sourcePackagePath?: string,
  ): string | undefined => {
    if (!original) return undefined;
    if (existsSync(original)) return original;

    const baseDir = playlistPath ? path.dirname(playlistPath) : null;
    let candidatePkg: string | null = null;
    if (sourcePackagePath && existsSync(sourcePackagePath)) {
      candidatePkg = sourcePackagePath;
    } else if (sourcePackagePath && baseDir) {
      const sibling = path.join(baseDir, path.basename(sourcePackagePath));
      if (existsSync(sibling)) candidatePkg = sibling;
    }
    if (!candidatePkg && baseDir) {
      candidatePkg = findPackageRoot(baseDir);
    }

    if (candidatePkg && sourcePackagePath) {
      const rel = path.relative(sourcePackagePath, original);
      if (rel && !rel.startsWith('..')) {
        const joined = path.join(candidatePkg, rel);
        if (existsSync(joined)) return joined;
      }
    }

    if (candidatePkg) {
      const byName = path.join(candidatePkg, path.basename(original));
      if (existsSync(byName)) return byName;
    }

    if (baseDir) {
      const baseName = path.join(baseDir, path.basename(original));
      if (existsSync(baseName)) return baseName;
    }

    return original;
  };

  ipcMain.handle(
    'playlist:load-file',
    async (
      _event,
      givenPath?: string,
    ): Promise<{ playlist: Playlist; filePath: string } | null> => {
      try {
        let targetPath = givenPath;
        if (!targetPath) {
          const { filePaths } = await dialog.showOpenDialog({
            title: 'プレイリストを開く',
            filters: [
              { name: 'SporTagLytics Playlist', extensions: ['stpl'] },
              { name: 'JSON', extensions: ['json'] },
            ],
            properties: ['openFile'],
          });
          if (filePaths.length === 0) return null;
          targetPath = filePaths[0];
        }
        if (!targetPath) return null;

        const content = await fs.readFile(targetPath, 'utf-8');
        const playlist = JSON.parse(content) as Playlist;

        const resolvedPkg =
          (playlist.sourcePackagePath && existsSync(playlist.sourcePackagePath)
            ? playlist.sourcePackagePath
            : null) ||
          (targetPath ? findPackageRoot(path.dirname(targetPath)) : null);

        const resolvedItems = playlist.items.map((item) => {
          const videoSource = resolveVideoPath(
            item.videoSource,
            targetPath,
            playlist.sourcePackagePath,
          );
          const videoSource2 = resolveVideoPath(
            item.videoSource2,
            targetPath,
            playlist.sourcePackagePath,
          );
          return { ...item, videoSource, videoSource2 };
        });

        const resolvedPlaylist: Playlist = {
          ...playlist,
          items: resolvedItems,
          sourcePackagePath: resolvedPkg ?? playlist.sourcePackagePath,
        };

        console.log('[Playlist] Loaded from:', targetPath);
        return { playlist: resolvedPlaylist, filePath: targetPath };
      } catch (error) {
        console.error('[Playlist] Load error:', error);
        return null;
      }
    },
  );
}
