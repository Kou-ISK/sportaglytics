import { setVideoWindowAspect } from '../videoWindowAspect';
import { BrowserWindow, ipcMain, screen } from 'electron';
import { isStringArray, isStringPayload } from './ipcPayloadGuards';
import { getValidatedEventSenderWindow } from './windowSenderGuards';

interface RegisterWindowEventHandlersOptions {
  getMainWindow: () => BrowserWindow | null;
  onHotkeysUpdated: () => void;
  onRecentPackagesUpdated: (paths: string[]) => void;
}

let isRegistered = false;

export const registerWindowEventHandlers = ({
  getMainWindow,
  onHotkeysUpdated,
  onRecentPackagesUpdated,
}: RegisterWindowEventHandlersOptions): void => {
  if (isRegistered) {
    return;
  }
  isRegistered = true;

  ipcMain.on('video-window:set-aspect', (event, value: unknown) => {
    const window = getValidatedEventSenderWindow(event);
    if (!window || window.isDestroyed()) return;
    if (value === null) {
      setVideoWindowAspect(window, null);
      return;
    }
    if (
      typeof value !== 'object' ||
      !value ||
      !('aspectRatio' in value) ||
      !('width' in value) ||
      !('height' in value)
    )
      return;
    const { aspectRatio, width, height } = value;
    if (
      typeof aspectRatio !== 'number' ||
      !Number.isFinite(aspectRatio) ||
      aspectRatio < 0.2 ||
      aspectRatio > 12 ||
      typeof width !== 'number' ||
      !Number.isFinite(width) ||
      width < 0 ||
      width > 4096 ||
      typeof height !== 'number' ||
      !Number.isFinite(height) ||
      height < 0 ||
      height > 4096
    )
      return;
    setVideoWindowAspect(window, { aspectRatio, width, height });
    if (window.isFullScreen() || window.isMaximized()) return;
    const [currentWidth, currentHeight] = window.getContentSize();
    const [outerWidth, outerHeight] = window.getSize();
    const [minWidth, minHeight] = window.getMinimumSize();
    const minimumVideoWidth = Math.max(
      120,
      minWidth - (outerWidth - currentWidth) - width,
      (minHeight - (outerHeight - currentHeight) - height) * aspectRatio,
    );
    const area = screen.getDisplayMatching(window.getBounds()).workAreaSize;
    const videoWidth = Math.max(
      minimumVideoWidth,
      Math.min(
        currentWidth - width,
        Math.max(120, (area.height - height - 80) * aspectRatio),
      ),
    );
    window.setContentSize(
      Math.round(videoWidth + width),
      Math.round(videoWidth / aspectRatio + height),
    );
  });

  ipcMain.on('hotkeys-updated', (event) => {
    if (!getValidatedEventSenderWindow(event)) {
      return;
    }

    onHotkeysUpdated();
  });

  ipcMain.on('recent-packages:update', (event, paths: unknown) => {
    if (!getValidatedEventSenderWindow(event)) {
      return;
    }

    if (isStringArray(paths)) {
      onRecentPackagesUpdated(paths);
    }
  });

  ipcMain.on('set-window-title', (event, title: unknown) => {
    if (!getValidatedEventSenderWindow(event) || !isStringPayload(title)) {
      return;
    }

    // A renderer may be a package-owned auxiliary window. Always update the
    // validated sender itself instead of whichever main window was registered last.
    const window = getValidatedEventSenderWindow(event) ?? getMainWindow();
    if (window && !window.isDestroyed()) {
      window.setTitle(title);
    }
  });
};
