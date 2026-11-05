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
import type { NativePlaybackIntent, NativePlaybackOwner } from '../../../src/types/ipc/nativePlayback';

const deliveries = new Map<BrowserWindow, NativeSnapshotDelivery>();
const managers = new Map<BrowserWindow, NativePlaybackManager>();
let registered = false;
let active: NativePlaybackManager | null = null;
let quitting = false;
const held = new Set<BrowserWindow>();
let gestureInterlock: ((window: BrowserWindow, intent: NativePlaybackIntent) => boolean) | null = null;
/** Installed by the trusted input owner; never accepts a Renderer callback. */
export const installNativeGestureInterlock = (
  check: (window: BrowserWindow, intent: NativePlaybackIntent) => boolean,
): (() => void) => {
  if (gestureInterlock) throw Error('NATIVE_GESTURE_INTERLOCK_EXISTS');
  gestureInterlock = check;
  return () => { if (gestureInterlock === check) gestureInterlock = null; };
};
export interface CapturedNativeGestureOwner {
  readonly owner: NativePlaybackOwner;
  isCurrent(): boolean;
  stoppedAndDrawn(): boolean;
  acceptsContinuation(intent: NativePlaybackIntent): boolean;
  apply(raw: NativePlaybackIntent, permit: () => boolean): Promise<void>;
  drain(): Promise<boolean>;
}
/** Called by Main after trusted window and gesture validation. No Renderer
 * path or owner is accepted as authority, and cleanup keeps the captured
 * manager even if navigation or window destruction happens in the meantime. */
export const captureNativeGestureOwner = (
  window: BrowserWindow,
): CapturedNativeGestureOwner | null => {
  const session = getPackageSessionForWindow(window);
  const manager = managers.get(window);
  if (quitting || held.has(window) || window.isDestroyed() ||
      getValidatedSenderWindow(window.webContents) !== window ||
      !session?.packageBound || session.mainWindow !== window ||
      !manager || active !== manager) return null;
  const captured = manager.captureOwner();
  if (!captured) return null;
  let initial: NativePlaybackIntent | null;
  try {
    const state = manager.observe(captured);
    if (state.error || state.closing || state.closed) return null;
    initial = state.intent;
  } catch { return null; }
  if (!initial) return null;
  const startingIntent = initial;
  let submitted: NativePlaybackIntent | null = null;
  let stopSubmitted = false;
  const isCurrent = (): boolean => {
    if (active !== manager || quitting || held.has(window) || window.isDestroyed() ||
        getValidatedSenderWindow(window.webContents) !== window) return false;
    const current = manager.captureOwner();
    return current !== null && current.generation === captured.generation &&
      current.sourceKey === captured.sourceKey;
  };
  return {
    owner: Object.freeze({ ...captured }),
    isCurrent,
    acceptsContinuation(intent): boolean {
      const accepted = !!submitted && isCurrent() && intent.generation === captured.generation &&
        intent.sourceKey === captured.sourceKey && intent.sequence > submitted.sequence &&
        intent.seekId === submitted.seekId && intent.targetTime === submitted.targetTime &&
        intent.seekMode === submitted.seekMode && intent.rate === submitted.rate &&
        (!intent.playing || !stopSubmitted);
      if (accepted && !intent.playing) stopSubmitted = true;
      return accepted;
    },
    stoppedAndDrawn(): boolean {
      if (!isCurrent() || !submitted) return false;
      try {
        const value = manager.observe(captured);
        const intent = value.intent;
        const observation = value.observation;
        return !value.error && !value.closing && !!intent && !intent.playing &&
          intent.sequence > submitted.sequence && intent.seekId === submitted.seekId &&
          intent.targetTime === submitted.targetTime && intent.rate === submitted.rate &&
          !!observation && observation.phase === 'paused' && observation.rate === 0 &&
          observation.videoReady && observation.audioReady &&
          observation.sequence === intent.sequence && observation.seekId === intent.seekId;
      } catch { return false; }
    },
    async apply(raw, permit): Promise<void> {
      const intent = parseNativePlaybackIntent(raw);
      if (intent.generation !== captured.generation || intent.sourceKey !== captured.sourceKey ||
          submitted || intent.sequence !== startingIntent.sequence + 1 ||
          intent.seekId !== startingIntent.seekId || intent.targetTime !== startingIntent.targetTime ||
          !intent.playing || intent.rate >= 0 || !isCurrent() || !permit())
        throw Error('NATIVE_GESTURE_REVOKED');
      submitted = intent;
      const allowed = (): boolean => {
        if (!isCurrent() || !permit()) return false;
        try {
          const current = manager.observe(captured).intent;
          return !!current && (current.sequence === startingIntent.sequence ||
            (current.sequence >= intent.sequence && current.seekId === intent.seekId &&
             current.targetTime === intent.targetTime && current.rate === intent.rate));
        } catch { return false; }
      };
      await manager.applyGuarded(intent, allowed);
    },
    async drain(): Promise<boolean> {
      try {
        const receipt = await manager.close(captured);
        if (!receipt.nativeDrained || !receipt.processExited || !receipt.pipesClosed) return false;
        if (active === manager) active = null;
        return true;
      } catch { return false; }
    },
  };
};
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
  ipcMain.handle(channels.apply, (event, raw: unknown) => {
    const manager = owner(event);
    const window = getValidatedEventSenderWindow(event);
    const intent = parseNativePlaybackIntent(raw);
    if (!window || (gestureInterlock && !gestureInterlock(window, intent)))
      throw Error('NATIVE_GESTURE_INTERRUPTED');
    return manager.apply(intent);
  });
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
