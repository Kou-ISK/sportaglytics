import { app, BrowserWindow } from 'electron';

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

export const buildRecentPackageItems = (): Electron.MenuItemConstructorOptions[] => {
  const recents = getRecentDocs();
  if (!recents.length) {
    return [
      { label: '最近のパッケージはありません', enabled: false },
      { role: 'clearRecentDocuments', label: '履歴をクリア' as const },
    ];
  }

  const items: Electron.MenuItemConstructorOptions[] = recents.map((p) => {
    const pathStr =
      typeof p === 'string'
        ? p
        : typeof (p as { path?: unknown })?.path === 'string'
          ? (p as { path: string }).path
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
