import { beforeEach, describe, expect, it, vi } from 'vitest';

const electronMocks = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  return {
    handlers,
    addRecentDocument: vi.fn(),
    handle: vi.fn(
      (channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler);
      },
    ),
    showOpenDialog: vi.fn(),
  };
});

const senderGuardMocks = vi.hoisted(() => ({
  getValidatedEventSenderWindow: vi.fn(() => ({ isDestroyed: () => false })),
}));

vi.mock('electron', () => ({
  app: {
    addRecentDocument: electronMocks.addRecentDocument,
  },
  dialog: {
    showOpenDialog: electronMocks.showOpenDialog,
  },
  ipcMain: {
    handle: electronMocks.handle,
  },
}));

vi.mock('../menuBar', () => ({
  refreshAppMenu: vi.fn(),
}));

vi.mock('./windowSenderGuards', () => senderGuardMocks);

describe('legacy file access handlers', () => {
  beforeEach(() => {
    vi.resetModules();
    electronMocks.handlers.clear();
    electronMocks.handle.mockClear();
    electronMocks.showOpenDialog.mockReset();
    electronMocks.addRecentDocument.mockReset();
    senderGuardMocks.getValidatedEventSenderWindow.mockReset();
    senderGuardMocks.getValidatedEventSenderWindow.mockReturnValue({
      isDestroyed: () => false,
    });
  });

  it('selects an unfiltered destination folder independently of package opening', async () => {
    const { registerLegacyFileAccessHandlers } =
      await import('./legacyFileAccessHandlers');
    const parentWindow = { id: 'main-window' };
    registerLegacyFileAccessHandlers({
      getMainWindow: () => parentWindow as Electron.BrowserWindow,
    });

    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/match.stpkg'],
    });

    const handler = electronMocks.handlers.get('files:open-directory');
    expect(handler).toBeTypeOf('function');

    const result = await handler?.({ sender: {} });

    expect(result).toBe('/tmp/match.stpkg');
    expect(electronMocks.showOpenDialog).toHaveBeenCalledWith(parentWindow, {
      properties: ['openDirectory', 'treatPackageAsDirectory'],
      message: '新しいプロジェクトの保存先フォルダを選択する',
    });
  });

  it.each(['darwin', 'win32'])(
    'selects packages and project folders through one picker on %s',
    async (platform) => {
      const original = Object.getOwnPropertyDescriptor(process, 'platform');
      Object.defineProperty(process, 'platform', { value: platform });
      try {
        const { registerLegacyFileAccessHandlers } =
          await import('./legacyFileAccessHandlers');
        registerLegacyFileAccessHandlers({ getMainWindow: () => null });
        const handler = electronMocks.handlers.get('package:select-path');
        electronMocks.showOpenDialog.mockResolvedValue({
          canceled: false,
          filePaths: ['/tmp/source'],
        });
        expect(await handler?.({ sender: {} })).toBe('/tmp/source');
        expect(electronMocks.showOpenDialog.mock.calls[0]?.[1]).toEqual({
          properties:
            platform === 'darwin'
              ? ['openFile', 'openDirectory']
              : ['openDirectory'],
          message: '開くファイルまたはフォルダを選択する',
        });
        electronMocks.showOpenDialog.mockResolvedValue({
          canceled: true,
          filePaths: [],
        });
        expect(await handler?.({ sender: {} })).toBe('');
        expect(electronMocks.addRecentDocument).not.toHaveBeenCalled();
      } finally {
        if (original) Object.defineProperty(process, 'platform', original);
      }
    },
  );

  it('selects multiple video files in sequence order', async () => {
    const { registerLegacyFileAccessHandlers } =
      await import('./legacyFileAccessHandlers');
    const parentWindow = { id: 'main-window' };
    registerLegacyFileAccessHandlers({
      getMainWindow: () => parentWindow as Electron.BrowserWindow,
    });
    electronMocks.showOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ['/tmp/period-1.mp4', '/tmp/period-2.mov'],
    });

    const handler = electronMocks.handlers.get('files:open-video-files');
    const result = await handler?.({ sender: {} });

    expect(result).toEqual(['/tmp/period-1.mp4', '/tmp/period-2.mov']);
    expect(electronMocks.showOpenDialog).toHaveBeenCalledWith(parentWindow, {
      properties: ['openFile', 'multiSelections'],
      message: '同じアングルへ追加する映像を順番に選択',
      filters: [
        {
          name: '映像ファイル',
          extensions: ['mov', 'mp4', 'm4v', 'webm'],
        },
      ],
    });
  });
});
