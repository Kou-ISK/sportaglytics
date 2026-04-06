import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PLAYLIST_WINDOW_CHANNELS,
  type PlaylistSyncData,
} from '../../../src/types/ipc/playlistWindow';

const electronMocks = vi.hoisted(() => {
  const handleHandlers = new Map<string, (...args: unknown[]) => unknown>();
  const onHandlers = new Map<string, (...args: unknown[]) => unknown>();

  return {
    handleHandlers,
    onHandlers,
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      handleHandlers.set(channel, handler);
    }),
    on: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      onHandlers.set(channel, handler);
    }),
    showSaveDialog: vi.fn(),
    showOpenDialog: vi.fn(),
    showMessageBox: vi.fn(),
    showErrorBox: vi.fn(),
  };
});

const windowManagerMocks = vi.hoisted(() => ({
  addItemToAllWindows: vi.fn(),
  closePlaylistWindow: vi.fn(),
  createPlaylistWindow: vi.fn(),
  getOpenWindowCount: vi.fn(() => 0),
  getWindowInfoBySender: vi.fn(() => null),
  isPlaylistWindowOpen: vi.fn(() => false),
  isSenderPlaylistWindow: vi.fn(() => false),
  setPlaylistWindowTitleForSender: vi.fn(() => false),
  syncToPlaylistWindow: vi.fn(),
}));

const senderGuardMocks = vi.hoisted(() => ({
  getValidatedEventSenderWindow: vi.fn(() => ({ isDestroyed: () => false })),
  isEventFromWindow: vi.fn(),
}));

const stateMocks = vi.hoisted(() => ({
  getFfmpegPathRef: vi.fn(() => '/tmp/ffmpeg'),
  getMainWindowRef: vi.fn(),
  getPlaylistWindows: vi.fn(() => new Map()),
}));

const storageMocks = vi.hoisted(() => ({
  loadPlaylistFromPath: vi.fn(),
  savePlaylistToPath: vi.fn(),
}));

vi.mock('electron', () => ({
  dialog: {
    showSaveDialog: electronMocks.showSaveDialog,
    showOpenDialog: electronMocks.showOpenDialog,
    showMessageBox: electronMocks.showMessageBox,
    showErrorBox: electronMocks.showErrorBox,
  },
  ipcMain: {
    handle: electronMocks.handle,
    on: electronMocks.on,
  },
}));

vi.mock('./windowManager', () => windowManagerMocks);
vi.mock('../ipc/windowSenderGuards', () => senderGuardMocks);
vi.mock('./state', () => stateMocks);
vi.mock('./storage', () => storageMocks);

describe('playlistWindow handlers', () => {
  beforeEach(() => {
    vi.resetModules();
    electronMocks.handleHandlers.clear();
    electronMocks.onHandlers.clear();
    electronMocks.handle.mockClear();
    electronMocks.on.mockClear();
    windowManagerMocks.syncToPlaylistWindow.mockReset();
    windowManagerMocks.isSenderPlaylistWindow.mockReset();
    windowManagerMocks.setPlaylistWindowTitleForSender.mockReset();
    senderGuardMocks.getValidatedEventSenderWindow.mockReset();
    senderGuardMocks.isEventFromWindow.mockReset();
    senderGuardMocks.getValidatedEventSenderWindow.mockReturnValue({
      isDestroyed: () => false,
    });
  });

  it('rejects invalid playlist sync payloads before dispatching to windowManager', async () => {
    const { registerPlaylistHandlers } = await import('./handlers');
    registerPlaylistHandlers();

    const mainWindow = {
      isDestroyed: () => false,
      webContents: { id: 'main' },
    };
    stateMocks.getMainWindowRef.mockReturnValue(mainWindow);
    senderGuardMocks.isEventFromWindow.mockImplementation(
      (event: { sender: unknown }, expectedWindow: { webContents: unknown } | null) =>
        Boolean(expectedWindow) && event.sender === expectedWindow.webContents,
    );

    const syncHandler = electronMocks.onHandlers.get(
      PLAYLIST_WINDOW_CHANNELS.syncToWindow,
    );
    expect(syncHandler).toBeTypeOf('function');

    syncHandler?.({ sender: mainWindow.webContents }, { invalid: true });
    expect(windowManagerMocks.syncToPlaylistWindow).not.toHaveBeenCalled();

    const validSync: PlaylistSyncData = {
      state: {
        playlists: [],
        activePlaylistId: null,
        playingItemId: null,
        loopMode: 'none',
      },
      videoPath: null,
      videoPath2: null,
      videoSources: [],
      currentTime: 0,
    };

    syncHandler?.({ sender: mainWindow.webContents }, validSync);
    expect(windowManagerMocks.syncToPlaylistWindow).toHaveBeenCalledWith(
      validSync,
    );
  });

  it('forwards playlist commands only from playlist window senders with valid payloads', async () => {
    const send = vi.fn();
    const mainWindow = {
      isDestroyed: () => false,
      webContents: { send },
    };
    stateMocks.getMainWindowRef.mockReturnValue(mainWindow);

    const { registerPlaylistHandlers } = await import('./handlers');
    registerPlaylistHandlers();

    const commandHandler = electronMocks.onHandlers.get(
      PLAYLIST_WINDOW_CHANNELS.command,
    );
    expect(commandHandler).toBeTypeOf('function');

    windowManagerMocks.isSenderPlaylistWindow.mockReturnValue(false);
    commandHandler?.({ sender: {} }, { type: 'request-sync' });
    expect(send).not.toHaveBeenCalled();

    windowManagerMocks.isSenderPlaylistWindow.mockReturnValue(true);
    commandHandler?.({ sender: {} }, { type: 'seek', time: 'broken' });
    expect(send).not.toHaveBeenCalled();

    commandHandler?.({ sender: {} }, { type: 'request-sync' });
    expect(send).toHaveBeenCalledWith(
      PLAYLIST_WINDOW_CHANNELS.command,
      expect.objectContaining({ type: 'request-sync' }),
    );
  });
});
