import { BrowserWindow, session } from 'electron';
import * as path from 'node:path';
import { getRendererUrl } from '../rendererUrl';
import { applyWindowSecurity } from '../windowSecurity';

let window: BrowserWindow | null = null;
let authorized = false;
let canClose: () => boolean = () => true;
let stopCapture: () => Promise<void> = async () => undefined;

export const setCaptureWindowLifecycle = (options: {
  canClose: () => boolean;
  stop: () => Promise<void>;
}): void => {
  canClose = options.canClose;
  stopCapture = options.stop;
};

export const getCaptureWindow = (): BrowserWindow | null =>
  window && !window.isDestroyed() ? window : null;

export const authorizeCaptureDevices = (): void => {
  authorized = true;
};

export const openLiveCaptureWindow = (): void => {
  const existing = getCaptureWindow();
  if (existing) {
    existing.show();
    existing.restore();
    existing.focus();
    return;
  }
  const captureSession = session.fromPartition('live-capture');
  const rendererUrl = getRendererUrl('/live-capture');
  const trustedUrl = (value: string): boolean =>
    value.split('#')[0] === rendererUrl.split('#')[0];
  captureSession.setPermissionCheckHandler(
    (sender, permission, _origin, details) =>
      authorized &&
      sender === getCaptureWindow()?.webContents &&
      ['media', 'camera', 'microphone'].includes(permission) &&
      trustedUrl(details.requestingUrl ?? ''),
  );
  captureSession.setPermissionRequestHandler(
    (sender, permission, callback, details) => {
      callback(
        authorized &&
          sender === getCaptureWindow()?.webContents &&
          ['media', 'camera', 'microphone'].includes(permission) &&
          details.isMainFrame &&
          trustedUrl(details.requestingUrl),
      );
    },
  );
  const created = new BrowserWindow({
    width: 980,
    height: 730,
    minWidth: 680,
    minHeight: 520,
    show: false,
    title: 'ライブキャプチャ',
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload.js'),
      partition: 'live-capture',
      backgroundThrottling: false,
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });
  window = created;
  authorized = false;
  applyWindowSecurity(created);
  created.webContents.on('will-frame-navigate', (event) => {
    if (!event.isMainFrame) event.preventDefault();
  });
  created.webContents.on('will-navigate', (event, url) => {
    if (url !== rendererUrl) event.preventDefault();
  });
  created.setMenuBarVisibility(false);
  created.once('ready-to-show', () => {
    if (!created.isDestroyed()) created.show();
  });
  created.on('close', (event) => {
    if (canClose()) return;
    event.preventDefault();
    // Closing the controls is not a request to stop the recording owner.
    created.hide();
  });
  created.on('closed', () => {
    window = null;
    authorized = false;
    void stopCapture();
  });
  created.webContents.on('render-process-gone', () => {
    void stopCapture();
  });
  void created.loadURL(rendererUrl);
};
