import { ipcMain } from 'electron';
import { isPackageUpdating } from './packageUpdateLeases';
import { isNonEmptyString } from './ipcPayloadGuards';
import { getValidatedEventSenderWindow } from './windowSenderGuards';
import {
  bindPackageSession,
  releasePackageSession,
} from '../packageSessionRegistry';

let isRegistered = false;

export const registerPackageSessionHandlers = (): void => {
  if (isRegistered) return;
  isRegistered = true;
  ipcMain.handle('package-session:bind', (event, packagePath: unknown) => {
    const senderWindow = getValidatedEventSenderWindow(event);
    if (!senderWindow || !isNonEmptyString(packagePath)) return false;
    if (isPackageUpdating(packagePath)) return false;
    const session = bindPackageSession(senderWindow, packagePath);
    return session?.mainWindow === senderWindow;
  });
  ipcMain.handle('package-session:release', (event, packagePath: unknown) => {
    const senderWindow = getValidatedEventSenderWindow(event);
    if (!senderWindow || !isNonEmptyString(packagePath)) return false;
    return releasePackageSession(senderWindow, packagePath);
  });
};
