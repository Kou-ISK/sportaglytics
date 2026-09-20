import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, dialog, ipcMain } from 'electron';
import { TIMELINE_WINDOW_CHANNELS } from '../../../src/types/ipc/timelineWindow';
import { openClipExportFromMenu } from './clipExportMenuAction';
import { registerTimelineWindowHandlers } from '../timelineWindow';
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
vi.mock('../rendererUrl', () => ({ getRendererUrl: () => 'app://timeline' }));
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
      isDestroyed: () => this.destroyed,
    });
    constructor() {
      super();
      windows.push(this);
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
    show() {}
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
    { sender: window.webContents },
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
  beforeAll(() => registerTimelineWindowHandlers());
  afterEach(() => {
    for (const window of BrowserWindow.getAllWindows()) window.close();
    for (const session of getPackageSessions()) removePackageSession(session);
    playlistSenders.clear();
    vi.clearAllMocks();
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
