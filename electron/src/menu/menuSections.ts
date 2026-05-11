import { app, BrowserWindow } from 'electron';
import { createPlaylistWindow } from '../playlistWindow';
import { openAnalysisWindow } from '../analysisWindow';
import { openHelpWindow } from '../helpWindow';
import { openSettingsWindow } from '../settingsWindow';
import { buildRecentPackageItems } from './recentPackageMenu';
import { openVersionInfoWindow, sendToFocusedWindow } from './menuWindowActions';

export const buildAppMenuItems = (
  isMac: boolean,
): Electron.MenuItemConstructorOptions[] => [
  ...(isMac
    ? [{ role: 'about' as const, label: `${app.name}について` }]
    : [{ label: 'バージョン情報', click: openVersionInfoWindow }]),
  { type: 'separator' },
  {
    label: '設定...',
    accelerator: 'CmdOrCtrl+,',
    click: () => {
      openSettingsWindow();
    },
  },
  { type: 'separator' },
  { role: 'services' as const, label: 'サービス' },
  { type: 'separator' },
  { role: 'hide' as const, label: `${app.name}を隠す` },
  { role: 'hideOthers' as const, label: 'ほかを隠す' },
  { role: 'unhide' as const, label: 'すべて表示' },
  { type: 'separator' },
  { role: 'quit' as const, label: `${app.name}を終了` },
];

export const buildFileMenuItems = (): Electron.MenuItemConstructorOptions[] => [
  { role: 'close' as const, label: 'ウィンドウを閉じる' },
  {
    label: 'インポート',
    submenu: [
      {
        label: 'タイムライン（JSON）',
        click: (_menuItem, browserWindow) => {
          if (browserWindow && 'webContents' in browserWindow) {
            (browserWindow as BrowserWindow).webContents.send(
              'menu-import-timeline',
            );
          }
        },
      },
      {
        label: 'Sportscode XML（SCTimeline）',
        click: (_menuItem, browserWindow) => {
          if (browserWindow && 'webContents' in browserWindow) {
            (browserWindow as BrowserWindow).webContents.send(
              'menu-import-timeline',
            );
          }
        },
      },
    ],
  },
  {
    label: 'エクスポート',
    submenu: [
      {
        label: '映像クリップ（オーバーレイ）',
        click: (_menuItem, browserWindow) => {
          if (browserWindow && 'webContents' in browserWindow) {
            (browserWindow as BrowserWindow).webContents.send(
              'menu-export-clips',
            );
          }
        },
      },
      {
        label: 'タイムライン（JSON）',
        click: (_menuItem, browserWindow) => {
          if (browserWindow && 'webContents' in browserWindow) {
            (browserWindow as BrowserWindow).webContents.send(
              'menu-export-timeline',
              'json',
            );
          }
        },
      },
      {
        label: 'タイムライン（CSV / YouTube）',
        click: (_menuItem, browserWindow) => {
          if (browserWindow && 'webContents' in browserWindow) {
            (browserWindow as BrowserWindow).webContents.send(
              'menu-export-timeline',
              'csv',
            );
          }
        },
      },
      {
        label: 'タイムライン（Raw CSV）',
        click: (_menuItem, browserWindow) => {
          if (browserWindow && 'webContents' in browserWindow) {
            (browserWindow as BrowserWindow).webContents.send(
              'menu-export-analysis-raw-csv',
            );
          }
        },
      },
      {
        label: 'Sportscode XML（SCTimeline）',
        click: (_menuItem, browserWindow) => {
          if (browserWindow && 'webContents' in browserWindow) {
            (browserWindow as BrowserWindow).webContents.send(
              'menu-export-timeline',
              'sctimeline',
            );
          }
        },
      },
    ],
  },
  { type: 'separator' },
  {
    label: '開く...',
    accelerator: 'CmdOrCtrl+O',
    click: (_menuItem, browserWindow) => {
      if (browserWindow && 'webContents' in browserWindow) {
        (browserWindow as BrowserWindow).webContents.send('menu-open-package');
      }
    },
  },
  {
    label: '最近開いたパッケージ',
    submenu: buildRecentPackageItems(),
  },
];

export const buildEditMenuItems = (): Electron.MenuItemConstructorOptions[] => [
  { role: 'undo' as const, label: '元に戻す' },
  { role: 'redo' as const, label: 'やり直す' },
  { type: 'separator' },
  { role: 'cut' as const, label: '切り取り' },
  { role: 'copy' as const, label: 'コピー' },
  { role: 'paste' as const, label: '貼り付け' },
  { role: 'pasteAndMatchStyle' as const, label: 'スタイルに合わせて貼り付け' },
  { role: 'delete' as const, label: '削除' },
  { type: 'separator' },
  { role: 'selectAll' as const, label: 'すべて選択' },
];

export const buildCodingMenuItems = (): Electron.MenuItemConstructorOptions[] => [
  {
    id: 'toggle-label-mode',
    label: 'ラベルモード',
    type: 'checkbox',
    checked: false,
    click: (menuItem) => {
      sendToFocusedWindow('menu-toggle-label-mode', menuItem.checked);
    },
  },
];

export const buildSyncMenuItems = (): Electron.MenuItemConstructorOptions[] => [
  {
    label: '自動同期（音声解析）',
    accelerator: 'CmdOrCtrl+Shift+S',
    click: () => sendToFocusedWindow('menu-resync-audio'),
  },
  {
    label: '手動同期モード',
    accelerator: 'CmdOrCtrl+Shift+T',
    click: () => sendToFocusedWindow('menu-set-sync-mode', 'manual'),
  },
  { type: 'separator' },
  {
    label: '同期オフセットをリセット',
    accelerator: 'CmdOrCtrl+Shift+R',
    click: () => sendToFocusedWindow('menu-reset-sync'),
  },
];

export const buildWindowMenuItems = (): Electron.MenuItemConstructorOptions[] => [
  {
    label: '分析ウィンドウを開く',
    click: () => {
      openAnalysisWindow();
    },
  },
  {
    label: 'プレイリストウィンドウを開く',
    click: () => {
      createPlaylistWindow();
    },
  },
  { type: 'separator' },
  { role: 'minimize' as const, label: '最小化' },
  { role: 'zoom' as const, label: '拡大/縮小' },
  { type: 'separator' },
  { role: 'front' as const, label: '全てを前面に出す' },
];

export const buildHelpMenuItems = (
  isDevEnv: boolean,
): Electron.MenuItemConstructorOptions[] => {
  const helpMenuItems: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'ヘルプ / 機能一覧を開く',
      click: () => openHelpWindow(),
    },
  ];
  if (isDevEnv) {
    helpMenuItems.push({
      label: '開発者ツール',
      click: () => {
        const focusedWindow = BrowserWindow.getFocusedWindow();
        if (focusedWindow) {
          focusedWindow.webContents.toggleDevTools();
        }
      },
    });
  }
  return helpMenuItems;
};
