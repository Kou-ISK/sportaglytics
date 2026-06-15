import { app, BrowserWindow, ipcMain, type IpcMainEvent } from 'electron';
import * as path from 'path';
import ffmpegPath from 'ffmpeg-static';
import { registerShortcuts } from './shortCutKey';
import { refreshAppMenu, setRecentPackagePaths } from './menuBar';
import { registerSettingsHandlers, loadSettings } from './settingsManager';
import {
  registerAnalysisWindowHandlers,
  setAnalysisMainWindowRef,
  sendAnalysisDashboardFileToWindow,
} from './analysisWindow';
import {
  registerPlaylistHandlers,
  setMainWindowRef,
  setFfmpegPath,
  sendPlaylistFileToWindow,
} from './playlistWindow';
import { registerSettingsWindowHandlers } from './settingsWindow';
import { applyWindowSecurity } from './windowSecurity';
import { registerCodeWindowHandlers, setPendingCodeWindowExternalOpen } from './ipc/codeWindowHandlers';
import { registerDashboardHandlers } from './ipc/dashboardHandlers';
import { registerExportHandlers } from './ipc/exportHandlers';
import { registerExportProgressWindowHandlers } from './exportProgressWindow';
import { registerFileHandlers } from './ipc/fileHandlers';
import { registerLlamaHandlers } from './ipc/llamaHandlers';
import { registerLegacyFileAccessHandlers } from './ipc/legacyFileAccessHandlers';
import { registerMenuStateHandlers } from './ipc/menuStateHandlers';
import { registerPackageHandlers } from './ipc/packageHandlers';
import { registerReportHandlers } from './ipc/reportHandlers';
import { registerSyncHandlers } from './ipc/syncHandlers';
import { registerWindowEventHandlers } from './ipc/windowEventHandlers';

if (app?.commandLine) {
  app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
}

const getFfmpegPath = (): string => {
  if (!ffmpegPath) {
    throw new Error(
      'ffmpeg binary not found. Please ensure ffmpeg-static is properly installed.',
    );
  }

  if (app.isPackaged) {
    return ffmpegPath.replace('app.asar', 'app.asar.unpacked');
  }

  return ffmpegPath;
};

const mainURL = `file:${__dirname}/../../index.html`;
const preloadPath = path.join(__dirname, 'preload.js');

const pickFileArg = (argv: string[]): string | null => {
  return (
    argv.find((arg) => {
      const ext = path.extname(arg).toLowerCase();
      return (
        ext === '.stpl' ||
        ext === '.stcw' ||
        ext === '.stpkg' ||
        ext === '.stad' ||
        ext === '.json'
      );
    }) || null
  );
};

let pendingFile: string | null = pickFileArg(process.argv.slice(1));
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
    getFfmpegPath,
  });
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
  });
  mainWindow = window;
  setMainWindowRef(window);
  setAnalysisMainWindowRef(window);
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
registerSyncHandlers();
registerMenuStateHandlers();
registerSettingsHandlers();
registerPlaylistHandlers();
registerSettingsWindowHandlers();
registerAnalysisWindowHandlers();
registerExportProgressWindowHandlers();
registerMainIpcHandlers();

try {
  setFfmpegPath(getFfmpegPath());
} catch (error) {
  console.error('Failed to set FFmpeg path:', error);
}

const handleFileOpen = (filePath: string): void => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    console.warn('Main window not ready, queueing file open:', filePath);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.stpl' || ext === '.json') {
    sendPlaylistFileToWindow(filePath);
  } else if (ext === '.stad') {
    void sendAnalysisDashboardFileToWindow(filePath);
  } else if (ext === '.stcw') {
    setPendingCodeWindowExternalOpen(filePath);
    mainWindow.webContents.send('open-code-window-file', filePath);
  } else if (ext === '.stpkg' || !ext) {
    mainWindow.webContents.send('open-package-directory', filePath);
  }
};

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  pendingFile = filePath;
  if (app.isReady() && mainWindow && !mainWindow.isDestroyed()) {
    handleFileOpen(filePath);
  }
});

app.whenReady().then(async () => {
  await createWindow();
  if (pendingFile) {
    handleFileOpen(pendingFile);
    pendingFile = null;
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
