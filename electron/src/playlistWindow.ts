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
  PlaylistItem,
} from '../../src/types/Playlist';

/**
 * プレイリストウィンドウ情報
 */
interface PlaylistWindowInfo {
  window: BrowserWindow;
  filePath: string | null; // 関連付けられている .stpl ファイルパス
  isDirty: boolean; // 未保存の変更があるか
}

// 複数ウィンドウを管理するMap（filePath -> WindowInfo）
const playlistWindows = new Map<string, PlaylistWindowInfo>();

let mainWindow: BrowserWindow | null = null;
let ffmpegPath: string | null = null;

/**
 * ユニークなウィンドウIDを生成（新規ウィンドウ用）
 */
function generateWindowId(): string {
  return `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

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
 * @param filePath 開く.stplファイルパス（未指定の場合は新規）
 */
export function createPlaylistWindow(filePath?: string): BrowserWindow {
  const windowId = filePath || generateWindowId();

  // 同じファイルパスのウィンドウが既に開いている場合はフォーカス
  if (playlistWindows.has(windowId)) {
    const info = playlistWindows.get(windowId)!;
    if (!info.window.isDestroyed()) {
      info.window.focus();
      return info.window;
    }
    // ウィンドウが破棄されていたら削除
    playlistWindows.delete(windowId);
  }

  // カスケード表示用のオフセット計算
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
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: false,
    },
  });

  // プレイリスト専用ルートをロード（Hash routing使用）
  const mainURL = `file:${path.join(__dirname, '../../index.html')}#/playlist`;
  window.loadURL(mainURL);

  // メニューバーを非表示
  window.setMenuBarVisibility(false);

  // ウィンドウ情報を保存
  playlistWindows.set(windowId, {
    window,
    filePath: filePath || null,
    isDirty: false,
  });

  // ウィンドウを閉じる際の確認処理
  window.on('close', async (e) => {
    const info = playlistWindows.get(windowId);
    if (!info) return;

    if (info.isDirty) {
      e.preventDefault();

      const choice = await dialog.showMessageBox(window, {
        type: 'question',
        buttons: ['保存', '保存しない', 'キャンセル'],
        defaultId: 0,
        cancelId: 2,
        title: '未保存の変更',
        message: 'プレイリストに未保存の変更があります',
        detail: '変更を保存しますか？',
      });

      if (choice.response === 0) {
        // 保存
        window.webContents.send('playlist:request-save');
        // 保存完了後にウィンドウを閉じる処理は、保存完了イベントで行う
        return;
      } else if (choice.response === 1) {
        // 保存しない - 強制的に閉じる
        info.isDirty = false;
        window.destroy();
      }
      // キャンセル - 何もしない
    }
  });

  // ウィンドウが閉じられたときの処理
  window.on('closed', () => {
    playlistWindows.delete(windowId);
    // メインウィンドウに通知
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('playlist:window-closed', windowId);
    }
  });

  // ウィンドウタイトル更新のハンドラー
  window.webContents.on('ipc-message', (_event, channel, title: string) => {
    if (channel === 'playlist:set-window-title') {
      window.setTitle(title);
    }
  });

  return window;
}

export function sendPlaylistFileToWindow(filePath: string): void {
  const win = createPlaylistWindow(filePath);
  const send = () => win.webContents.send('playlist:external-open', filePath);
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', send);
  } else {
    send();
  }
}

/**
 * 全てのプレイリストウィンドウを閉じる
 */
export function closeAllPlaylistWindows(): void {
  for (const [, info] of playlistWindows) {
    if (!info.window.isDestroyed()) {
      info.window.close();
    }
  }
  playlistWindows.clear();
}

/**
 * プレイリストウィンドウを閉じる（後方互換性のため残す）
 */
export function closePlaylistWindow(): void {
  // 最初のウィンドウを閉じる（レガシー互換性）
  const firstWindow = playlistWindows.values().next().value;
  if (firstWindow && !firstWindow.window.isDestroyed()) {
    firstWindow.window.close();
  }
}

/**
 * プレイリストウィンドウが開いているか確認
 */
export function isPlaylistWindowOpen(): boolean {
  for (const [, info] of playlistWindows) {
    if (!info.window.isDestroyed()) {
      return true;
    }
  }
  return false;
}

/**
 * 開いているプレイリストウィンドウの数を取得
 */
export function getOpenWindowCount(): number {
  let count = 0;
  for (const [, info] of playlistWindows) {
    if (!info.window.isDestroyed()) {
      count++;
    }
  }
  return count;
}

/**
 * 全てのプレイリストウィンドウにアイテムを追加
 */
export function addItemToAllWindows(item: PlaylistItem): void {
  for (const [, info] of playlistWindows) {
    if (!info.window.isDestroyed()) {
      info.window.webContents.send('playlist:add-item', item);
      info.isDirty = true; // 追加があったため変更フラグを立てる
    }
  }
}

/**
 * 特定のウィンドウのdirtyフラグを設定
 */
export function setWindowDirty(windowId: string, isDirty: boolean): void {
  const info = playlistWindows.get(windowId);
  if (info) {
    info.isDirty = isDirty;
  }
}

/**
 * プレイリストウィンドウへデータを送信（後方互換性のため残す）
 */
