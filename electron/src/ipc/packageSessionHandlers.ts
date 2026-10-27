import { ipcMain } from 'electron';
import { isPackageUpdating } from './packageUpdateLeases';
import { isNonEmptyString } from './ipcPayloadGuards';
import { isPackageOpenRequestId } from '../../../src/types/package/openProgress';
import { getValidatedEventSenderWindow } from './windowSenderGuards';
import {
  bindPackageSession,
  releasePackageSession,
} from '../packageSessionRegistry';

let isRegistered = false;

export const registerPackageSessionHandlers = (): void => {
  if (isRegistered) return;
  isRegistered = true;
  ipcMain.handle(
    'package-session:bind',
    (event, packagePath: unknown, requestId: unknown) => {
      const senderWindow = getValidatedEventSenderWindow(event);
      if (!senderWindow || !isNonEmptyString(packagePath)) return false;
      if (requestId !== undefined && !isPackageOpenRequestId(requestId))
        return false;
      if (isPackageUpdating(packagePath)) return false;
      const session = bindPackageSession(senderWindow, packagePath, requestId);
      return session?.mainWindow === senderWindow;
    },
  );
  ipcMain.handle(
    'package-session:release',
    (event, packagePath: unknown, requestId: unknown) => {
      const senderWindow = getValidatedEventSenderWindow(event);
      if (!senderWindow || !isNonEmptyString(packagePath)) return false;
      if (requestId !== undefined && !isPackageOpenRequestId(requestId))
        return false;
      return releasePackageSession(senderWindow, packagePath, requestId);
    },
  );
};
