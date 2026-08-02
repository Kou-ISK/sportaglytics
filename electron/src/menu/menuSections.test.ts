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

import { buildCodingMenuItems } from './menuSections';

describe('coding menu', () => {
  beforeEach(() => {
    send.mockClear();
  });

  it('opens the new code window workflow from the menu bar', () => {
    const createItem = buildCodingMenuItems().find(
      (item) => item.id === 'create-code-window',
    );

    expect(createItem?.accelerator).toBe('CmdOrCtrl+Shift+N');
    expect(createItem?.click).toBeTypeOf('function');
    if (createItem?.click) {
      Reflect.apply(createItem.click, undefined, []);
    }
    expect(send).toHaveBeenCalledWith('menu-create-code-window-file');
  });
});
