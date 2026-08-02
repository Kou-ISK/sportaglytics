import { beforeEach, describe, expect, it, vi } from 'vitest';

const { send } = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { name: 'SporTagLytics' },
  BrowserWindow: {
    getAllWindows: () => [
      {
        isDestroyed: () => false,
        webContents: { send },
      },
    ],
    getFocusedWindow: () => null,
  },
}));
vi.mock('../settingsWindow', () => ({
  openSettingsWindow: vi.fn(),
}));
vi.mock('../playlistWindow', () => ({ createPlaylistWindow: vi.fn() }));
vi.mock('../analysisWindow', () => ({ openAnalysisWindow: vi.fn() }));
vi.mock('../codingPanelWindow', () => ({ openCodingPanelWindow: vi.fn() }));
vi.mock('../helpWindow', () => ({ openHelpWindow: vi.fn() }));
vi.mock('./recentPackageMenu', () => ({ buildRecentPackageItems: () => [] }));
vi.mock('./menuWindowActions', () => ({
  openVersionInfoWindow: vi.fn(),
  sendToFocusedWindow: vi.fn(),
}));

import {
  buildCodingMenuItems,
  buildFileMenuItems,
  buildWindowMenuItems,
} from './menuSections';

const getSubmenuItems = (
  item: Electron.MenuItemConstructorOptions | undefined,
): Electron.MenuItemConstructorOptions[] => {
  return Array.isArray(item?.submenu) ? item.submenu : [];
};

describe('coding menu', () => {
  beforeEach(() => {
    send.mockClear();
  });

  it('groups document creation and opening under File', () => {
    const fileItems = buildFileMenuItems();
    const newItems = getSubmenuItems(
      fileItems.find((item) => item.label === '新規'),
    );
    const openItems = getSubmenuItems(
      fileItems.find((item) => item.label === '開く'),
    );
    const createPackageItem = newItems.find(
      (item) => item.id === 'create-video-package',
    );
    const createItem = newItems.find(
      (item) => item.id === 'create-code-window',
    );
    const openCodeWindowItem = openItems.find(
      (item) => item.id === 'open-code-window-file',
    );

    expect(createPackageItem?.accelerator).toBe('CmdOrCtrl+N');
    expect(createItem?.accelerator).toBe('CmdOrCtrl+Shift+N');
    expect(openCodeWindowItem?.accelerator).toBe('CmdOrCtrl+Option+O');

    if (createPackageItem?.click) {
      Reflect.apply(createPackageItem.click, undefined, []);
    }
    expect(createItem?.click).toBeTypeOf('function');
    if (createItem?.click) {
      Reflect.apply(createItem.click, undefined, []);
    }
    if (openCodeWindowItem?.click) {
      Reflect.apply(openCodeWindowItem.click, undefined, []);
    }

    expect(send).toHaveBeenCalledWith('menu-create-video-package');
    expect(send).toHaveBeenCalledWith('menu-create-code-window-file');
    expect(send).toHaveBeenCalledWith('menu-open-code-window-file');
  });

  it('keeps document lifecycle actions out of Coding and Window', () => {
    expect(buildCodingMenuItems().map((item) => item.label)).toEqual([
      'ラベルモード',
    ]);
    expect(buildWindowMenuItems().map((item) => item.label)).not.toContain(
      'コードウィンドウを開く',
    );
  });
});
