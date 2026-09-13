import { getRendererUrl } from './rendererUrl';
import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  type IpcMainEvent,
} from 'electron';
import * as path from 'path';
import { getFfmpegPath } from './mediaTools';
import { registerShortcuts } from './shortCutKey';
import { refreshAppMenu, setRecentPackagePaths } from './menuBar';
import { registerSettingsHandlers, loadSettings } from './settingsManager';
import {
  registerAnalysisWindowHandlers,
  setAnalysisMainWindowRef,
  sendAnalysisDashboardFileToWindow,
} from './analysisWindow';
import {
  registerCodingPanelWindowHandlers,
  openCodingPanelWindow,
  setCodingPanelMainWindowRef,
} from './codingPanelWindow';
import {
  registerPlaylistHandlers,
  setMainWindowRef,
  setFfmpegPath,
  sendPlaylistFileToWindow,
  closePlaylistWindowsForMainWindow,
} from './playlistWindow';
import { registerSettingsWindowHandlers } from './settingsWindow';
import { applyWindowSecurity } from './windowSecurity';
import {
  registerCodeWindowHandlers,
  setPendingCodeWindowExternalOpen,
} from './ipc/codeWindowHandlers';
import { registerDashboardHandlers } from './ipc/dashboardHandlers';
import { registerEventDetectionHandlers } from './ipc/eventDetectionHandlers';
import { registerExportHandlers } from './ipc/exportHandlers';
import { registerExportProgressWindowHandlers } from './exportProgressWindow';
import { registerFileHandlers } from './ipc/fileHandlers';
import { registerLlamaHandlers } from './ipc/llamaHandlers';
import { registerLegacyFileAccessHandlers } from './ipc/legacyFileAccessHandlers';
import { registerMenuStateHandlers } from './ipc/menuStateHandlers';
import { registerPackageHandlers } from './ipc/packageHandlers';
import { registerPackageSessionHandlers } from './ipc/packageSessionHandlers';
import { registerReportHandlers } from './ipc/reportHandlers';
import { registerSyncHandlers } from './ipc/syncHandlers';
import { registerWindowEventHandlers } from './ipc/windowEventHandlers';
import { registerYoutubeEmbedClientIdentity } from './youtubeEmbedIdentity';
import { registerLoopbackAudioCapture } from './loopbackAudioCapture';
import {
  closeTimelineWindowForMainWindow,
  registerTimelineWindowHandlers,
  setTimelineMainWindowRef,
} from './timelineWindow';
import {
  closePackageSessionWindows,
  createPackageSession,
  focusPackageSession,
  getEmptyPackageSession,
  getPackageSessions,
  getPackageSessionForPackagePath,
  getPackageSessionForWindow,
  removePackageSession,
  reservePackageSession,
} from './packageSessionRegistry';
import { createExternalOpenQueue } from './packageOpenQueue';
import { createPackageOpenRouter } from './packageOpenRouter';

if (app?.commandLine) {
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
}

const getResolvedFfmpegPath = (): string => {
  const ffmpegPath = getFfmpegPath();
  if (!ffmpegPath) {
    throw new Error(
      'ffmpeg binary not found. Please ensure a media toolchain is available.',
    );
  }

  if (app.isPackaged) {
    return ffmpegPath.replace('app.asar', 'app.asar.unpacked');
  }

  return ffmpegPath;
};

const mainURL = getRendererUrl('');
const preloadPath = path.join(__dirname, 'preload.js');

const pendingFiles: string[] = process.argv
  .slice(1)
  .map((arg) => ({ arg, ext: path.extname(arg).toLowerCase() }))
  .filter(({ ext }) =>
    ['.stpl', '.stcw', '.stpkg', '.stad', '.json'].includes(ext),
  )
  .map(({ arg }) => arg);
let mainWindow: BrowserWindow | null = null;

