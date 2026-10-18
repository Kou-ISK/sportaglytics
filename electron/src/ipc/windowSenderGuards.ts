import {
  BrowserWindow,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type WebContents,
} from 'electron';
import { isTrustedRendererUrl } from '../rendererUrl';

type IpcEvent = IpcMainEvent | IpcMainInvokeEvent;

export const getValidatedSenderWindow = (
  sender: WebContents,
): BrowserWindow | null => {
  try {
    if (sender.isDestroyed() || !isTrustedRendererUrl(sender.getURL())) {
      return null;
    }
    const senderWindow = BrowserWindow.fromWebContents(sender);
    return senderWindow && !senderWindow.isDestroyed() ? senderWindow : null;
  } catch {
    // Native WebContents/window access can fail after the renderer exits.
    return null;
  }
};

export const getValidatedEventSenderWindow = (
  event: IpcEvent,
): BrowserWindow | null => {
  if (!isTrustedMainFrameEvent(event)) return null;
  return getValidatedSenderWindow(event.sender);
};

const isTrustedMainFrameEvent = (event: IpcEvent): boolean => {
  try {
    // sender alone identifies a WebContents, not the frame that invoked IPC.
    // Detached frames can become null while a queued event is delivered.
    return (
      !event.sender.isDestroyed() &&
      event.senderFrame !== null &&
      event.senderFrame === event.sender.mainFrame &&
      isTrustedRendererUrl(event.senderFrame.url)
    );
  } catch {
    return false;
  }
};

export const isEventFromWindow = (
  event: IpcEvent,
  expectedWindow: BrowserWindow | null,
): boolean => {
  try {
    return (
      expectedWindow !== null &&
      !expectedWindow.isDestroyed() &&
      event.sender === expectedWindow.webContents &&
      isTrustedMainFrameEvent(event)
    );
  } catch {
    return false;
  }
};
