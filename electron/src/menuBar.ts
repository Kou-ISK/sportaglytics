import { Menu, app } from 'electron';
import {
  buildAppMenuItems,
  buildCodingMenuItems,
  buildEditMenuItems,
  buildFileMenuItems,
  buildHelpMenuItems,
  buildSyncMenuItems,
  buildWindowMenuItems,
} from './menu/menuSections';
import { setRecentPackagePaths as setRecentPackagePathsState } from './menu/recentPackageMenu';

const isMac = process.platform === 'darwin';
const isDevEnv = process.env.NODE_ENV === 'development' || !app.isPackaged;

export const setRecentPackagePaths = (paths: string[]) => {
  setRecentPackagePathsState(paths);
};

const buildMenu = () => {
  const helpMenuItems = buildHelpMenuItems(isDevEnv);

  const template: Electron.MenuItemConstructorOptions[] = [
    { label: app.name, submenu: buildAppMenuItems(isMac) },
    { label: 'ファイル', submenu: buildFileMenuItems() },
    { label: '編集', submenu: buildEditMenuItems() },
    { label: 'コーディング', submenu: buildCodingMenuItems() },
    { label: '同期', submenu: buildSyncMenuItems() },
    { label: 'ウィンドウ', submenu: buildWindowMenuItems() },
    ...(helpMenuItems.length
      ? [{ label: 'ヘルプ', submenu: helpMenuItems }]
      : []),
  ];

  return Menu.buildFromTemplate(template);
};

export const getMenu = () => buildMenu();
export const refreshAppMenu = () => Menu.setApplicationMenu(buildMenu());