const registerMainIpcHandlers = (): void => {
  registerWindowEventHandlers({
    getMainWindow: () => mainWindow,
    onHotkeysUpdated: () => {
      if (!mainWindow || mainWindow.isDestroyed()) {
        return;
      }

      loadSettings().then((updatedSettings) => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          return;
        }
        registerShortcuts(mainWindow, updatedSettings.hotkeys);
      });
    },
    onRecentPackagesUpdated: (paths: string[]) => {
      setRecentPackagePaths(paths);
      refreshAppMenu();
    },
  });

  registerFileHandlers({ getMainWindow: () => mainWindow });
  registerReportHandlers({
    mainURL,
    preloadPath,
    applyWindowSecurity,
  });
  registerDashboardHandlers({ getMainWindow: () => mainWindow });
  registerCodeWindowHandlers({ getMainWindow: () => mainWindow });
  registerExportHandlers({
    getMainWindow: () => mainWindow,
    getFfmpegPath: getResolvedFfmpegPath,
  });
  registerEventDetectionHandlers();
  registerLlamaHandlers();
};

const createWindow = async (): Promise<BrowserWindow> => {
  const window = new BrowserWindow({
    width: 1400,
    height: 1000,
    icon: path.join(__dirname, '../../public/icon.icns'),
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  registerYoutubeEmbedClientIdentity(window.webContents.session);
  applyWindowSecurity(window);
  const preloadReadyTimeout = setTimeout(() => {
    if (!window.isDestroyed()) {
      console.error(
        '[main] preload did not signal ready within 5 seconds. window.electronAPI may be unavailable.',
      );
    }
  }, 5_000);
  const handlePreloadReady = (event: IpcMainEvent) => {
    if (event.sender !== window.webContents) {
      return;
    }
    clearTimeout(preloadReadyTimeout);
    ipcMain.removeListener('preload:ready', handlePreloadReady);
  };
  ipcMain.on('preload:ready', handlePreloadReady);
  window.on('closed', () => {
    clearTimeout(preloadReadyTimeout);
    ipcMain.removeListener('preload:ready', handlePreloadReady);
    closeTimelineWindowForMainWindow(window);
    closePlaylistWindowsForMainWindow(window);
    const packageSession = getPackageSessionForWindow(window);
    if (packageSession) {
      closePackageSessionWindows(packageSession);
      removePackageSession(packageSession);
    }
  });
  mainWindow = window;
  createPackageSession(window);
  setMainWindowRef(window);
  setAnalysisMainWindowRef(window);
  setCodingPanelMainWindowRef(window);
  setTimelineMainWindowRef(window);
  window.loadURL(mainURL);

  await new Promise<void>((resolve) => {
    window.webContents.once('did-finish-load', () => {
      resolve();
    });
  });

  const settings = await loadSettings();
  registerShortcuts(window, settings.hotkeys);
  refreshAppMenu();

  return window;
};

registerLegacyFileAccessHandlers({ getMainWindow: () => mainWindow });
registerPackageHandlers();
registerPackageSessionHandlers();
registerSyncHandlers();
registerMenuStateHandlers();
registerSettingsHandlers();
registerPlaylistHandlers();
registerSettingsWindowHandlers();
registerAnalysisWindowHandlers();
registerCodingPanelWindowHandlers();
registerExportProgressWindowHandlers();
registerTimelineWindowHandlers();
registerMainIpcHandlers();

try {
  setFfmpegPath(getResolvedFfmpegPath());
} catch (error) {
  console.error('Failed to set FFmpeg path:', error);
}

const handleFileOpen = (
  filePath: string,
  targetWindow: BrowserWindow | null = mainWindow,
): void => {
  if (!targetWindow || targetWindow.isDestroyed()) {
    console.warn('Main window not ready, queueing file open:', filePath);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.stpl' || ext === '.json') {
    sendPlaylistFileToWindow(filePath, targetWindow);
  } else if (ext === '.stad') {
    void sendAnalysisDashboardFileToWindow(filePath, targetWindow);
  } else if (ext === '.stcw') {
    setPendingCodeWindowExternalOpen(filePath);
    void openCodingPanelWindow(targetWindow);
    targetWindow.webContents.send('open-code-window-file', filePath);
  } else if (ext === '.stpkg' || !ext) {
    const send = (): void => {
      if (!targetWindow.isDestroyed()) {
        targetWindow.webContents.send('open-package-directory', filePath);
      }
    };
    if (targetWindow.webContents.isLoading()) {
      targetWindow.webContents.once('did-finish-load', send);
    } else {
      send();
    }
  }
};

const getCurrentMainWindow = (): BrowserWindow | null => {
  const focusedWindow = BrowserWindow.getFocusedWindow();
  const focusedSession = getPackageSessionForWindow(focusedWindow);
  if (focusedSession?.mainWindow && !focusedSession.mainWindow.isDestroyed()) {
    return focusedSession.mainWindow;
  }
  if (mainWindow && !mainWindow.isDestroyed()) return mainWindow;
  return (
    getPackageSessions().find((session) => !session.mainWindow.isDestroyed())
      ?.mainWindow ?? null
  );
};

const focusWindow = (window: BrowserWindow): void => {
  const session = getPackageSessionForWindow(window);
  if (session) {
    focusPackageSession(session);
    return;
  }
  if (window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  if (!window.isVisible()) window.show();
  window.focus();
};

let initialWindowPromise: Promise<BrowserWindow> | null = null;

const openPackageInSession = createPackageOpenRouter({
  findByPath: getPackageSessionForPackagePath,
  findEmpty: getEmptyPackageSession,
  createWindow,
  reserve: reservePackageSession,
  focus: focusPackageSession,
  sendOpen: handleFileOpen,
  closeUnusedWindow: (window) => {
    if (!window.isDestroyed()) window.close();
  },
});

const routeExternalOpen = async (filePath: string): Promise<void> => {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.stpkg' || !extension) {
    await openPackageInSession(filePath);
    return;
  }

  let targetWindow = getCurrentMainWindow();
  if (!targetWindow) {
    targetWindow = await createWindow();
  }
  focusWindow(targetWindow);
  handleFileOpen(filePath, targetWindow);
};

const externalOpenQueue = createExternalOpenQueue({
  route: async (filePath) => {
    // The initial empty window is shared by the first external package open.
    // Waiting here also prevents an open-file event during startup from
    // creating a second unnecessary window.
    if (initialWindowPromise) await initialWindowPromise;
    await routeExternalOpen(filePath);
  },
  onError: (filePath, error) => {
    console.error('Failed to route external file open:', filePath, error);
  },
});
for (const filePath of pendingFiles) externalOpenQueue.enqueue(filePath);

const enqueueExternalOpen = (filePath: string): void => {
  externalOpenQueue.enqueue(filePath);
  if (app.isReady()) void externalOpenQueue.drain();
};

const getExternalOpenArguments = (commandLine: string[]): string[] =>
  commandLine
    .filter((arg) => !arg.startsWith('-'))
    .filter((arg) =>
      ['.stpl', '.stcw', '.stpkg', '.stad', '.json'].includes(
        path.extname(arg).toLowerCase(),
      ),
    );

const hasSingleInstanceLock = app.requestSingleInstanceLock();

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  enqueueExternalOpen(filePath);
});

if (hasSingleInstanceLock) {
  app.on('second-instance', (_event, commandLine) => {
    for (const filePath of getExternalOpenArguments(commandLine)) {
      enqueueExternalOpen(filePath);
    }
  });
}

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  registerLoopbackAudioCapture(session.defaultSession);
  initialWindowPromise = createWindow();
  await initialWindowPromise;
  void externalOpenQueue.drain();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      initialWindowPromise = createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
