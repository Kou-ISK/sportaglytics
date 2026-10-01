import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANALYSIS_WINDOW_CHANNELS,
  type AnalysisAiPlaylistPayload,
  type AnalysisWindowSyncPayload,
} from '../../src/types/ipc/analysisWindow';

const electronMocks = vi.hoisted(() => {
  const handleHandlers = new Map<string, (...args: unknown[]) => unknown>();
  const onHandlers = new Map<string, (...args: unknown[]) => unknown>();
  const browserWindowFromWebContents = vi.fn();
  const createdWindows: Array<Record<string, unknown>> = [];

  const createBrowserWindowInstance = () => {
    const listeners = new Map<string, (...args: unknown[]) => void>();
    const windowInstance = {
      focus: vi.fn(),
      close: vi.fn(),
      isDestroyed: vi.fn(() => false),
      loadURL: vi.fn(),
      on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
        listeners.set(event, handler);
      }),
      webContents: {
        send: vi.fn(),
        isLoading: vi.fn(() => false),
        once: vi.fn(),
      },
    };
    createdWindows.push(windowInstance);
    return windowInstance;
  };

  const BrowserWindowMock = vi.fn(function BrowserWindowMock() {
    return createBrowserWindowInstance();
  });

  return {
    BrowserWindowMock,
    browserWindowFromWebContents,
    createdWindows,
    handleHandlers,
    onHandlers,
    handle: vi.fn(
      (channel: string, handler: (...args: unknown[]) => unknown) => {
        handleHandlers.set(channel, handler);
      },
    ),
    on: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      onHandlers.set(channel, handler);
    }),
  };
});

vi.mock('electron', () => ({
  BrowserWindow: Object.assign(electronMocks.BrowserWindowMock, {
    fromWebContents: electronMocks.browserWindowFromWebContents,
  }),
  ipcMain: {
    handle: electronMocks.handle,
    on: electronMocks.on,
  },
}));

vi.mock('./windowSecurity', () => ({
  applyWindowSecurity: vi.fn(),
}));

