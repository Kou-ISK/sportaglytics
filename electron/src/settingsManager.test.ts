import { beforeEach, describe, expect, it, vi } from 'vitest';

const electronMocks = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  return {
    handlers,
    handle: vi.fn(
      (channel: string, handler: (...args: unknown[]) => unknown) => {
        handlers.set(channel, handler);
      },
    ),
    getPath: vi.fn(() => '/tmp/sportaglytics'),
    fromWebContents: vi.fn(),
    getAllWindows: vi.fn<() => unknown[]>(() => []),
  };
});

const fsMocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: electronMocks.getPath,
  },
  ipcMain: {
    handle: electronMocks.handle,
  },
  BrowserWindow: {
    fromWebContents: electronMocks.fromWebContents,
    getAllWindows: electronMocks.getAllWindows,
  },
}));

vi.mock('node:fs/promises', () => ({
  default: fsMocks,
  ...fsMocks,
}));

describe('settingsManager', () => {
  beforeEach(() => {
    electronMocks.handlers.clear();
    electronMocks.handle.mockClear();
    electronMocks.getPath.mockClear();
    electronMocks.fromWebContents.mockReset();
    electronMocks.getAllWindows.mockReset();
    electronMocks.getAllWindows.mockReturnValue([]);
    fsMocks.readFile.mockReset();
    fsMocks.mkdir.mockReset();
    fsMocks.writeFile.mockReset();
  });

  it('rejects invalid settings payloads before writing to disk', async () => {
    const { registerSettingsHandlers } = await import('./settingsManager');
    registerSettingsHandlers();

    const saveHandler = electronMocks.handlers.get('settings:save');
    expect(saveHandler).toBeTypeOf('function');

    electronMocks.fromWebContents.mockReturnValue({
      isDestroyed: () => false,
    });

    const result = await saveHandler?.({ sender: {} }, 'invalid payload');

    expect(result).toBe(false);
    expect(fsMocks.writeFile).not.toHaveBeenCalled();
  });

  it('rejects save requests from unknown senders', async () => {
    const { registerSettingsHandlers } = await import('./settingsManager');
    registerSettingsHandlers();

    const saveHandler = electronMocks.handlers.get('settings:save');
    expect(saveHandler).toBeTypeOf('function');

    electronMocks.fromWebContents.mockReturnValue(null);

    const result = await saveHandler?.({ sender: {} }, { themeMode: 'dark' });

    expect(result).toBe(false);
    expect(fsMocks.writeFile).not.toHaveBeenCalled();
  });

  it('normalizes and broadcasts persisted settings', async () => {
    const { registerSettingsHandlers } = await import('./settingsManager');
    registerSettingsHandlers();

    const saveHandler = electronMocks.handlers.get('settings:save');
    expect(saveHandler).toBeTypeOf('function');

    const send = vi.fn();
    electronMocks.fromWebContents.mockReturnValue({
      isDestroyed: () => false,
    });
    electronMocks.getAllWindows.mockReturnValue([
      {
        isDestroyed: () => false,
        webContents: {
          send,
        },
      },
    ]);

    const result = await saveHandler?.(
      { sender: {} },
      {
        themeMode: 'dark',
        hotkeys: [
          { id: 'undo', label: 'Custom Undo', key: 'Ctrl+Shift+Z' },
          { id: 'invalid-hotkey', label: 'Ignored', key: 'X' },
        ],
        codingPanel: {
          layouts: [],
          activeLayoutId: 'legacy-layout',
        },
      },
    );

    expect(result).toBe(true);
    expect(fsMocks.mkdir).toHaveBeenCalledWith('/tmp/sportaglytics', {
      recursive: true,
    });
    expect(fsMocks.writeFile).toHaveBeenCalledTimes(1);

    const writtenSettings = JSON.parse(
      fsMocks.writeFile.mock.calls[0]?.[1] as string,
    ) as {
      themeMode: string;
      hotkeys: Array<{ id: string; label: string; key: string }>;
      codingPanel?: {
        activeCodeWindowId?: string;
        codeWindows?: Array<{ id: string }>;
      };
    };

    expect(writtenSettings.themeMode).toBe('dark');
    expect(
      writtenSettings.hotkeys.some((hotkey) => hotkey.id === 'invalid-hotkey'),
    ).toBe(false);
    expect(
      writtenSettings.hotkeys.find((hotkey) => hotkey.id === 'undo'),
    ).toEqual({
      id: 'undo',
      label: 'Custom Undo',
      key: 'Ctrl+Shift+Z',
    });
    expect(writtenSettings.codingPanel?.activeCodeWindowId).toBe('default');
    expect(
      writtenSettings.codingPanel?.codeWindows?.some(
        (layout) => layout.id === 'default',
      ),
    ).toBe(true);
    expect(send).toHaveBeenCalledWith(
      'settings:updated',
      expect.objectContaining({
        themeMode: 'dark',
      }),
    );
  });
});
