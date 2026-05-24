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

  it('allows macOS .stpkg bundles to be selected as package directories', async () => {
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
      message: 'パッケージを選択する',
      filters: [
        {
          name: 'SporTagLytics Package',
          extensions: ['stpkg'],
        },
      ],
    });
  });
});
