import { Menu, app, BrowserWindow } from 'electron';
import { createPlaylistWindow } from './playlistWindow';
import { openSettingsWindow } from './settingsWindow';
import { openHelpWindow } from './helpWindow';

let recentPackagePaths: string[] = [];

const isMac = process.platform === 'darwin';
const isDevEnv = process.env.NODE_ENV === 'development' || !app.isPackaged;

const openVersionInfoWindow = () => {
  const versionWindow = new BrowserWindow({
    width: 400,
    height: 200,
    webPreferences: { nodeIntegration: true },
  });
  versionWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(`
    <h1>SportagLytics</h1>
    <p>バージョン: ${app.getVersion()}</p>
  `)}`,
  );
};

export const setRecentPackagePaths = (paths: string[]) => {
  recentPackagePaths = paths;
};

const getRecentDocs = (): string[] => {
  if (recentPackagePaths.length) return recentPackagePaths;
  const fn = (app as unknown as { getRecentDocuments?: () => string[] })
    .getRecentDocuments;
  if (typeof fn === 'function') return fn();
  return [];
};

const buildRecentPackageItems = () => {
  const recents = getRecentDocs();
  if (!recents.length) {
    const emptyItems: Electron.MenuItemConstructorOptions[] = [
      { label: '最近のパッケージはありません', enabled: false },
      { role: 'clearRecentDocuments', label: '履歴をクリア' as const },
    ];
    return emptyItems;
  }
  const items: Electron.MenuItemConstructorOptions[] = recents.map((p) => {
    const pathStr =
      typeof p === 'string'
        ? p
        : typeof (p as any)?.path === 'string'
          ? (p as any).path
          : String(p);
    return {
      label: pathStr.split(/[\\/]/).pop() || pathStr,
      toolTip: pathStr,
      click: (_menuItem, window) => {
        const target =
          BrowserWindow.getFocusedWindow() ||
          (window as BrowserWindow | undefined) ||
          BrowserWindow.getAllWindows()[0];
        if (target) {
          target.webContents.send('menu-open-recent-package', pathStr);
        }
      },
    };
  });
  items.push({ type: 'separator' });
  items.push({
    role: 'clearRecentDocuments',
    label: '履歴をクリア',
  });
  return items;
};

const sendToFocusedWindow = (channel: string, ...args: unknown[]) => {
  const target =
    BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
  if (target && !target.isDestroyed()) {
    target.webContents.send(channel, ...args);
  }
};

const buildMenu = () => {
  const appMenuItems: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [{ role: 'about' as const, label: `${app.name}について` }]
      : [{ label: 'バージョン情報', click: openVersionInfoWindow }]),
    { type: 'separator' },
    {
      label: '設定...',
      accelerator: 'CmdOrCtrl+,',
      click: (_menuItem, browserWindow) => {
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

  const fileMenuItems: Electron.MenuItemConstructorOptions[] = [
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
          label: 'タイムライン（CSV）',
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
          (browserWindow as BrowserWindow).webContents.send(
            'menu-open-package',
          );
        }
      },
    },
    {
      label: '最近開いたパッケージ',
      submenu: buildRecentPackageItems(),
    },
  ];

  const windowMenuItems: Electron.MenuItemConstructorOptions[] = [
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

  // コーディングメニュー
  const codingMenuItems: Electron.MenuItemConstructorOptions[] = [
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

  // 同期メニュー（MECE構造）
  const syncMenuItems: Electron.MenuItemConstructorOptions[] = [
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

  const template: Electron.MenuItemConstructorOptions[] = [
    { label: app.name, submenu: appMenuItems },
    { label: 'ファイル', submenu: fileMenuItems },
    { label: 'コーディング', submenu: codingMenuItems },
    { label: '同期', submenu: syncMenuItems },
    { label: 'ウィンドウ', submenu: windowMenuItems },
    ...(helpMenuItems.length
      ? [{ label: 'ヘルプ', submenu: helpMenuItems }]
      : []),
  ];

  return Menu.buildFromTemplate(template);
};

export const getMenu = () => buildMenu();
export const refreshAppMenu = () => Menu.setApplicationMenu(buildMenu());