describe('analysisWindow handlers', () => {
  beforeEach(() => {
    vi.resetModules();
    electronMocks.handleHandlers.clear();
    electronMocks.onHandlers.clear();
    electronMocks.handle.mockClear();
    electronMocks.on.mockClear();
    electronMocks.createdWindows.length = 0;
    electronMocks.browserWindowFromWebContents.mockReset();
  });

  it('forwards sync only from the main window with a valid payload', async () => {
    const analysisWindowModule = await import('./analysisWindow');
    const mainSend = vi.fn();
    const mainWindow = {
      isDestroyed: () => false,
      once: vi.fn(),
      webContents: { send: mainSend },
    };

    analysisWindowModule.setAnalysisMainWindowRef(
      mainWindow as unknown as Electron.BrowserWindow,
    );
    await analysisWindowModule.openAnalysisWindow();
    analysisWindowModule.registerAnalysisWindowHandlers();

    const createdWindow = electronMocks.createdWindows[0];
    const syncHandler = electronMocks.onHandlers.get(
      ANALYSIS_WINDOW_CHANNELS.syncToWindow,
    );
    expect(syncHandler).toBeTypeOf('function');

    syncHandler?.({ sender: {} }, { invalid: true });
    expect(createdWindow?.webContents.send).not.toHaveBeenCalled();

    const payload: AnalysisWindowSyncPayload = {
      timeline: [
        {
          id: 'timeline-1',
          actionName: 'Try',
          startTime: 10,
          endTime: 12,
          memo: '',
        },
      ],
      teamNames: ['Alpha', 'Beta'],
      view: 'dashboard',
    };

    syncHandler?.({ sender: mainWindow.webContents }, payload);
    expect(createdWindow?.webContents.send).toHaveBeenCalledWith(
      ANALYSIS_WINDOW_CHANNELS.sync,
      payload,
    );
  });

  it('replays the latest owner snapshot to a ready analysis window, without cross-session access', async () => {
    const module = await import('./analysisWindow');
    const mainWindow = {
      isDestroyed: () => false,
      once: vi.fn(),
      webContents: { send: vi.fn() },
    };
    const otherMain = {
      isDestroyed: () => false,
      once: vi.fn(),
      webContents: { send: vi.fn() },
    };
    module.setAnalysisMainWindowRef(
      mainWindow as unknown as Electron.BrowserWindow,
    );
    const payload: AnalysisWindowSyncPayload = {
      timeline: [
        {
          id: 'scene',
          actionName: 'Try',
          startTime: 1,
          endTime: 2,
          memo: 'latest',
        },
      ],
      teamNames: ['Alpha', 'Beta'],
      view: 'matrix',
    };
    // No analysis window exists when its owner publishes the initial document.
    module.sendAnalysisSync(
      payload,
      mainWindow as unknown as Electron.BrowserWindow,
    );
    await module.openAnalysisWindow(
      mainWindow as unknown as Electron.BrowserWindow,
    );
    await module.openAnalysisWindow(
      otherMain as unknown as Electron.BrowserWindow,
    );
    module.registerAnalysisWindowHandlers();
    const analysis = electronMocks.createdWindows[0];
    const otherAnalysis = electronMocks.createdWindows[1];
    const windows = [mainWindow, otherMain, analysis, otherAnalysis];
    electronMocks.browserWindowFromWebContents.mockImplementation(
      (sender) =>
        windows.find((window) => window?.webContents === sender) ?? null,
    );
    const request = electronMocks.onHandlers.get(
      ANALYSIS_WINDOW_CHANNELS.requestSync,
    );
    expect(request).toBeTypeOf('function');
    request?.({ sender: mainWindow.webContents });
    request?.({ sender: {} });
    request?.({ sender: otherAnalysis?.webContents });
    expect(analysis?.webContents.send).not.toHaveBeenCalled();
    expect(otherAnalysis?.webContents.send).not.toHaveBeenCalled();
    request?.({ sender: analysis?.webContents });
    expect(analysis?.webContents.send).toHaveBeenLastCalledWith(
      ANALYSIS_WINDOW_CHANNELS.sync,
      payload,
    );
    const latest = {
      timeline: [{ ...payload.timeline[0], memo: 'edited' }],
      teamNames: payload.teamNames,
    };
    module.sendAnalysisSync(
      latest,
      mainWindow as unknown as Electron.BrowserWindow,
    );
    analysis?.webContents.send.mockClear();
    // A reload has no new owner edit or open command to trigger a fresh send.
    request?.({ sender: analysis?.webContents });
    expect(analysis?.webContents.send).toHaveBeenCalledExactlyOnceWith(
      ANALYSIS_WINDOW_CHANNELS.sync,
      { ...latest, view: 'matrix' },
    );
  });

  it('forwards AI playlist creation only from the analysis window with a valid payload', async () => {
    const analysisWindowModule = await import('./analysisWindow');
    const mainSend = vi.fn();
    const mainWindow = {
      isDestroyed: () => false,
      once: vi.fn(),
      webContents: { send: mainSend },
    };

    analysisWindowModule.setAnalysisMainWindowRef(
      mainWindow as unknown as Electron.BrowserWindow,
    );
    await analysisWindowModule.openAnalysisWindow();
    analysisWindowModule.registerAnalysisWindowHandlers();

    const createdWindow = electronMocks.createdWindows[0];
    const createAiPlaylistHandler = electronMocks.onHandlers.get(
      ANALYSIS_WINDOW_CHANNELS.createAiPlaylist,
    );
    expect(createAiPlaylistHandler).toBeTypeOf('function');

    createAiPlaylistHandler?.({ sender: {} }, { name: 'AI Review', items: [] });
    expect(mainSend).not.toHaveBeenCalled();

    const payload: AnalysisAiPlaylistPayload = {
      name: 'AI Review',
      items: [
        {
          id: 'playlist-1',
          timelineItemId: 'timeline-1',
          actionName: 'Try',
          startTime: 10,
          endTime: 12,
          addedAt: 1,
        },
      ],
    };

    createAiPlaylistHandler?.({ sender: createdWindow?.webContents }, payload);
    expect(mainSend).toHaveBeenCalledWith(
      ANALYSIS_WINDOW_CHANNELS.createAiPlaylist,
      payload,
    );
  });
});
