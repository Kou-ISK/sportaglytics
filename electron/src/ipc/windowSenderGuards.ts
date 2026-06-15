import {
  BrowserWindow,
  type IpcMainEvent,
  type IpcMainInvokeEvent,
  type WebContents,
} from 'electron';

type IpcEvent = IpcMainEvent | IpcMainInvokeEvent;

export const getValidatedSenderWindow = (
  sender: WebContents,
): BrowserWindow | null => {
  const senderWindow = BrowserWindow.fromWebContents(sender);
  if (!senderWindow || senderWindow.isDestroyed()) {
    return null;
  }

  return senderWindow;
};

export const getValidatedEventSenderWindow = (
  event: IpcEvent,
): BrowserWindow | null => {
  return getValidatedSenderWindow(event.sender);
};

export const isEventFromWindow = (
  event: IpcEvent,
  expectedWindow: BrowserWindow | null,
): boolean => {
  if (!expectedWindow || expectedWindow.isDestroyed()) {
    return false;
  }

  return event.sender === expectedWindow.webContents;
};
