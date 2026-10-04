// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ipcRenderer } from 'electron';
import { PLAYLIST_WINDOW_CHANNELS } from '../../../src/types/ipc/playlistWindow';
import type { Playlist } from '../../../src/types/playlist/core';
import { createPlaylistBridge } from '../preload/playlistBridge';
import { usePlaylistLoader } from '../../../src/features/playlist/hooks/playlist/usePlaylistLoader';
import { usePlaylistHistory } from '../../../src/features/playlist/hooks/playlist/usePlaylistHistory';
import { usePlaylistWindowCoreState } from '../../../src/features/playlist/hooks/playlist/usePlaylistWindowCoreState';
import { usePlaylistWindowSync } from '../../../src/features/playlist/hooks/playlist/usePlaylistWindowSync';
import { registerPlaylistHandlers } from './handlers';
import { createPlaylistWindow, getWindowInfoBySender } from './windowManager';
import { getPlaylistWindows, setFfmpegPathRef } from './state';

const transport = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => unknown;
  const main = new Map<string, Handler>();
  const messages = new Map<string, Handler>();
  const renderer = new Map<string, Set<Handler>>();
  class Window {
    destroyed = false;
    listeners = new Map<string, Handler>();
    webContents = {
      isDestroyed: () => this.destroyed,
      isLoading: () => false,
      on: vi.fn(),
      send: (channel: string, ...args: unknown[]): void => {
        for (const listener of renderer.get(channel) ?? [])
          listener({}, ...args);
      },
    };
    loadURL = vi.fn();
    setMenuBarVisibility = vi.fn();
    setTitle = vi.fn();
    focus = vi.fn();
    isDestroyed = (): boolean => this.destroyed;
    on = (name: string, listener: Handler): void => {
      this.listeners.set(name, listener);
    };
    close = async (): Promise<void> => {
      const event = { preventDefault: vi.fn() };
      await this.listeners.get('close')?.(event);
      if (!event.preventDefault.mock.calls.length) this.destroy();
    };
    destroy = (): void => {
      this.destroyed = true;
      this.listeners.get('closed')?.();
    };
    static fromWebContents(sender: unknown): Window | null {
      return instances.find((win) => win.webContents === sender) ?? null;
    }
    constructor() {
      instances.push(this);
    }
  }
  const instances: Window[] = [];
  const event = (): { sender: Window['webContents'] } => ({
    sender: instances[0].webContents,
  });
  const rendererIpc = {
    invoke: (channel: string, ...args: unknown[]): Promise<unknown> =>
      Promise.resolve(main.get(channel)?.(event(), ...args)),
    send: (channel: string, ...args: unknown[]): void => {
      const senderEvent = event();
      queueMicrotask(() => messages.get(channel)?.(senderEvent, ...args));
    },
    on: (channel: string, listener: Handler): void => {
      const listeners = renderer.get(channel) ?? new Set();
      listeners.add(listener);
      renderer.set(channel, listeners);
    },
    removeListener: (channel: string, listener: Handler): void => {
      renderer.get(channel)?.delete(listener);
    },
  };
  return {
    Window,
    instances,
    main,
    messages,
    renderer,
    rendererIpc,
    held: new Map<string, { started: boolean; promise: Promise<void> }>(),
    showMessageBox: vi.fn(async () => ({ response: 2 })),
    showSaveDialog: vi.fn(),
  };
});

vi.mock('electron', () => ({
  BrowserWindow: transport.Window,
  ipcRenderer: transport.rendererIpc,
  ipcMain: {
    handle: (channel: string, handler: (...args: unknown[]) => unknown) =>
      transport.main.set(channel, handler),
    on: (channel: string, handler: (...args: unknown[]) => unknown) =>
      transport.messages.set(channel, handler),
  },
  dialog: {
    showMessageBox: transport.showMessageBox,
    showSaveDialog: transport.showSaveDialog,
    showErrorBox: vi.fn(),
  },
  app: { getPath: () => '/unused-synthetic-profile' },
}));
vi.mock('../rendererUrl', () => ({ getRendererUrl: () => 'file:///fixture' }));
vi.mock('../windowSecurity', () => ({ applyWindowSecurity: vi.fn() }));
vi.mock('../packageSessionRegistry', () => ({
  createPackageSession: vi.fn(),
  getPackageSessionForWindow: vi.fn(),
  getPackageSessionForSender: vi.fn(),
  registerAuxiliaryWindow: vi.fn(),
  unregisterAuxiliaryWindow: vi.fn(),
}));
vi.mock('../ipc/windowSenderGuards', () => ({
  getValidatedEventSenderWindow: (event: { sender: unknown }) =>
    transport.Window.fromWebContents(event.sender),
  isEventFromWindow: vi.fn(),
}));
vi.mock('./mediaReferenceHandlers', () => ({
  registerPlaylistMediaReferenceHandlers: vi.fn(),
}));
// Read real A/B fixtures first, then control only their result delivery.
// The production atomic writer remains untouched.
vi.mock('./storage', async (importOriginal) => {
  const original = await importOriginal<typeof import('./storage')>();
  return {
    ...original,
    loadPlaylistFromPath: async (target: string): Promise<Playlist> => {
      const snapshot = await original.loadPlaylistFromPath(target);
      const held = transport.held.get(target);
      if (held) {
        held.started = true;
        await held.promise;
      }
      return snapshot;
    },
  };
});

