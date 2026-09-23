import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  powerSaveBlocker,
  type IpcMainInvokeEvent,
} from 'electron';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { LIVE_CAPTURE_CHANNELS as channels } from '../../../src/types/ipc/liveCapture';
import type { CaptureSnapshot } from '../../../src/types/liveCapture';
import {
  isCaptureChunk,
  isCaptureIdentifier,
  isCaptureStartRequest,
} from '../../../src/shared/liveCapture/validation';
import { getFfmpegPath } from '../mediaTools';
import {
  setPackageWindowContext,
  focusPackageSession,
  getPackageSessionForPackagePath,
  getPackageSessionForSender,
} from '../packageSessionRegistry';
import { CaptureSession } from './captureSession';
import {
  authorizeCaptureDevices,
  getCaptureWindow,
  openLiveCaptureWindow,
  setCaptureWindowLifecycle,
} from './captureWindow';

const exec = promisify(execFile);

const isOwner = (event: IpcMainInvokeEvent): boolean =>
  !event.sender.isDestroyed() &&
  event.sender === getCaptureWindow()?.webContents &&
  event.senderFrame === event.sender.mainFrame;

export const registerLiveCaptureHandlers = (options: {
  openPackage: (directory: string) => Promise<void>;
}): void => {
  let current: CaptureSession | undefined;
  let starting = false;
  let sleepBlocker: number | undefined;
  const releaseSleepBlocker = (): void => {
    if (sleepBlocker !== undefined) powerSaveBlocker.stop(sleepBlocker);
    sleepBlocker = undefined;
  };
  let opened = false;
  let quitting = false;
  let finishingQuit = false;
  const active = (): boolean =>
    starting ||
    Boolean(
      current && ['recording', 'stopping'].includes(current.snapshot.phase),
    );
  const ownedSession = (
    event: IpcMainInvokeEvent,
    id: unknown,
  ): CaptureSession => {
    if (!isOwner(event) || !isCaptureIdentifier(id) || current?.id !== id)
      throw new Error('この録画を操作する権限がありません。');
    return current;
  };
  const publish = (state: CaptureSnapshot): void => {
    if (state.phase === 'completed' || state.phase === 'error')
      releaseSleepBlocker();
    const captureWindow = getCaptureWindow();
    captureWindow?.webContents.send(channels.state, state);
    const packageSession = getPackageSessionForPackagePath(state.packagePath);
    if (captureWindow && packageSession)
      setPackageWindowContext(captureWindow, packageSession);
    const target = packageSession?.mainWindow;
    if (target && !target.isDestroyed()) {
      target.webContents.setBackgroundThrottling(
        !['recording', 'stopping'].includes(state.phase),
      );
      target.webContents.send(channels.state, state);
    }
    const hasMedia = state.mediaAngles.some((angle) => angle.clips.length > 0);
    const ready =
      state.inputs.every(
        (input) =>
          input.segmentCount > 0 ||
          input.phase === 'disconnected' ||
          input.phase === 'stopped',
      ) || ['completed', 'error'].includes(state.phase);
    if (!opened && hasMedia && ready) {
      opened = true;
      void options
        .openPackage(state.packagePath)
        .then(() => {
          if (current?.id !== state.id) return;
          const session = getPackageSessionForPackagePath(state.packagePath);
          const window = getCaptureWindow();
          if (session && window) {
            setPackageWindowContext(window, session);
            if (current.snapshot.phase === 'recording') window.hide();
            focusPackageSession(session);
          }
        })
        .catch(() => {
          if (current?.id === state.id) opened = false;
        });
    }
  };
  const stopSafely = async (): Promise<void> => {
    if (!current) return;
    if (current.snapshot.phase === 'recording' && getCaptureWindow()) {
      getCaptureWindow()?.webContents.send(channels.stopRequested);
      // Give MediaRecorder a bounded opportunity to deliver its final chunk.
      const deadline = Date.now() + 4000;
      while (current.snapshot.phase === 'recording' && Date.now() < deadline)
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
    }
    await current.stop();
  };
  setCaptureWindowLifecycle({ canClose: () => !active(), stop: stopSafely });
  app.on('before-quit', (event) => {
    if (quitting || !active()) return;
    event.preventDefault();
    if (finishingQuit) return;
    finishingQuit = true;
    void stopSafely().finally(() => {
      quitting = true;
      app.quit();
    });
  });
  ipcMain.handle(channels.open, (event) => {
    if (
      !BrowserWindow.fromWebContents(event.sender) ||
      event.senderFrame !== event.sender.mainFrame
    )
      throw new Error('Invalid capture sender');
    openLiveCaptureWindow();
  });
  ipcMain.handle(channels.hide, (event) => {
    if (!isOwner(event)) throw new Error('Invalid capture sender');
    if (!active()) return;
    getCaptureWindow()?.hide();
    if (current) {
      const session = getPackageSessionForPackagePath(current.packagePath);
      if (session) focusPackageSession(session);
    }
  });
  ipcMain.handle(channels.authorize, (event) => {
    if (!isOwner(event)) throw new Error('Invalid capture sender');
    authorizeCaptureDevices();
  });
  ipcMain.handle(channels.capabilities, async (event) => {
    if (!isOwner(event)) throw new Error('Invalid capture sender');
    const { stdout } = await exec(
      getFfmpegPath(),
      ['-hide_banner', '-protocols'],
      { timeout: 10000, maxBuffer: 65536, windowsHide: true },
    );
    return {
      network: ['http', 'https', 'tcp', 'rtmp'].every((protocol) =>
        stdout.split(/\s+/).includes(protocol),
      ),
    };
  });
  ipcMain.handle(channels.start, async (event, request: unknown) => {
    if (!isOwner(event) || !isCaptureStartRequest(request))
      throw new Error('録画の設定が正しくありません。');
    if (starting || active()) throw new Error('別の録画が実行中です。');
    starting = true;
    try {
      const owner = getCaptureWindow();
      if (!owner) throw new Error('録画ウィンドウが閉じています。');
      const destination = await dialog.showSaveDialog(owner, {
        title: 'ライブ録画パッケージを作成',
        defaultPath: `${request.name}.stpkg`,
        filters: [{ name: 'SporTagLytics Package', extensions: ['stpkg'] }],
      });
      if (destination.canceled || !destination.filePath) return null;
      if (!isOwner(event) || owner.isDestroyed())
        throw new Error('録画ウィンドウが閉じています。');
      const directory = /\.stpkg$/i.test(destination.filePath)
        ? destination.filePath
        : `${destination.filePath}.stpkg`;
      opened = false;
      const capture = new CaptureSession(
        directory,
        request,
        getFfmpegPath(),
        publish,
      );
      current = capture;
      sleepBlocker = powerSaveBlocker.start('prevent-app-suspension');
      try {
        await capture.start();
      } catch {
        releaseSleepBlocker();
        current = undefined;
        throw new Error(
          '録画を開始できませんでした。空き容量、保存先、同名パッケージの有無を確認してください。',
        );
      }
      return capture.snapshot;
    } finally {
      starting = false;
    }
  });
  ipcMain.handle(channels.append, async (event, chunk: unknown) => {
    if (!isCaptureChunk(chunk)) throw new Error('Invalid capture data');
    await ownedSession(event, chunk.sessionId).append(chunk);
  });
  ipcMain.handle(
    channels.endInput,
    async (event, id: unknown, inputId: unknown) => {
      if (!isCaptureIdentifier(inputId)) throw new Error('Invalid input');
      await ownedSession(event, id).endInput(inputId);
    },
  );
  ipcMain.handle(
    channels.retry,
    async (event, id: unknown, inputId: unknown) => {
      if (!isCaptureIdentifier(inputId)) throw new Error('Invalid input');
      await ownedSession(event, id).retry(inputId);
    },
  );
  ipcMain.handle(channels.stop, async (event, id: unknown) => {
    await ownedSession(event, id).stop();
  });
  ipcMain.handle(channels.request, (event) => {
    if (event.senderFrame !== event.sender.mainFrame)
      throw new Error('Invalid capture sender');
    if (isOwner(event)) return current?.snapshot ?? null;
    const session = getPackageSessionForSender(event.sender);
    return session?.packagePath &&
      current &&
      getPackageSessionForPackagePath(current.packagePath) === session
      ? current.snapshot
      : null;
  });
};
