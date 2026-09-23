import { BrowserWindow } from 'electron';
import { getPackageSessionForWindow } from '../packageSessionRegistry';

type MenuTarget = Pick<BrowserWindow, 'isDestroyed'> & {
  readonly webContents: Pick<Electron.WebContents, 'isDestroyed' | 'send'>;
};

export const sendMenuCommand = (
  target: MenuTarget | null | undefined,
  channel: string,
  ...args: unknown[]
): void => {
  if (!target || target.isDestroyed()) return;
  try {
    // On Windows, WebContents can close before its BrowserWindow is destroyed.
    const contents = target.webContents;
    if (!contents.isDestroyed()) contents.send(channel, ...args);
  } catch (error) {
    // A native close can also complete between the check and send/getter.
    if (
      !(error instanceof Error && error.message === 'Object has been destroyed')
    ) {
      throw error;
    }
  }
};

export const sendToAllWindows = (channel: string, ...args: unknown[]): void => {
  for (const window of BrowserWindow.getAllWindows()) {
    sendMenuCommand(window, channel, ...args);
  }
};

export const sendToFocusedWindow = (
  channel: string,
  ...args: unknown[]
): void => {
  sendMenuCommand(
    BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0],
    channel,
    ...args,
  );
};

export const sendCodeWindowCommand = (channel: string): void => {
  const session = getPackageSessionForWindow(BrowserWindow.getFocusedWindow());
  const target =
    session?.mainWindow ??
    BrowserWindow.getAllWindows().find(
      (window) => getPackageSessionForWindow(window)?.mainWindow === window,
    );
  sendMenuCommand(target, channel);
};