let root: string;
const fixture = (name: string): Playlist => ({
  id: name,
  name,
  type: 'reference',
  createdAt: 1,
  updatedAt: 1,
  items: [
    {
      id: name,
      actionName: name,
      timelineItemId: null,
      startTime: 0,
      endTime: 5,
      addedAt: 1,
      note: 'original',
    },
  ],
});
const file = (name: string): string => path.join(root, `${name}.stpl`);
const bytes = (name: string): Promise<string> =>
  fs.readFile(path.join(file(name), 'playlist.json'), 'utf8');
const hold = (name: string): (() => void) => {
  let release = (): void => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  transport.held.set(file(name), { started: false, promise });
  return release;
};
const useHarness = () => {
  const core = usePlaylistWindowCoreState();
  const history = usePlaylistHistory([]);
  const loader = usePlaylistLoader({
    ...core,
    setItemsWithHistory: history.setItems,
  });
  usePlaylistWindowSync({
    playlistName: core.playlistName,
    isDirty: core.hasUnsavedChanges,
  });
  return {
    core,
    history,
    loader,
    edit: (): void => {
      history.setItems((items) =>
        items.map((item) => ({ ...item, note: 'new edit' })),
      );
      core.setHasUnsavedChanges(true);
    },
    payload: (): Playlist => ({
      ...fixture(core.playlistName),
      items: history.items,
    }),
  };
};
const info = () => getWindowInfoBySender(transport.instances[0].webContents);

beforeEach(async () => {
  transport.instances.length = 0;
  transport.main.clear();
  transport.messages.clear();
  transport.renderer.clear();
  transport.held.clear();
  transport.showMessageBox.mockClear();
  getPlaylistWindows().clear();
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'playlist-document-'));
  for (const name of ['A', 'B']) {
    await fs.mkdir(file(name));
    await fs.writeFile(
      path.join(file(name), 'playlist.json'),
      JSON.stringify(fixture(name)),
    );
  }
  registerPlaylistHandlers();
  setFfmpegPathRef('synthetic-unused-ffmpeg');
  createPlaylistWindow();
  Object.defineProperty(window, 'electronAPI', {
    configurable: true,
    value: createPlaylistBridge(ipcRenderer, new Map()),
  });
});
afterEach(async () => {
  cleanup();
  getPlaylistWindows().clear();
  await fs.rm(root, { recursive: true, force: true });
});

it('keeps a same-document edit dirty after held load completion and still prompts on Close', async () => {
  const { result } = renderHook(useHarness);
  await act(() => result.current.loader.loadPlaylistFromPath(file('A')));
  const release = hold('A');
  let load: Promise<void> = Promise.resolve();
  act(() => {
    load = result.current.loader.loadPlaylistFromPath(file('A'));
  });
  await vi.waitFor(() =>
    expect(transport.held.get(file('A'))?.started).toBe(true),
  );
  await act(async () => result.current.edit());
  expect(info()?.isDirty).toBe(true);
  await act(async () => {
    release();
    await load;
  });
  expect(result.current.history.items[0].note).toBe('new edit');
  expect(info()?.isDirty).toBe(true);
  await transport.instances[0].close();
  expect(transport.showMessageBox).toHaveBeenCalledWith(
    transport.instances[0],
    expect.objectContaining({ title: '未保存の変更' }),
  );
  expect(transport.instances[0].destroyed).toBe(false);
});

