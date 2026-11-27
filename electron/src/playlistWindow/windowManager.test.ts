import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PLAYLIST_WINDOW_CHANNELS } from '../../../src/types/ipc/playlistWindow';
import type { PlaylistItem } from '../../../src/types/playlist/core';
import type { PlaylistSyncData } from '../../../src/types/playlist/window';
import { getPlaylistWindows } from './state';
import * as manager from './windowManager';
import { BrowserWindow } from 'electron';
import { beginPlaylistDocumentLoad } from './documentLoad';

const mocks = vi.hoisted(() => {
  class Window {
    destroyed = false;
    listeners = new Map<string, (...args: unknown[]) => void>();
    webContents = {
      send: vi.fn(),
      isLoading: () => true,
      listeners: new Map<string, () => void>(),
      on(name: string, listener: () => void): void {
        this.listeners.set(name, listener);
      },
    };
    loadURL = vi.fn();
    setMenuBarVisibility = vi.fn();
    focus = vi.fn();
    getTitle = (): string => 'プレイリスト';
    isDestroyed = (): boolean => this.destroyed;
    on = (name: string, listener: (...args: unknown[]) => void): void => {
      this.listeners.set(name, listener);
    };
    static fromWebContents(sender: unknown): Window | null {
      return instances.find((window) => window.webContents === sender) ?? null;
    }
    constructor() {
      instances.push(this);
    }
  }
  const instances: Window[] = [];
  return { Window, instances, getSession: vi.fn(), showMessageBox: vi.fn() };
});

vi.mock('electron', () => ({
  BrowserWindow: mocks.Window,
  dialog: { showMessageBox: mocks.showMessageBox },
}));
vi.mock('../rendererUrl', () => ({
  getRendererUrl: () => 'file:///fixture#/playlist',
}));
vi.mock('../windowSecurity', () => ({ applyWindowSecurity: vi.fn() }));
vi.mock('../packageSessionRegistry', () => ({
  createPackageSession: vi.fn(),
  getPackageSessionForWindow: mocks.getSession,
  registerAuxiliaryWindow: vi.fn(),
  unregisterAuxiliaryWindow: vi.fn(),
}));

const clip: PlaylistItem = {
  id: 'synthetic-clip',
  timelineItemId: null,
  actionName: 'Team A',
  startTime: 0,
  endTime: 5,
  addedAt: 1,
};

