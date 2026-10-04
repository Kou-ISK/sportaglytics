import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PLAYLIST_WINDOW_CHANNELS } from '../../../src/types/ipc/playlistWindow';
import type { PlaylistItem } from '../../../src/types/playlist/core';
import type { PlaylistSyncData } from '../../../src/types/playlist/window';
import { getPlaylistWindows } from './state';
import * as manager from './windowManager';
import { BrowserWindow } from 'electron';

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
  return { Window, instances, getSession: vi.fn() };
});

vi.mock('electron', () => ({ BrowserWindow: mocks.Window, dialog: {} }));
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

describe('playlist renderer delivery', () => {
  beforeEach(() => {
    getPlaylistWindows().clear();
    mocks.instances.length = 0;
    mocks.getSession.mockReset();
  });

  it('retains the first clip while the new renderer has no add-item listener', () => {
    const window = manager.createPlaylistWindow();
    manager.addItemToAllWindows(clip);
    expect(mocks.instances[0].webContents.send).not.toHaveBeenCalled();
    expect([...getPlaylistWindows().values()][0].isDirty).toBe(true);
    const received: PlaylistItem[] = [];
    mocks.instances[0].webContents.send.mockImplementation((channel, item) => {
      if (channel === PLAYLIST_WINDOW_CHANNELS.addItem) received.push(item);
    });
    manager.markPlaylistRendererReady(window.webContents);
    expect(received).toEqual([clip]);
    manager.markPlaylistRendererReady(window.webContents);
    expect(received).toEqual([clip]);
  });

  it('delivers queued sync and clips in order, then sends new clips immediately', () => {
    const window = manager.createPlaylistWindow();
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
    manager.syncToPlaylistWindow(sync);
    manager.addItemToAllWindows(clip);
    manager.addItemToAllWindows({ ...clip, id: 'second' });
    manager.markPlaylistRendererReady(window.webContents);
    expect(mocks.instances[0].webContents.send.mock.calls).toEqual([
      [PLAYLIST_WINDOW_CHANNELS.sync, sync],
      [PLAYLIST_WINDOW_CHANNELS.addItem, clip],
      [PLAYLIST_WINDOW_CHANNELS.addItem, { ...clip, id: 'second' }],
    ]);
    manager.addItemToAllWindows({ ...clip, id: 'third' });
    expect(mocks.instances[0].webContents.send).toHaveBeenLastCalledWith(
      PLAYLIST_WINDOW_CHANNELS.addItem,
      { ...clip, id: 'third' },
    );
  });

  it('holds delivery again on reload and ignores an unknown or destroyed receiver', () => {
    const window = manager.createPlaylistWindow();
    manager.markPlaylistRendererReady(window.webContents);
    mocks.instances[0].webContents.listeners.get('did-start-loading')?.();
    manager.addItemToAllWindows(clip);
    expect(mocks.instances[0].webContents.send).not.toHaveBeenCalled();
    manager.markPlaylistRendererReady({ ...window.webContents });
    expect(mocks.instances[0].webContents.send).not.toHaveBeenCalled();
    mocks.instances[0].destroyed = true;
    manager.markPlaylistRendererReady(window.webContents);
    expect(mocks.instances[0].webContents.send).not.toHaveBeenCalled();
  });

  it('keeps two windows pending independently', () => {
    const first = manager.createPlaylistWindow();
    const second = manager.createPlaylistWindow();
    manager.addItemToAllWindows(clip);
    manager.markPlaylistRendererReady(first.webContents);
    expect(mocks.instances[0].webContents.send).toHaveBeenCalledTimes(1);
    expect(mocks.instances[1].webContents.send).not.toHaveBeenCalled();
    manager.markPlaylistRendererReady(second.webContents);
    expect(mocks.instances[1].webContents.send).toHaveBeenCalledTimes(1);
  });

  it('queues additions only for windows belonging to the sending package session', () => {
    const ownerA = new BrowserWindow();
    const ownerB = new BrowserWindow();
    mocks.getSession.mockImplementation((owner: unknown) =>
      owner === ownerA
        ? { id: 'package-a', mainWindow: ownerA }
        : { id: 'package-b', mainWindow: ownerB },
    );
    const playlistA = manager.createPlaylistWindow(undefined, ownerA);
    const playlistB = manager.createPlaylistWindow(undefined, ownerB);
    manager.addItemToAllWindows(clip, ownerA);
    manager.markPlaylistRendererReady(playlistB.webContents);
    expect(mocks.instances[3].webContents.send).not.toHaveBeenCalled();
    manager.markPlaylistRendererReady(playlistA.webContents);
    expect(mocks.instances[2].webContents.send).toHaveBeenCalledWith(
      PLAYLIST_WINDOW_CHANNELS.addItem,
      clip,
    );
  });
});