it('keeps A as the actual Save destination when an edit rejects the held B snapshot', async () => {
  const { result } = renderHook(useHarness);
  await act(() => result.current.loader.loadPlaylistFromPath(file('A')));
  const originalB = await bytes('B');
  const release = hold('B');
  let load: Promise<void> = Promise.resolve();
  act(() => {
    load = result.current.loader.loadPlaylistFromPath(file('B'));
  });
  await vi.waitFor(() =>
    expect(transport.held.get(file('B'))?.started).toBe(true),
  );
  await act(async () => result.current.edit());
  await act(async () => {
    release();
    await load;
  });
  expect(result.current.core.loadedFilePath).toBe(file('A'));
  const saved = await window.electronAPI.playlist.savePlaylistFile(
    result.current.payload(),
  );
  expect(saved).toBe(file('A'));
  expect(info()?.filePath).toBe(file('A'));
  expect(JSON.parse(await bytes('A')).items[0].note).toBe('new edit');
  expect(await bytes('B')).toBe(originalB);
});

it('keeps B in both processes and saves only B when A finishes after B', async () => {
  const { result } = renderHook(useHarness);
  const originalA = await bytes('A');
  const release = hold('A');
  let old: Promise<void> = Promise.resolve();
  act(() => {
    old = result.current.loader.loadPlaylistFromPath(file('A'));
  });
  await vi.waitFor(() =>
    expect(transport.held.get(file('A'))?.started).toBe(true),
  );
  await act(() => result.current.loader.loadPlaylistFromPath(file('B')));
  await act(async () => {
    release();
    await old;
  });
  expect(result.current.core.loadedFilePath).toBe(file('B'));
  await act(async () => result.current.edit());
  const saved = await window.electronAPI.playlist.savePlaylistFile(
    result.current.payload(),
  );
  expect(saved).toBe(file('B'));
  expect(info()?.filePath).toBe(file('B'));
  expect(JSON.parse(await bytes('B')).items[0].note).toBe('new edit');
  expect(await bytes('A')).toBe(originalA);
});

it('requires the matching live window ticket and ignores duplicate acceptance', async () => {
  const loaded = await window.electronAPI.playlist.loadPlaylistFile(file('A'));
  expect(loaded?.loadId).toBeTypeOf('string');
  expect(info()?.filePath).toBeNull();
  const other = createPlaylistWindow();
  const command = transport.messages.get(PLAYLIST_WINDOW_CHANNELS.command);
  command?.(
    { sender: other.webContents },
    { type: 'accept-loaded-document', loadId: loaded?.loadId },
  );
  command?.(
    { sender: transport.instances[0].webContents },
    { type: 'accept-loaded-document', loadId: 'unknown' },
  );
  expect(info()?.filePath).toBeNull();
  expect(getWindowInfoBySender(other.webContents)?.filePath).toBeNull();
  window.electronAPI.playlist.sendCommand({
    type: 'accept-loaded-document',
    loadId: loaded?.loadId ?? '',
  });
  await Promise.resolve();
  expect(info()?.filePath).toBe(file('A'));
  const next = await window.electronAPI.playlist.loadPlaylistFile(file('B'));
  window.electronAPI.playlist.sendCommand({
    type: 'accept-loaded-document',
    loadId: next?.loadId ?? '',
  });
  await Promise.resolve();
  window.electronAPI.playlist.sendCommand({
    type: 'accept-loaded-document',
    loadId: loaded?.loadId ?? '',
  });
  await Promise.resolve();
  expect(info()?.filePath).toBe(file('B'));
});

it('keeps initial open intent separate from the save target and invalidates tickets on reload', async () => {
  const initial = createPlaylistWindow(file('A'));
  expect(getWindowInfoBySender(initial.webContents)?.filePath).toBeNull();
  expect(getWindowInfoBySender(initial.webContents)?.initialFilePath).toBe(
    file('A'),
  );
  const loaded = await window.electronAPI.playlist.loadPlaylistFile(file('A'));
  const loading = transport.instances[0].webContents.on.mock.calls.find(
    ([name]) => name === 'did-start-loading',
  )?.[1];
  expect(loading).toBeTypeOf('function');
  loading();
  window.electronAPI.playlist.sendCommand({
    type: 'accept-loaded-document',
    loadId: loaded?.loadId ?? '',
  });
  await Promise.resolve();
  expect(info()?.filePath).toBeNull();
});
