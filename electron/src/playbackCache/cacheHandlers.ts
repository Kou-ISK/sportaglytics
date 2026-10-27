import { ipcMain } from 'electron';
import type { IpcMainInvokeEvent } from 'electron';
import {
  playbackCacheChannels as channels,
  parsePlaybackCacheRequest,
  parsePlaybackCacheSelection,
} from '../../../src/types/ipc/playbackCache';
import { getValidatedEventSenderWindow } from '../ipc/windowSenderGuards';
import { getPackageSessionForWindow } from '../packageSessionRegistry';
import { getCacheSessionController } from './cacheSessionController';
import type { CacheSessionController } from './cacheSessionController';

const owner = (event: IpcMainInvokeEvent): CacheSessionController => {
  const window = getValidatedEventSenderWindow(event);
  const session = window && getPackageSessionForWindow(window);
  if (!window || !session?.packageBound || session.mainWindow !== window)
    throw Error('CACHE_UNAUTHORIZED');
  return getCacheSessionController(window);
};
let registered = false;
/** No renderer paths, executable names, arguments or proof objects are accepted. */
export const registerPlaybackCacheHandlers = (): void => {
  if (registered) return;
  registered = true;
  ipcMain.handle(channels.inspect, (event) => owner(event).inspect());
  for (const command of [
    'prepare',
    'reuse',
    'cancel',
    'cleanup',
    'candidate',
  ] as const) {
    ipcMain.handle(channels[command], (event, raw: unknown) => {
      const controller = owner(event);
      return controller[command](parsePlaybackCacheRequest(raw));
    });
  }
  ipcMain.handle(channels.selected, (event, raw: unknown) =>
    owner(event).selected(parsePlaybackCacheSelection(raw)),
  );
};
