import { Menu, app, BrowserWindow } from 'electron';
import { createPlaylistWindow } from './playlistWindow';

let recentPackagePaths: string[] = [];

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

const buildMenu = () =>
  Menu.buildFromTemplate([
    {
      label: app.name,
      submenu: [
        { role: 'about', label: `${app.name}について` },
        { type: 'separator' },
        { role: 'services', label: 'サービス' },
        { type: 'separator' },
        { role: 'hide', label: `${app.name}を隠す` },
        { role: 'hideOthers', label: 'ほかを隠す' },
        { role: 'unhide', label: 'すべて表示' },
        { type: 'separator' },
        { role: 'quit', label: `${app.name}を終了` },
      ],
    },
    {
      label: 'ファイル',
      submenu: [
        { role: 'close', label: 'ウィンドウを閉じる' },
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
      ],
    },
    {
      label: 'ウィンドウ',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '拡大/縮小' },
        { type: 'separator' },
        { role: 'front', label: '全てを前面に出す' },
      ],
    },
    {
      label: 'ヘルプ',
      submenu: [
        {
          label: 'バージョン情報',
          click: () => {
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
          },
        },
        {
          label: 'プレイリストウィンドウを開く',
          click: () => {
            createPlaylistWindow();
          },
        },
        {
          label: '開発者ツール',
          click: () => {
            const focusedWindow = BrowserWindow.getFocusedWindow();
            if (focusedWindow) {
              focusedWindow.webContents.toggleDevTools();
            }
          },
        },
      ],
    },
  ]);

export const getMenu = () => buildMenu();
export const refreshAppMenu = () => Menu.setApplicationMenu(buildMenu());
