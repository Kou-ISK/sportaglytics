import { BrowserWindow, globalShortcut } from 'electron';
import type { HotkeyConfig } from '../../src/types/Settings';
import { createPlaylistWindow } from './playlistWindow';

/**
 * ホットキーを登録
 * Note: Electron 31では、ウィンドウフォーカス時のみ有効なローカルショートカットを
 * 実装するため、renderer側でkeydownイベントをリッスンする方式に変更しました。
 * このファイルは後方互換性のために残していますが、実際の処理はrenderer側で行われます。
 */
export const registerShortcuts = (
  mainWindow: BrowserWindow,
  hotkeys: HotkeyConfig[],
) => {
  // 従来の挙動を残しつつ、プレイリスト用ホットキーだけグローバル登録
  if (!hotkeys || hotkeys.length === 0) return;
  const playlistKey =
    hotkeys.find((h) => h.id === 'openPlaylist')?.key || 'CmdOrCtrl+Shift+P';
  try {
    globalShortcut.register(playlistKey, () => {
      createPlaylistWindow();
    });
  } catch (e) {
    console.warn('Failed to register playlist hotkey', e);
  }
};

/**
 * 後方互換性のため残す（deprecated）
 */
export const shortCutKeys = (mainWindow: BrowserWindow) => {
  const defaultHotkeys: HotkeyConfig[] = [
    { id: 'skip-forward-small', label: '0.5倍速再生', key: 'Right' },
    { id: 'skip-forward-medium', label: '2倍速再生', key: 'Shift+Right' },
    { id: 'skip-forward-large', label: '4倍速再生', key: 'Command+Right' },
    { id: 'skip-forward-xlarge', label: '6倍速再生', key: 'Option+Right' },
    { id: 'play-pause', label: '再生/停止', key: 'Space' },
    { id: 'skip-backward-medium', label: '5秒戻し', key: 'Left' },
    { id: 'skip-backward-large', label: '10秒戻し', key: 'Shift+Left' },
    { id: 'analyze', label: '分析開始', key: 'Command+Shift+A' },
    { id: 'undo', label: '元に戻す', key: 'Command+Z' },
    { id: 'redo', label: 'やり直す', key: 'Command+Shift+Z' },
    { id: 'openPlaylist', label: 'プレイリストを開く', key: 'Command+Shift+P' },
  ];

  registerShortcuts(mainWindow, defaultHotkeys);
};
