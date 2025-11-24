import { app, ipcMain } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { AppSettings } from '../../src/types/Settings';

/**
 * 設定ファイルのパスを取得
 */
const getSettingsPath = (): string => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'settings.json');
};

/**
 * デフォルト設定値（型情報は src/types/Settings.ts と同期が必要）
 */
const DEFAULT_SETTINGS: AppSettings = {
  themeMode: 'system',
  activePresetId: 'default',
  actionPresets: [],
  hotkeys: [
    { id: 'resync-audio', label: '音声同期を再実行', key: 'Command+Shift+S' },
    { id: 'reset-sync', label: '同期をリセット', key: 'Command+Shift+R' },
    { id: 'manual-sync', label: '今の位置で同期', key: 'Command+Shift+M' },
    {
      id: 'toggle-manual-mode',
      label: '手動モード切替',
      key: 'Command+Shift+T',
    },
    { id: 'analyze', label: '分析開始', key: 'Command+Shift+A' },
    { id: 'undo', label: '元に戻す', key: 'Command+Z' },
    { id: 'redo', label: 'やり直す', key: 'Command+Shift+Z' },
    { id: 'skip-forward-small', label: '0.5倍速再生', key: 'Right' },
    { id: 'skip-forward-medium', label: '2倍速再生', key: 'Shift+Right' },
    { id: 'skip-forward-large', label: '4倍速再生', key: 'Command+Right' },
    { id: 'skip-forward-xlarge', label: '6倍速再生', key: 'Option+Right' },
    { id: 'skip-backward-medium', label: '5秒戻し', key: 'Left' },
    { id: 'skip-backward-large', label: '10秒戻し', key: 'Shift+Left' },
    { id: 'play-pause', label: '再生/停止', key: 'Space' },
  ],
  language: 'ja',
};

/**
 * 有効なホットキーIDのセット
 */
const VALID_HOTKEY_IDS = new Set([
  'resync-audio',
  'reset-sync',
  'manual-sync',
  'toggle-manual-mode',
  'analyze',
  'undo',
  'redo',
  'skip-forward-small',
  'skip-forward-medium',
  'skip-forward-large',
  'skip-forward-xlarge',
  'skip-backward-medium',
  'skip-backward-large',
  'play-pause',
]);

/**
 * 設定を読み込む
 */
export const loadSettings = async (): Promise<AppSettings> => {
  const settingsPath = getSettingsPath();
  try {
    const data = await fs.readFile(settingsPath, 'utf-8');
    const parsed = JSON.parse(data) as Partial<AppSettings>;

    // デフォルト設定とマージして不足項目を補完
    const merged = { ...DEFAULT_SETTINGS, ...parsed };

    // 古い/無効なホットキーをフィルタリング
    if (merged.hotkeys && merged.hotkeys.length > 0) {
      merged.hotkeys = merged.hotkeys.filter((hotkey) =>
        VALID_HOTKEY_IDS.has(hotkey.id),
      );

      // フィルタリング後にホットキーが空の場合はデフォルトを使用
      if (merged.hotkeys.length === 0) {
        merged.hotkeys = DEFAULT_SETTINGS.hotkeys;
      }
    } else {
      merged.hotkeys = DEFAULT_SETTINGS.hotkeys;
    }

    return merged;
  } catch (error) {
    // ファイルが存在しない場合はデフォルト設定を保存して返す
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.info(
        'Settings file not found (first launch), creating with defaults',
      );
      // デフォルト設定を保存（非同期だが待たない）
      saveSettings(DEFAULT_SETTINGS).catch((saveError) => {
        console.error('Failed to save default settings:', saveError);
      });
    } else {
      // その他のエラー（パースエラー等）
      console.warn('Settings file invalid, using defaults:', error);
    }
    return DEFAULT_SETTINGS;
  }
};

/**
 * 設定を保存する
 */
export const saveSettings = async (settings: AppSettings): Promise<boolean> => {
  const settingsPath = getSettingsPath();
  try {
    // ディレクトリが存在しない場合は作成
    const dir = path.dirname(settingsPath);
    await fs.mkdir(dir, { recursive: true });

    const data = JSON.stringify(settings, null, 2);
    await fs.writeFile(settingsPath, data, 'utf-8');
    return true;
  } catch (error) {
    console.error('Failed to save settings:', error);
    return false;
  }
};

/**
 * IPCハンドラを登録
 */
export const registerSettingsHandlers = () => {
  ipcMain.handle('settings:load', async () => {
    return await loadSettings();
  });

  ipcMain.handle('settings:save', async (_event, settings: AppSettings) => {
    return await saveSettings(settings);
  });

  ipcMain.handle('settings:reset', async () => {
    // デフォルト設定に戻す
    await saveSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  });
};
