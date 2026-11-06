import type { BrowserWindow } from 'electron';
import type { NativePlaybackIntent } from '../../../src/types/ipc/nativePlayback';
import type { NativeGesturePhase } from '../../../src/types/ipc/nativeCommandLeft';
import { nativeCommandLeftChannels } from '../../../src/types/ipc/nativeCommandLeft';
import { captureNativeGestureOwner, installNativeGestureInterlock } from '../nativePlayback/nativePlaybackHandlers';
import type { CapturedNativeGestureOwner } from '../nativePlayback/nativePlaybackHandlers';
import { createCommandLeftBroker } from './commandLeftBroker';
import type { CommandLeftWindow } from './commandLeftBroker';
import { createCommandLeftHealth } from './commandLeftHealth';

export interface NativeMonitor {
  start(callback: (raw: unknown) => boolean): void;
  reset(): number;
  health(): unknown;
  stop(): void;
  matchesWindow(handle: Buffer, windowNumber: number): boolean;
}
type Capture = { lease: CapturedNativeGestureOwner; gesture: number; epoch: number };
export interface MainCommandInput {
  start(): boolean;
  arm(window: BrowserWindow): number | null;
  claim(window: BrowserWindow, gesture: number, epoch: number): NativeGesturePhase;
  apply(window: BrowserWindow, gesture: number, epoch: number, intent: NativePlaybackIntent): Promise<void>;
  retire(window: BrowserWindow, gesture: number, epoch: number): boolean;
  revoke(window: BrowserWindow, epoch: number): 'revoked' | 'already-revoked' | 'pending' | 'rejected';
  acknowledge(window: BrowserWindow, epoch: number, serial: number, accepted: boolean): void;
  disarm(window: BrowserWindow): void;
  dispose(): void;
}
/** Main owns every native handle, captured playback owner and gesture permit.
 * The caller must validate IPC sender/frame before invoking these methods. */
