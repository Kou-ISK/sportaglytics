import { BrowserWindow, globalShortcut } from 'electron';
import type { HotkeyConfig } from '../../src/types/settings/coreTypes';
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
): void => {
  // 従来の挙動を残しつつ、プレイリスト用ホットキーだけグローバル登録
  if (!hotkeys || hotkeys.length === 0) return;
  const playlistKey =
    hotkeys.find((h) => h.id === 'openPlaylist')?.key || 'CmdOrCtrl+Shift+P';
  try {
    globalShortcut.register(playlistKey, () => {
      createPlaylistWindow(undefined, mainWindow);
    });
  } catch (e) {
    console.warn('Failed to register playlist hotkey', e);
  }
};