describe('playlist destination and delivery', () => {
  let owner: BrowserWindow;
  beforeEach(() => {
    getPlaylistWindows().clear();
    mocks.instances.length = 0;
    owner = new BrowserWindow();
    const session = {
      id: 'package-a',
      packagePath: '/match-a.stpkg',
      mainWindow: owner,
    };
    mocks.getSession
      .mockReset()
      .mockImplementation((candidate: unknown) =>
        candidate === owner ? session : null,
      );
    mocks.showMessageBox.mockReset();
  });

  const screen = (index: number) => mocks.instances[index].webContents.send;
  const second = { ...clip, id: 'second' };

  it('creates one destination and retains the whole batch exactly once until ready', async () => {
    expect(
      await manager.deliverItemsToPlaylistWindow([clip, second], owner),
    ).toBe(true);
    const [info] = getPlaylistWindows().values();
    expect(info.isDirty).toBe(true);
    expect(screen(1)).not.toHaveBeenCalled();
    manager.markPlaylistRendererReady(info.window.webContents);
    manager.markPlaylistRendererReady(info.window.webContents);
    expect(screen(1).mock.calls).toEqual([
      [PLAYLIST_WINDOW_CHANNELS.addItem, clip],
      [PLAYLIST_WINDOW_CHANNELS.addItem, second],
    ]);
    expect(mocks.showMessageBox).not.toHaveBeenCalled();
  });

  it('flushes pre-ready sync before clips and does not replay them on a second ready', async () => {
    const receiver = manager.createPlaylistWindow(undefined, owner);
    const sync: PlaylistSyncData = {
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
    manager.syncToPlaylistWindow(sync, owner);
    expect(await manager.deliverItemsToPlaylistWindow([clip], owner)).toBe(
      true,
    );
    manager.markPlaylistRendererReady(receiver.webContents);
    manager.markPlaylistRendererReady(receiver.webContents);
    expect(screen(1).mock.calls).toEqual([
      [PLAYLIST_WINDOW_CHANNELS.sync, sync],
      [PLAYLIST_WINDOW_CHANNELS.addItem, clip],
    ]);
  });

  it('adds only to the chosen destination, in batch order', async () => {
    const first = manager.createPlaylistWindow(
      '/analysis/Scouting.stpl',
      owner,
    );
    const last = manager.createPlaylistWindow('/review/Scouting.stpl', owner);
    manager.markPlaylistRendererReady(first.webContents);
    manager.markPlaylistRendererReady(last.webContents);
    mocks.showMessageBox.mockResolvedValue({ response: 2 });
    expect(
      await manager.deliverItemsToPlaylistWindow([clip, second], owner),
    ).toBe(true);
    expect(mocks.showMessageBox).toHaveBeenCalledWith(
      owner,
      expect.objectContaining({
        buttons: [
          'キャンセル',
          '1. Scouting（analysis）',
          '2. Scouting（review）',
        ],
      }),
    );
    expect(screen(1)).not.toHaveBeenCalled();
    expect(screen(2).mock.calls).toEqual([
      [PLAYLIST_WINDOW_CHANNELS.addItem, clip],
      [PLAYLIST_WINDOW_CHANNELS.addItem, second],
    ]);
    expect(
      [...getPlaylistWindows().values()].map(({ isDirty }) => isDirty),
    ).toEqual([false, true]);
  });

  it('cancels without mutating any document', async () => {
    manager.createPlaylistWindow(undefined, owner);
    manager.createPlaylistWindow(undefined, owner);
    mocks.showMessageBox.mockResolvedValue({ response: 0 });
    expect(await manager.deliverItemsToPlaylistWindow([clip], owner)).toBe(
      false,
    );
    expect(
      [...getPlaylistWindows().values()].every(({ isDirty }) => !isDirty),
    ).toBe(true);
  });

  it.each(['close', 'replace'])(
    'does not reroute if the selected document changes (%s)',
    async (change) => {
      manager.createPlaylistWindow(undefined, owner);
      manager.createPlaylistWindow(undefined, owner);
      const [, info] = getPlaylistWindows().values();
      mocks.showMessageBox
        .mockImplementationOnce(async () => {
          if (change === 'close') {
            mocks.instances[2].destroyed = true;
            mocks.instances[2].listeners.get('closed')?.();
          } else {
            beginPlaylistDocumentLoad(info);
          }
          return { response: 2 };
        })
        .mockResolvedValueOnce({ response: 0 });
      expect(await manager.deliverItemsToPlaylistWindow([clip], owner)).toBe(
        false,
      );
      expect(mocks.showMessageBox).toHaveBeenCalledTimes(2);
      expect(
        [...getPlaylistWindows().values()].every(({ isDirty }) => !isDirty),
      ).toBe(true);
    },
  );

  it('queues across a renderer reload in the same package and never sends to another package', async () => {
    const ownerB = new BrowserWindow();
    const previous = mocks.getSession.getMockImplementation();
    const sessionB = { id: 'package-b', mainWindow: ownerB };
    mocks.getSession.mockImplementation((candidate: unknown) =>
      candidate === ownerB ? sessionB : previous?.(candidate),
    );
    const playlistA = manager.createPlaylistWindow(undefined, owner);
    const playlistB = manager.createPlaylistWindow(undefined, ownerB);
    manager.markPlaylistRendererReady(playlistA.webContents);
    mocks.instances[2].webContents.listeners.get('did-start-loading')?.();
    await manager.deliverItemsToPlaylistWindow([clip], owner);
    expect(screen(2)).not.toHaveBeenCalled();
    manager.markPlaylistRendererReady(playlistB.webContents);
    expect(screen(3)).not.toHaveBeenCalled();
    manager.markPlaylistRendererReady(playlistA.webContents);
    manager.markPlaylistRendererReady(playlistA.webContents);
    expect(screen(2).mock.calls).toEqual([
      [PLAYLIST_WINDOW_CHANNELS.addItem, clip],
    ]);
  });
});
