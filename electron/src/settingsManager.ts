import { app, ipcMain, BrowserWindow } from 'electron';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  // normalizeはデフォルトレイアウトを最新にするために利用
} from '../../src/types/Settings';
import { normalizeCodingPanelLayouts } from '../../src/types/Settings';

const buildCodingPanel = (
  loadedPanel?: AppSettings['codingPanel'] | null,
): NonNullable<AppSettings['codingPanel']> => {
  const defaultCodingPanel =
    DEFAULT_SETTINGS.codingPanel ?? ({
      defaultMode: 'code',
      toolbars: [],
      actionLinks: [],
      codeWindows: [],
    } as NonNullable<AppSettings['codingPanel']>);

  const panel: Partial<NonNullable<AppSettings['codingPanel']>> =
    loadedPanel ?? {};

  const codeWindows =
    (panel as any).codeWindows && (panel as any).codeWindows.length > 0
      ? (panel as any).codeWindows
      : (panel as any).layouts && (panel as any).layouts.length > 0
        ? (panel as any).layouts
        : defaultCodingPanel.codeWindows ?? [];
  const activeCodeWindowId =
    (panel as any).activeCodeWindowId ??
    (panel as any).activeLayoutId ??
    defaultCodingPanel.activeCodeWindowId ??
    codeWindows[0]?.id;

  return {
    ...defaultCodingPanel,
    ...panel,
    defaultMode: panel.defaultMode ?? defaultCodingPanel.defaultMode ?? 'code',
    toolbars:
      panel.toolbars?.filter((t) => t.mode === 'code' || t.mode === 'label') ??
      defaultCodingPanel.toolbars ??
      [],
    actionLinks: panel.actionLinks ?? defaultCodingPanel.actionLinks ?? [],
    codeWindows,
    activeCodeWindowId,
  };
};

/**
 * 設定ファイルのパスを取得
 */
const getSettingsPath = (): string => {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, 'settings.json');
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
  const merged: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...parsed,
    overlayClip: {
      ...DEFAULT_SETTINGS.overlayClip,
      ...(parsed.overlayClip ?? {}),
    },
    codingPanel: normalizeCodingPanelLayouts(
      buildCodingPanel(parsed.codingPanel),
    ),
  };

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
    const ok = await saveSettings(settings);
    if (ok) {
      // 設定変更を他ウィンドウへ通知（コードウィンドウ切替など）
      BrowserWindow.getAllWindows().forEach((win) => {
        if (!win.isDestroyed()) {
          win.webContents.send('settings:updated', settings);
        }
      });
    }
    return ok;
  });

  ipcMain.handle('settings:reset', async () => {
    // デフォルト設定に戻す
    await saveSettings(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  });
};
