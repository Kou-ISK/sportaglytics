import { BrowserWindow } from 'electron';
import type { HotkeyConfig } from '../../src/types/Settings';

/**
 * ホットキーを登録
 * Note: Electron 31では、ウィンドウフォーカス時のみ有効なローカルショートカットを
 * 実装するため、renderer側でkeydownイベントをリッスンする方式に変更しました。
 * このファイルは後方互換性のために残していますが、実際の処理はrenderer側で行われます。
 */
export const registerShortcuts = (
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  mainWindow: BrowserWindow,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  hotkeys: HotkeyConfig[],
) => {
  // globalShortcutは使用しない（他のアプリを妨害するため）
  // 代わりにrenderer側でkeydownイベントをリッスンする
  console.log('Shortcuts are handled by renderer process');
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
