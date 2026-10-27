import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import { getRendererUrl } from '../rendererUrl';
import { TIMELINE_WINDOW_CHANNELS } from '../../../src/types/ipc/timelineWindow';
import { openClipExportFromMenu } from './clipExportMenuAction';
import {
  openTimelineWindow,
  registerTimelineWindowHandlers,
} from '../timelineWindow';
import {
  getPackageSessionForWindow,
  getPackageSessions,
  registerAuxiliaryWindow,
  removePackageSession,
  reservePackageSession,
} from '../packageSessionRegistry';

const { playlistSenders } = vi.hoisted(() => ({
  playlistSenders: new Set<unknown>(),
}));
vi.mock('../playlistWindow/windowManager', () => ({
  isSenderPlaylistWindow: (sender: unknown) => playlistSenders.has(sender),
}));
vi.mock('../windowSecurity', () => ({ applyWindowSecurity: vi.fn() }));
vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events');
  const windows: FakeWindow[] = [];
  let focusedId: number | null = null;
  class FakeWindow extends EventEmitter {
    id = windows.length + 1;
    destroyed = false;
    minimized = false;
    webContents = Object.assign(new EventEmitter(), {
      send: vi.fn(),
      mainFrame: { url: getRendererUrl() },
      getURL: () => getRendererUrl(),
      isDestroyed: () => this.destroyed,
    });
    constructor(options: Electron.BrowserWindowConstructorOptions = {}) {
      super();
      windows.push(this);
      if (options.show !== false) focusedId = this.id;
    }
    static getAllWindows() {
      return windows.filter((window) => !window.destroyed);
    }
    static getFocusedWindow() {
      return windows.find((window) => window.id === focusedId) ?? null;
    }
    static fromWebContents(sender: unknown) {
      return windows.find((window) => window.webContents === sender) ?? null;
    }
    isDestroyed() {
      return this.destroyed;
    }
    isMinimized() {
      return this.minimized;
    }
    minimize() {
      this.minimized = true;
    }
    restore() {
      this.minimized = false;
    }
    focus() {
      focusedId = this.id;
    }
    title = '';
    setTitle(title: string) {
      this.title = title;
    }
    getTitle() {
      return this.title;
    }
    showInactive = vi.fn();
    show = vi.fn();
    loadURL() {
      return Promise.resolve();
    }
    getBounds() {
      return { x: 0, y: 0, width: 1280, height: 430 };
    }
    close() {
      this.emit('close');
      this.destroyed = true;
      this.emit('closed');
    }
  }
  return {
    BrowserWindow: FakeWindow,
    ipcMain: Object.assign(new EventEmitter(), { handle: vi.fn() }),
    dialog: { showMessageBox: vi.fn().mockResolvedValue({ response: 0 }) },
  };
});

const ready = (window: BrowserWindow, value: unknown = true): void => {
  ipcMain.emit(
    TIMELINE_WINDOW_CHANNELS.command,
    { sender: window.webContents, senderFrame: window.webContents.mainFrame },
    {
      type: 'clip-export-ready',
      ready: value,
    },
  );
};
const ownerWithPackage = (name: string): BrowserWindow => {
  const window = new BrowserWindow();
  reservePackageSession(window, `${name}.stpkg`);
  return window;
};
const timelineFor = (owner: BrowserWindow): BrowserWindow => {
  const timeline = [
    ...(getPackageSessionForWindow(owner)?.auxiliaryWindows ?? []),
  ].at(-1);
  if (!timeline) throw new Error('Timeline was not opened');
  return timeline;
};

