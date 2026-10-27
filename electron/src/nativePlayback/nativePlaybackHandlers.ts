import {
  objectValue,
  exactKeys,
} from '../../../src/shared/validation/jsonValues';
import { parseNativePlaybackFailure } from '../../../src/types/ipc/nativePlaybackFailure';
import { ipcMain } from 'electron';
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron';
import {
  getValidatedEventSenderWindow,
  getValidatedSenderWindow,
} from '../ipc/windowSenderGuards';
import { getPackageSessionForWindow } from '../packageSessionRegistry';
import {
  nativePlaybackChannels as channels,
  nativePlaybackSnapshotChannel,
  nativePlaybackSnapshotAckChannel,
  parseNativeSnapshotAcknowledgement,
} from '../../../src/types/ipc/nativePlayback';
import {
  parseNativePlaybackOwner,
  parseNativePlaybackIntent,
} from '../../../src/types/ipc/nativePlayback';
import { NativeSnapshotDelivery } from './nativeSnapshotDelivery';
import { NativePlaybackManager } from './nativePlaybackManager';
import type { QualifiedNativeSource } from './nativePlaybackManager';

const deliveries = new Map<BrowserWindow, NativeSnapshotDelivery>();
const managers = new Map<BrowserWindow, NativePlaybackManager>();
let registered = false;
let active: NativePlaybackManager | null = null;
let quitting = false;
const held = new Set<BrowserWindow>();
/** Ordinary startup supplies no qualification/provider, so no native helper can
 * launch. A diagnostic Main may supply a fixed, independently checked source. */
export const registerNativePlaybackHandlers = (
  qualify:
    | ((window: BrowserWindow) => Promise<QualifiedNativeSource | null>)
    | null = null,
): void => {
  if (registered) return;
  registered = true;
  const owner = (event: IpcMainInvokeEvent): NativePlaybackManager => {
    const window = getValidatedEventSenderWindow(event);
    const session = window && getPackageSessionForWindow(window);
    if (!window || !session?.packageBound || session.mainWindow !== window)
      throw Error('NATIVE_UNAUTHORIZED');
    if (quitting || held.has(window)) throw Error('NATIVE_CLOSING');
    let manager = managers.get(window);
    if (!manager) {
      let epoch = 0;
      const delivery = new NativeSnapshotDelivery((notice) => {
        if (getValidatedSenderWindow(window.webContents) !== window)
          throw Error('NATIVE_SENDER_CHANGED');
        window.webContents.send(nativePlaybackSnapshotChannel, notice);
      });
      deliveries.set(window, delivery);
      manager = new NativePlaybackManager({
        publish: (owner, snapshot) => delivery.publish(owner, snapshot),
        context: () => {
          const current = getPackageSessionForWindow(window);
          return !window.isDestroyed() &&
            current?.packageBound &&
            current.mainWindow === window
            ? JSON.stringify([current.id, current.packagePath, epoch])
            : null;
        },
        qualify:
          qualify && process.platform === 'darwin'
            ? () => qualify(window)
            : null,
      });
      const retained = manager;
      const invalidate = (): void => {
        delivery.resetDocument();
        epoch++;
        retained.invalidate();
        void retained
          .hold()
          .then((release) => {
            release();
            if (active === retained) active = null;
            if (window.isDestroyed()) {
              managers.delete(window);
              deliveries.delete(window);
            }
          })
          .catch(() => {
            // Retain both registry and global ownership while cleanup is unknown.
          });
      };
      window.webContents.on('did-start-navigation', (details) => {
        if (details.isMainFrame && !details.isSameDocument) invalidate();
      });
      window.webContents.on('render-process-gone', invalidate);
      window.once('closed', invalidate);
      managers.set(window, manager);
    }
    return manager;
  };
  ipcMain.on(nativePlaybackSnapshotAckChannel, (event, raw: unknown) => {
    const window = getValidatedEventSenderWindow(event);
    const session = window && getPackageSessionForWindow(window);
    if (!window || !session?.packageBound || session.mainWindow !== window)
      return;
    try {
      const value = parseNativeSnapshotAcknowledgement(raw);
      deliveries.get(window)?.acknowledge(value.owner, value.delivery);
    } catch {
      managers.get(window)?.invalidate();
    }
  });
  ipcMain.handle(channels.reportFailure, (event, raw: unknown) => {
    const manager = owner(event);
    const value = objectValue(raw);
    exactKeys(value, ['owner', 'failure']);
    manager.reportFailure(
      parseNativePlaybackOwner(value.owner),
      parseNativePlaybackFailure(value.failure),
    );
  });
  ipcMain.handle(channels.inspect, (event) => owner(event).inspect());
  ipcMain.handle(channels.open, async (event, raw: unknown) => {
    const manager = owner(event);
    if (active) throw Error('NATIVE_BUSY');
    active = manager;
    try {
      await manager.open(parseNativePlaybackOwner(raw));
    } catch (error) {
      // A failed open may own a launched child. Only a successful hold unlocks it.
      try {
        const release = await manager.hold();
        release();
        active = null;
      } catch {
        /* retained until confirmed */
      }
      throw error;
    }
  });
  ipcMain.handle(channels.apply, (event, raw: unknown) =>
    owner(event).apply(parseNativePlaybackIntent(raw)),
  );
  ipcMain.handle(channels.observe, (event, raw: unknown) =>
    owner(event).observe(parseNativePlaybackOwner(raw)),
  );
  ipcMain.handle(channels.close, async (event, raw: unknown) => {
    const manager = owner(event);
    const result = await manager.close(parseNativePlaybackOwner(raw));
    if (active === manager) active = null;
    return result;
  });
};

export const holdNativePlayback = async (
  windows: readonly BrowserWindow[],
  kind: 'close' | 'quit',
): Promise<() => void> => {
  if (kind === 'quit') quitting = true;
  else windows.forEach((window) => held.add(window));
  const targets =
    kind === 'quit'
      ? [...managers.values()]
      : windows.flatMap((window) => managers.get(window) ?? []);
  const releases: (() => void)[] = [];
  const release = (): void => {
    for (const resume of releases) resume();
    if (kind === 'quit') quitting = false;
    else windows.forEach((window) => held.delete(window));
  };
  try {
    for (const manager of targets) {
      releases.push(await manager.hold());
      if (active === manager) active = null;
    }
    return release;
  } catch (error) {
    release();
    throw error;
  }
};
