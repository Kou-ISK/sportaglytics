import { beforeEach, describe, expect, it, vi } from 'vitest';

const { send, otherSend, openTimelineWindow, openPlaylistFile } = vi.hoisted(
  () => ({
    send: vi.fn(),
    otherSend: vi.fn(),
    openTimelineWindow: vi.fn(),
    openPlaylistFile: vi.fn(),
  }),
);

vi.mock('electron', () => ({
  app: { name: 'SporTagLytics' },
  BrowserWindow: {
    getAllWindows: () => [
      {
        isDestroyed: () => false,
        webContents: { send },
      },
      { isDestroyed: () => false, webContents: { send: otherSend } },
    ],
    getFocusedWindow: () => null,
  },
}));
vi.mock('../packageSessionRegistry', () => ({
  getPackageSessionForWindow: (window: unknown) =>
    window ? { mainWindow: window } : null,
}));
vi.mock('../settingsWindow', () => ({
  openSettingsWindow: vi.fn(),
}));
vi.mock('../playlistWindow', () => ({
  createPlaylistWindow: vi.fn(),
  openPlaylistFile,
}));
vi.mock('../analysisWindow', () => ({ openAnalysisWindow: vi.fn() }));
vi.mock('../timelineWindow', () => ({ openTimelineWindow }));
vi.mock('./clipExportMenuAction', () => ({ openClipExportFromMenu: vi.fn() }));
vi.mock('../helpWindow', () => ({ openHelpWindow: vi.fn() }));
vi.mock('./recentPackageMenu', () => ({ buildRecentPackageItems: () => [] }));
vi.mock('./menuWindowActions', () => ({
  openVersionInfoWindow: vi.fn(),
  sendToFocusedWindow: vi.fn(),
}));

import {
  buildFileMenuItems,
  buildHelpMenuItems,
  buildWindowMenuItems,
} from './menuSections';

const getSubmenuItems = (
  item: Electron.MenuItemConstructorOptions | undefined,
): Electron.MenuItemConstructorOptions[] => {
  return Array.isArray(item?.submenu) ? item.submenu : [];
};

describe('document menus', () => {
  beforeEach(() => {
    send.mockClear();
    otherSend.mockClear();
    openTimelineWindow.mockClear();
    openPlaylistFile.mockClear();
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
    expect(otherSend).not.toHaveBeenCalledWith('menu-create-code-window-file');
    expect(otherSend).not.toHaveBeenCalledWith('menu-open-code-window-file');
  });

  it('reopens the detached timeline from Window', () => {
    const timelineItem = buildWindowMenuItems().find(
      (item) => item.label === 'タイムラインを開く',
    );

    expect(timelineItem?.click).toBeTypeOf('function');
    if (timelineItem?.click) {
      Reflect.apply(timelineItem.click, undefined, []);
    }
    expect(openTimelineWindow).toHaveBeenCalledTimes(1);
  });

  it('opens a playlist file from File without broadcasting to other documents', () => {
    const item = getSubmenuItems(
      buildFileMenuItems().find((entry) => entry.label === '開く'),
    ).find((entry) => entry.id === 'open-playlist-file');
    expect(item?.label).toBe('プレイリスト…');
    expect(item?.click).toBeTypeOf('function');
    if (item?.click) Reflect.apply(item.click, undefined, []);
    expect(openPlaylistFile).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  it('assigns Help a unique accelerator', () => {
    const accelerators = [
      ...buildFileMenuItems(),
      ...buildWindowMenuItems(),
      ...buildHelpMenuItems(false),
    ]
      .flatMap((item) => [item, ...getSubmenuItems(item)])
      .map((item) => item.accelerator)
      .filter(
        (accelerator): accelerator is string => typeof accelerator === 'string',
      );

    expect(accelerators).toContain('CmdOrCtrl+Shift+/');
    expect(new Set(accelerators).size).toBe(accelerators.length);
  });

  it('keeps document lifecycle actions out of Window', () => {
    expect(buildWindowMenuItems().map((item) => item.label)).not.toContain(
      'コードウィンドウを開く',
    );
  });
});