export function syncToPlaylistWindow(data: PlaylistSyncData): void {
  // 最初のウィンドウに送信（レガシー互換性）
  const firstWindow = playlistWindows.values().next().value;
  if (firstWindow && !firstWindow.window.isDestroyed()) {
    firstWindow.window.webContents.send('playlist:sync', data);
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
  ipcMain.handle('playlist:open-window', (_event, filePath?: string) => {
    createPlaylistWindow(filePath);
  });

  // プレイリストウィンドウを閉じる
  ipcMain.handle('playlist:close-window', () => {
    closePlaylistWindow();
  });

  // ウィンドウ状態確認
  ipcMain.handle('playlist:is-window-open', () => {
    return isPlaylistWindowOpen();
  });

  // 開いているウィンドウ数を取得
  ipcMain.handle('playlist:get-open-count', () => {
    return getOpenWindowCount();
  });

  // 全てのウィンドウにアイテムを追加
  ipcMain.handle(
    'playlist:add-item-to-all-windows',
    (_event, item: PlaylistItem) => {
      addItemToAllWindows(item);
    },
  );

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

  // isDirtyフラグを設定
  ipcMain.on('playlist:set-dirty', (event, isDirty: boolean) => {
    // 送信元のウィンドウを特定
    const sender = event.sender;
    for (const [windowId, info] of playlistWindows) {
      if (info.window.webContents === sender) {
        info.isDirty = isDirty;
        console.log(`[Playlist] Window ${windowId} isDirty set to:`, isDirty);
        break;
      }
    }
  });

  // 保存完了後にウィンドウを閉じる
  ipcMain.on('playlist:saved-and-close', (event) => {
    const sender = event.sender;
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

  // プレイリストファイルを保存（パッケージ形式）
  ipcMain.handle(
    'playlist:save-file',
    async (event, playlist: Playlist): Promise<string | null> => {
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
            const sender = event.sender;
            if (sender && !sender.isDestroyed()) {
              sender.send('playlist:save-progress', {
                current,
                total,
              });
            }
          };

          // アクション名をファイルシステム安全な文字列にサニタイズ
          const sanitizeForFilename = (name: string): string => {
            return name.replace(/[\/\\:*?"<>|]/g, '_').trim() || 'item';
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

                // ディレクトリ名: <アクション名>_<itemId>
                const sanitizedActionName = sanitizeForFilename(
                  item.actionName,
                );
                const dirName = `${sanitizedActionName}_${item.id}`;
                const angleNumber = isSecondary ? 2 : 1;
                const instanceDir = path.join(videosDir, dirName);
                await fs.mkdir(instanceDir, { recursive: true });
                const extname = path.extname(sourcePath);
                const newFileName = `angle${angleNumber}${extname}`;
                const destPath = path.join(instanceDir, newFileName);
                const relativePath = `./videos/${dirName}/${newFileName}`;

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

        // パッケージ形式: playlist.jsonを読み込み
        const playlistJsonPath = path.join(targetPath, 'playlist.json');

        // ファイル存在チェック
        if (!existsSync(playlistJsonPath)) {
          await dialog.showErrorBox(
            '読み込みエラー',
            `プレイリストファイルが見つかりません: ${playlistJsonPath}`,
          );
          return null;
        }

        const content = await fs.readFile(playlistJsonPath, 'utf-8');
        let playlist: Playlist;

        try {
          playlist = JSON.parse(content) as Playlist;
        } catch (parseError) {
          await dialog.showErrorBox(
            '読み込みエラー',
            'プレイリストファイルが破損しています。JSONの解析に失敗しました。',
          );
          return null;
        }

        // 必須フィールドの検証
        if (
          !playlist.id ||
          !playlist.name ||
          !playlist.type ||
          !Array.isArray(playlist.items)
        ) {
          await dialog.showErrorBox(
            '読み込みエラー',
            'プレイリストファイルの形式が不正です。必須フィールドが欠落しています。',
          );
          return null;
        }

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
              const resolved = path.join(targetPath, relativePath);
              if (!existsSync(resolved)) {
                console.warn(`[Playlist] Video file not found: ${resolved}`);
                return undefined;
              }
              return resolved;
            }

            // 絶対パスの場合はそのまま（参照形式）
            if (path.isAbsolute(videoPath)) {
              if (!existsSync(videoPath)) {
                console.warn(
                  `[Playlist] Referenced video not found: ${videoPath}`,
                );
                return undefined;
              }
              return videoPath;
            }

            // その他の相対パスはパッケージ基準で解決
            const resolved = path.join(targetPath, videoPath);
            return existsSync(resolved) ? resolved : undefined;
          };

          return {
            ...item,
            videoSource: resolvePackageVideoPath(item.videoSource),
            videoSource2: resolvePackageVideoPath(item.videoSource2),
          };
        });

        const resolvedPlaylist = { ...playlist, items: resolvedItems };

        console.log('[Playlist] Loaded from:', targetPath);

        // 既存のプレイリストウィンドウから呼ばれた場合は新しいウィンドウを作らない
        // メインウィンドウや他の場所から呼ばれた場合のみ新しいウィンドウを作成
        const senderWindow = BrowserWindow.fromWebContents(event.sender);
        const isFromPlaylistWindow =
          senderWindow &&
          Array.from(playlistWindows.values()).some(
            (info) => info.window === senderWindow,
          );

        if (!isFromPlaylistWindow) {
          // プレイリストウィンドウ以外から呼ばれた場合は新しいウィンドウを作成
          createPlaylistWindow(targetPath);
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
}