describe('native clip export routing and Timeline readiness', () => {
  let openHandler: Parameters<typeof ipcMain.handle>[1] | undefined;
  beforeAll(() => {
    registerTimelineWindowHandlers();
    openHandler = vi
      .mocked(ipcMain.handle)
      .mock.calls.find(
        ([channel]) => channel === TIMELINE_WINDOW_CHANNELS.openWindow,
      )?.[1];
  });
  afterEach(() => {
    for (const window of BrowserWindow.getAllWindows()) window.close();
    for (const session of getPackageSessions()) removePackageSession(session);
    playlistSenders.clear();
    vi.clearAllMocks();
  });

  it('shows an automatic Timeline without taking focus and preserves role titles', async () => {
    const owner = ownerWithPackage('automatic');
    owner.focus();
    await openTimelineWindow(owner, false);
    const timeline = timelineFor(owner);
    timeline.emit('ready-to-show');
    expect(BrowserWindow.getFocusedWindow()).toBe(owner);
    expect(timeline.showInactive).toHaveBeenCalledOnce();
    expect(timeline.getTitle()).toBe('タイムライン — SporTagLytics');
    const event = { preventDefault: vi.fn() };
    timeline.emit('page-title-updated', event, 'SporTagLytics');
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(timeline.getTitle()).toBe('タイムライン — SporTagLytics');
    timeline.minimize();
    await openTimelineWindow(owner, false);
    expect(timeline.isMinimized()).toBe(true);
    expect(BrowserWindow.getFocusedWindow()).toBe(owner);
    await openTimelineWindow(owner);
    expect(timeline.isMinimized()).toBe(false);
    expect(BrowserWindow.getFocusedWindow()).toBe(timeline);
  });

  it('rejects invalid automatic-open options before opening a window', async () => {
    const owner = ownerWithPackage('options');
    const handler = openHandler;
    expect(handler).toBeDefined();
    // Partial Electron event fixture: only validated sender/frame fields are used.
    const event = {
      sender: owner.webContents,
      senderFrame: owner.webContents.mainFrame,
    } as Electron.IpcMainInvokeEvent;
    for (const options of [
      null,
      false,
      { activate: 'false' },
      { activate: false, path: '/fixture' },
    ])
      await expect(handler?.(event, options)).rejects.toThrow(
        'Invalid timeline window open options',
      );
    expect(getPackageSessionForWindow(owner)?.auxiliaryWindows.size).toBe(0);
  });

  it('accepts inactive opening only from the owning main frame and keeps explicit opens active', async () => {
    const owner = ownerWithPackage('ipc-options');
    const handler = openHandler;
    if (!handler) throw Error('Missing open handler');
    // Partial Electron event fixture: only validated sender/frame fields are used.
    const event = {
      sender: owner.webContents,
      senderFrame: owner.webContents.mainFrame,
    } as Electron.IpcMainInvokeEvent;
    await handler(event, { activate: false });
    const timeline = timelineFor(owner);
    timeline.emit('ready-to-show');
    expect(BrowserWindow.getFocusedWindow()).toBe(owner);
    const auxiliaryEvent = {
      sender: timeline.webContents,
      senderFrame: timeline.webContents.mainFrame,
    } as Electron.IpcMainInvokeEvent;
    await expect(handler(auxiliaryEvent, { activate: false })).rejects.toThrow(
      'Invalid timeline window open sender',
    );
    await handler(event);
    expect(BrowserWindow.getFocusedWindow()).toBe(timeline);
  });

  it('queues until the matching Timeline is ready and isolates package windows', async () => {
    const first = ownerWithPackage('first');
    const second = ownerWithPackage('second');
    await openClipExportFromMenu(first);
    await openClipExportFromMenu(second);
    const firstTimeline = timelineFor(first);
    const secondTimeline = timelineFor(second);
    expect(firstTimeline.webContents.send).not.toHaveBeenCalled();
    ready(first); // A main renderer cannot impersonate Timeline readiness.
    ready(firstTimeline, 'true');
    expect(firstTimeline.webContents.send).not.toHaveBeenCalled();
    ready(firstTimeline);
    expect(firstTimeline.webContents.send).toHaveBeenCalledExactlyOnceWith(
      'menu-export-clips',
    );
    expect(secondTimeline.webContents.send).not.toHaveBeenCalled();
    ready(secondTimeline);
    expect(secondTimeline.webContents.send).toHaveBeenCalledExactlyOnceWith(
      'menu-export-clips',
    );
    ready(firstTimeline);
    expect(firstTimeline.webContents.send).toHaveBeenCalledTimes(1);
  });

  it('routes auxiliary and focused Timeline menus to their owner and restores minimization', async () => {
    const owner = ownerWithPackage('owner');
    const coding = new BrowserWindow();
    const session = getPackageSessionForWindow(owner);
    if (!session) throw new Error('Missing session');
    registerAuxiliaryWindow(session, coding);
    await openClipExportFromMenu(coding);
    const timeline = timelineFor(owner);
    ready(timeline);
    expect(coding.webContents.send).not.toHaveBeenCalled();
    timeline.minimize();
    timeline.focus();
    await openClipExportFromMenu();
    expect(timeline.isMinimized()).toBe(false);
    expect(timeline.webContents.send).toHaveBeenCalledTimes(2);
  });

  it('waits again after unsubscribe, reload and close without replaying consumed requests', async () => {
    const owner = ownerWithPackage('reopen');
    await openClipExportFromMenu(owner);
    const timeline = timelineFor(owner);
    ready(timeline);
    ready(timeline, false);
    await openClipExportFromMenu(owner);
    expect(timeline.webContents.send).toHaveBeenCalledTimes(1);
    ready(timeline);
    expect(timeline.webContents.send).toHaveBeenCalledTimes(2);
    timeline.webContents.emit('did-start-loading');
    await openClipExportFromMenu(owner);
    expect(timeline.webContents.send).toHaveBeenCalledTimes(2);
    timeline.close();
    await openClipExportFromMenu(owner);
    const reopened = timelineFor(owner);
    ready(timeline); // A stale sender cannot consume the replacement window's request.
    expect(reopened.webContents.send).not.toHaveBeenCalled();
    ready(reopened);
    ready(reopened);
    expect(reopened.webContents.send).toHaveBeenCalledExactlyOnceWith(
      'menu-export-clips',
    );
  });

  it('exports the focused Playlist even without a loaded package', async () => {
    const playlist = new BrowserWindow();
    playlistSenders.add(playlist.webContents);
    await openClipExportFromMenu(playlist);
    expect(playlist.webContents.send).toHaveBeenCalledExactlyOnceWith(
      'menu-export-clips',
    );
    expect(BrowserWindow.getAllWindows()).toHaveLength(1);
  });

  it('explains unavailable exports without falling back to another loaded package', async () => {
    const unrelated = ownerWithPackage('other');
    const launcher = new BrowserWindow();
    await openClipExportFromMenu(launcher);
    expect(dialog.showMessageBox).toHaveBeenCalledOnce();
    expect(unrelated.webContents.send).not.toHaveBeenCalled();
    expect(BrowserWindow.getAllWindows()).toHaveLength(2);
  });
});
