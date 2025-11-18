import { BrowserWindow, globalShortcut } from 'electron';
import type { HotkeyConfig } from '../../src/types/Settings';

/**
 * ホットキーIDとイベントハンドラーのマッピング
 */
const hotkeyHandlers: Record<string, (mainWindow: BrowserWindow) => void> = {
  'skip-forward-small': (mainWindow) =>
    mainWindow.webContents.send('video-shortcut-event', 0.5),
  'skip-forward-medium': (mainWindow) =>
    mainWindow.webContents.send('video-shortcut-event', 2),
  'skip-forward-large': (mainWindow) =>
    mainWindow.webContents.send('video-shortcut-event', 4),
  'skip-forward-xlarge': (mainWindow) =>
    mainWindow.webContents.send('video-shortcut-event', 6),
  'play-pause': (mainWindow) =>
    mainWindow.webContents.send('video-shortcut-event', 1),
  'skip-backward-medium': (mainWindow) =>
    mainWindow.webContents.send('video-shortcut-event', -5),
  'skip-backward-large': (mainWindow) =>
    mainWindow.webContents.send('video-shortcut-event', -10),
  analyze: (mainWindow) =>
    mainWindow.webContents.send('general-shortcut-event', 'analyze'),
  undo: (mainWindow) => mainWindow.webContents.send('timeline-undo'),
  redo: (mainWindow) => mainWindow.webContents.send('timeline-redo'),
  'resync-audio': (mainWindow) =>
    mainWindow.webContents.send('sync-shortcut-event', 'resync'),
  'reset-sync': (mainWindow) =>
    mainWindow.webContents.send('sync-shortcut-event', 'reset'),
  'manual-sync': (mainWindow) =>
    mainWindow.webContents.send('sync-shortcut-event', 'manual'),
  'toggle-manual-mode': (mainWindow) =>
    mainWindow.webContents.send('sync-shortcut-event', 'toggle-manual'),
};

/**
 * ホットキーを登録
 */
export const registerShortcuts = (
  mainWindow: BrowserWindow,
  hotkeys: HotkeyConfig[],
) => {
  // 既存のショートカットをすべて解除
  globalShortcut.unregisterAll();

  // 各ホットキーを登録
  for (const hotkey of hotkeys) {
    const handler = hotkeyHandlers[hotkey.id];
    if (!handler) {
      console.warn(`Unknown hotkey ID: ${hotkey.id}`);
      continue;
    }

    try {
      const success = globalShortcut.register(hotkey.key, () => {
        // アプリにフォーカスがある時のみホットキーを発動
        if (mainWindow.isFocused()) {
          handler(mainWindow);
        }
      });

      if (!success) {
        console.error(`Failed to register shortcut: ${hotkey.key}`);
      }
    } catch (error) {
      console.error(`Error registering shortcut ${hotkey.key}:`, error);
    }
  }
};

/**
 * 後方互換性のため残す（deprecated）
 */
export const shortCutKeys = (mainWindow: BrowserWindow) => {
  const defaultHotkeys: HotkeyConfig[] = [
    { id: 'skip-forward-small', label: '0.5秒進む', key: 'Right' },
    { id: 'skip-forward-medium', label: '2秒進む', key: 'Shift+Right' },
    { id: 'skip-forward-large', label: '4秒進む', key: 'Command+Right' },
    { id: 'skip-forward-xlarge', label: '6秒進む', key: 'Option+Right' },
    { id: 'play-pause', label: '再生/一時停止', key: 'Up' },
    { id: 'skip-backward-medium', label: '5秒戻る', key: 'Left' },
    { id: 'skip-backward-large', label: '10秒戻る', key: 'Shift+Left' },
    { id: 'analyze', label: '分析開始', key: 'Command+Shift+A' },
    { id: 'undo', label: '元に戻す', key: 'Command+Z' },
    { id: 'redo', label: 'やり直す', key: 'Command+Shift+Z' },
  ];

  registerShortcuts(mainWindow, defaultHotkeys);
};
