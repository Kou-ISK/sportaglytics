/**
 * プレイリストウィンドウ管理モジュール
 */
import { BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import { spawn } from 'child_process';
import type {
  PlaylistSyncData,
  PlaylistCommand,
  Playlist,
} from '../../src/types/Playlist';

let playlistWindow: BrowserWindow | null = null;
let mainWindow: BrowserWindow | null = null;
let ffmpegPath: string | null = null;

/**
 * メインウィンドウの参照を設定
 */
export function setMainWindowRef(win: BrowserWindow): void {
  mainWindow = win;
}

/**
 * FFmpegパスを設定
 */
export function setFfmpegPath(path: string): void {
  ffmpegPath = path;
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
 * FFmpegで動画の指定区間を切り出す
 * @param sourcePath 元動画ファイルパス
 * @param destPath 出力先ファイルパス
 * @param startTime 開始時間（秒）
 * @param endTime 終了時間（秒）
 */
const extractVideoSegment = async (
  sourcePath: string,
  destPath: string,
  startTime: number,
  endTime: number,
): Promise<void> => {
  if (!ffmpegPath) {
    throw new Error('FFmpeg path not set');
  }

  const duration = endTime - startTime;

  const args = [
    '-i',
    sourcePath,
    '-ss',
    startTime.toString(),
    '-t',
    duration.toString(),
    '-c',
    'copy', // 再エンコードなし（高速）
    '-avoid_negative_ts',
    'make_zero',
    '-y', // 上書き許可
    destPath,
  ];

  return new Promise((resolve, reject) => {
    const process = spawn(ffmpegPath!, args);

    let stderrData = '';
    process.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        console.error('[FFmpeg] Error output:', stderrData);
        reject(new Error(`FFmpeg exited with code ${code}`));
      }
    });

    process.on('error', (err) => {
      reject(err);
    });
  });
};

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

  // プレイリストファイルを保存（パッケージ形式）
  ipcMain.handle(
    'playlist:save-file',
    async (_event, playlist: Playlist): Promise<string | null> => {
      try {
        const { filePath } = await dialog.showSaveDialog({
          title: 'プレイリストを保存',
          defaultPath: `${playlist.name || 'playlist'}.stpl`,
          filters: [{ name: 'SporTagLytics Playlist', extensions: ['stpl'] }],
        });

        if (!filePath) return null;

        // .stplパッケージディレクトリを作成
        await fs.mkdir(filePath, { recursive: true });

        // スタンドアロン形式の場合は動画ファイルをコピー
        if (playlist.type === 'embedded') {
          const videosDir = path.join(filePath, 'videos');
          await fs.mkdir(videosDir, { recursive: true });

          // 動画ファイルのコピーとパス書き換え
          const copiedVideos = new Map<string, string>(); // キャッシュキー → 新パス
          const totalItems = playlist.items.length;
          let processedCount = 0;

          // 進行状況をウィンドウに通知
          const sendProgress = (current: number, total: number) => {
            if (playlistWindow && !playlistWindow.isDestroyed()) {
              playlistWindow.webContents.send('playlist:save-progress', {
                current,
                total,
              });
            }
          };

          const processedItems = await Promise.all(
            playlist.items.map(async (item) => {
              const processVideo = async (
                sourcePath: string | undefined,
                isSecondary: boolean = false,
              ): Promise<string | undefined> => {
                if (!sourcePath || !existsSync(sourcePath)) return sourcePath;

                // キャッシュキー: パス + タイムスタンプで一意に識別
                const cacheKey = `${sourcePath}_${item.startTime}_${item.endTime}`;
                if (copiedVideos.has(cacheKey)) {
                  return copiedVideos.get(cacheKey);
                }

                // ファイル名: item_{itemId}_{primary|secondary}.mp4
                const suffix = isSecondary ? 'secondary' : 'primary';
                const extname = path.extname(sourcePath);
                const newFileName = `item_${item.id}_${suffix}${extname}`;
                const destPath = path.join(videosDir, newFileName);
                const relativePath = `./videos/${newFileName}`;

                // FFmpegで区間を切り出し
                await extractVideoSegment(
                  sourcePath,
                  destPath,
                  item.startTime,
                  item.endTime,
                );

                copiedVideos.set(cacheKey, relativePath);
                return relativePath;
              };

              const newVideoSource = await processVideo(
                item.videoSource,
                false,
              );
              const newVideoSource2 = await processVideo(
                item.videoSource2,
                true,
              );

              // 進行状況を更新
              processedCount++;
              sendProgress(processedCount, totalItems);

              // 切り出した動画は0秒から始まるので、startTimeとendTimeを調整
              const duration = item.endTime - item.startTime;
              return {
                ...item,
                videoSource: newVideoSource,
                videoSource2: newVideoSource2,
                startTime: 0,
                endTime: duration,
              };
            }),
          );

          playlist = { ...playlist, items: processedItems };
        }

        // playlist.jsonを保存
        const playlistJsonPath = path.join(filePath, 'playlist.json');
        const content = JSON.stringify(playlist, null, 2);
        await fs.writeFile(playlistJsonPath, content, 'utf-8');

        console.log('[Playlist] Saved package to:', filePath);

        // 完了ダイアログを表示
        await dialog.showMessageBox({
          type: 'info',
          title: '保存完了',
          message: 'プレイリストを保存しました',
          detail: `保存先: ${filePath}`,
          buttons: ['OK'],
        });

        return filePath;
      } catch (error) {
        console.error('[Playlist] Save error:', error);

        // エラーダイアログを表示
        await dialog.showMessageBox({
          type: 'error',
          title: '保存エラー',
          message: 'プレイリストの保存に失敗しました',
          detail: error instanceof Error ? error.message : String(error),
          buttons: ['OK'],
        });

        // エラー時は作成途中のパッケージを削除
        try {
          if (error && typeof error === 'object' && 'code' in error) {
            const filePath = (error as { filePath?: string }).filePath;
            if (filePath && existsSync(filePath)) {
              await fs.rm(filePath, { recursive: true, force: true });
            }
          }
        } catch (cleanupError) {
          console.error('[Playlist] Cleanup error:', cleanupError);
        }
        return null;
      }
    },
  );

  // プレイリストファイルを読み込み
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
            filters: [{ name: 'SporTagLytics Playlist', extensions: ['stpl'] }],
            properties: ['openFile', 'openDirectory'],
          });
          if (filePaths.length === 0) return null;
          targetPath = filePaths[0];
        }
        if (!targetPath) return null;

        // パッケージ形式: playlist.jsonを読み込み
        const playlistJsonPath = path.join(targetPath, 'playlist.json');
        const content = await fs.readFile(playlistJsonPath, 'utf-8');
        const playlist = JSON.parse(content) as Playlist;

        // パス解決処理
        const resolvedItems = playlist.items.map((item) => {
          const resolvePackageVideoPath = (
            videoPath: string | undefined,
          ): string | undefined => {
            if (!videoPath) return undefined;

            // 相対パス（./videos/ または videos/）の場合はパッケージ内を参照
            if (
              videoPath.startsWith('./videos/') ||
              videoPath.startsWith('videos/')
            ) {
              const relativePath = videoPath.replace(/^\.?\//, '');
              return path.join(targetPath, relativePath);
            }

            // 絶対パスの場合はそのまま（参照形式）
            if (path.isAbsolute(videoPath)) {
              return existsSync(videoPath) ? videoPath : undefined;
            }

            // その他の相対パスはパッケージ基準で解決
            const resolved = path.join(targetPath, videoPath);
            return existsSync(resolved) ? resolved : videoPath;
          };

          return {
            ...item,
            videoSource: resolvePackageVideoPath(item.videoSource),
            videoSource2: resolvePackageVideoPath(item.videoSource2),
          };
        });

        const resolvedPlaylist = { ...playlist, items: resolvedItems };

        console.log('[Playlist] Loaded from:', targetPath);
        return { playlist: resolvedPlaylist, filePath: targetPath };
      } catch (error) {
        console.error('[Playlist] Load error:', error);
        return null;
      }
    },
  );
}