export const createCommandLeftMain = (
  monitor: NativeMonitor,
  focused: () => BrowserWindow | null,
): MainCommandInput => {
  const broker = createCommandLeftBroker(monitor);
  const windows = new WeakMap<BrowserWindow, CommandLeftWindow>();
  const captures = new WeakMap<BrowserWindow, Capture>();
  const pending = new Map<BrowserWindow, Map<number, { epoch: number; deadline: number; timer: ReturnType<typeof setTimeout> }>>();
  const clearPending = (window: BrowserWindow): void => {
    const entries = pending.get(window); if (!entries) return;
    for (const item of entries.values()) clearTimeout(item.timer);
    pending.delete(window);
  };
  const checkDeadline = (window: BrowserWindow): boolean => {
    const entries = pending.get(window);
    if (!entries || ![...entries.values()].some((value) => performance.now() >= value.deadline)) return true;
    clearPending(window); broker.fault(); return false;
  };
  const adapterFor = (window: BrowserWindow): CommandLeftWindow => {
    const previous = windows.get(window);
    if (previous) return previous;
    const adapter: CommandLeftWindow = {
      isDestroyed: () => window.isDestroyed(),
      matchesWindow: (number) => !window.isDestroyed() && monitor.matchesWindow(window.getNativeWindowHandle(), number),
      sendEvent: (value) => {
        const entries = pending.get(window) ?? new Map();
        if (entries.size >= 64 || entries.has(value.serial)) throw Error('NATIVE_COMMAND_ACK_BOUND');
        const timer = setTimeout(() => { clearPending(window); broker.fault(); }, 1500);
        timer.unref(); entries.set(value.serial, { epoch: value.epoch, deadline: performance.now() + 1500, timer }); pending.set(window, entries);
        try { window.webContents.send(nativeCommandLeftChannels.event, value); }
        catch (error) { clearPending(window); throw error; }
      },
      sendOverflow: (epoch) => window.webContents.send(nativeCommandLeftChannels.overflow, epoch),
      captureStart: (gesture, epoch) => {
        if (captures.has(window)) return false;
        const lease = captureNativeGestureOwner(window);
        if (!lease) return false;
        captures.set(window, { lease, gesture, epoch });
        return true;
      },
      stopCaptured: async (epoch) => {
        const capture = captures.get(window);
        if (!capture || capture.epoch !== epoch) return true;
        const confirmed = await capture.lease.drain();
        if (confirmed && captures.get(window) === capture) captures.delete(window);
        return confirmed;
      },
    };
    windows.set(window, adapter);
    // The adapter remains available to drain its captured owner after destruction.
    window.on('blur', () => { clearPending(window); broker.disarm(adapter); });
    window.webContents.on('did-start-navigation', (details) => {
      if (details.isMainFrame && !details.isSameDocument) { clearPending(window); broker.disarm(adapter); }
    });
    window.once('closed', () => { clearPending(window); broker.disarm(adapter); });
    return adapter;
  };
  const focusedAdapter = (): CommandLeftWindow | null => {
    const window = focused();
    return window && !window.isDestroyed() ? adapterFor(window) : null;
  };
  const health = createCommandLeftHealth(monitor, broker, focusedAdapter);
  let started = false;
  let uninstall: (() => void) | null = null;
  return {
    start: () => {
      if (started) return true;
      try {
        uninstall = installNativeGestureInterlock((window, intent) => {
          if (!checkDeadline(window)) return false;
          const capture = captures.get(window);
          if (!capture || capture.lease.acceptsContinuation(intent)) return true;
          broker.disarm(adapterFor(window));
          return false;
        });
        started = health.start();
        if (!started) { uninstall(); uninstall = null; }
        return started;
      } catch { uninstall?.(); uninstall = null; health.dispose(); return false; }
    },
    arm: (window) => started && checkDeadline(window) ? broker.arm(adapterFor(window), focusedAdapter()) : null,
    claim: (window, gesture, epoch) => checkDeadline(window) ? broker.claimStart(adapterFor(window), focusedAdapter(), gesture, epoch) : 'invalid',
    async apply(window, gesture, epoch, intent): Promise<void> {
      const adapter = adapterFor(window);
      const capture = captures.get(window);
      if (!checkDeadline(window) || focused() !== window || !capture || capture.gesture !== gesture || capture.epoch !== epoch)
        throw Error('NATIVE_GESTURE_REVOKED');
      await capture.lease.apply(intent, () => checkDeadline(window) && captures.get(window) === capture &&
        broker.isClaimCurrent(adapter, gesture, epoch));
    },
    revoke: (window, epoch) => {
      const result = broker.revoke(adapterFor(window), epoch);
      if (result !== 'rejected') {
        const entries = pending.get(window);
        if (entries) {
          for (const [serial, item] of entries) if (item.epoch === epoch) { clearTimeout(item.timer); entries.delete(serial); }
          if (entries.size === 0) pending.delete(window);
        }
      }
      return result;
    },
    acknowledge(window, epoch, serial, accepted): void {
      if (!checkDeadline(window)) return;
      const entries = pending.get(window); const item = entries?.get(serial);
      if (!item) return;
      if (item.epoch !== epoch || !accepted) { clearPending(window); broker.fault(); return; }
      clearTimeout(item.timer); entries?.delete(serial);
      if (entries?.size === 0) pending.delete(window);
    },
    retire(window, gesture, epoch): boolean {
      if (!checkDeadline(window)) return false;
      const adapter = adapterFor(window);
      const capture = captures.get(window);
      if (capture && capture.gesture === gesture && capture.epoch === epoch) {
        if (!capture.lease.stoppedAndDrawn() || !broker.confirmStopped(adapter, gesture, epoch)) return false;
      }
      const result = broker.retire(adapter, focusedAdapter(), gesture, epoch);
      if (result && capture && capture.gesture === gesture && capture.epoch === epoch &&
          captures.get(window) === capture) captures.delete(window);
      return result;
    },
    disarm: (window) => { clearPending(window); broker.disarm(adapterFor(window)); },
    dispose: () => { started = false; for (const window of pending.keys()) clearPending(window); health.dispose(); uninstall?.(); uninstall = null; },
  };
};
