import type { NativeGesturePhase } from '../../../src/types/ipc/nativeCommandLeft';
import { createGestureLedger } from './gestureLedger';

export interface CommandLeftEvent {
  phase: 'down' | 'up' | 'cancel';
  gesture: number;
  serial: number;
  windowNumber: number;
  meta: boolean;
  shift: boolean;
  alt: boolean;
  control: boolean;
}
export interface CommandLeftWindow {
  isDestroyed(): boolean;
  matchesWindow(windowNumber: number): boolean;
  sendEvent(
    value: Omit<CommandLeftEvent, 'windowNumber'> & { epoch: number },
  ): void;
  sendOverflow(epoch: number): void;
  /** Main captures the current owner/source/operation before start can be sent. */
  captureStart(
    gesture: number,
    epoch: number,
    phase: NativeGesturePhase,
  ): boolean;
  /** Cancel outstanding start permits and wait for submitted starts to settle,
   * then confirm stop/Drawn or a drained close before returning true. */
  stopCaptured(epoch: number): Promise<boolean>;
}
export interface CommandLeftMonitor {
  /** Synchronously clears the active gesture and returns the last issued serial. */
  reset(): number;
}
export interface CommandLeftBroker {
  arm(
    window: CommandLeftWindow,
    focused: CommandLeftWindow | null,
  ): number | null;
  claimStart(
    window: CommandLeftWindow,
    focused: CommandLeftWindow | null,
    gesture: number,
    expectedEpoch: number,
  ): NativeGesturePhase;
  /** Main-only guard, captured by the validated start handler. */
  isClaimCurrent(window: CommandLeftWindow, gesture: number, expectedEpoch: number): boolean;
  /** Main-only: invoke exclusively after owner-bound stop and Drawn proof. */
  confirmStopped(
    window: CommandLeftWindow,
    gesture: number,
    expectedEpoch: number,
  ): boolean;
  retire(
    window: CommandLeftWindow,
    focused: CommandLeftWindow | null,
    gesture: number,
    expectedEpoch: number,
  ): boolean;
  revoke(
    window: CommandLeftWindow,
    expectedEpoch: number,
  ): 'revoked' | 'already-revoked' | 'pending' | 'rejected';
  disarm(window: CommandLeftWindow): void;
  /** A failed monitor cannot be rearmed in this process. */
  fault(): void;
  receive(event: CommandLeftEvent, focused: CommandLeftWindow | null): void;
}
/** Single focused-window lease. All callers are independently sender-validated. */
export const createCommandLeftBroker = (
  monitor: CommandLeftMonitor,
  limit = 32,
): CommandLeftBroker => {
  const ledger = createGestureLedger(limit);
  let armed: CommandLeftWindow | null = null;
  let epoch = 0;
  let lastSerial = 0;
  let faulted = false;
  let blocked: { window: CommandLeftWindow; epoch: number } | null = null;
  let lastRevoked: { window: CommandLeftWindow; epoch: number } | null = null;
  let tracked: {
    window: CommandLeftWindow;
    gesture: number;
    epoch: number;
  } | null = null;
  const resetMonitor = (): boolean => {
    try {
      const watermark = monitor.reset();
      if (!Number.isSafeInteger(watermark) || watermark < 0) return false;
      lastSerial = Math.max(lastSerial, watermark);
      return true;
    } catch {
      return false;
    }
  };
  const stopAndBlock = (window: CommandLeftWindow): void => {
    if (blocked) return;
    const captured = { window, epoch };
    blocked = captured;
    tracked = null;
    armed = null;
    resetMonitor();
    // Retain the ledger and prevent rearm until Main verifies the captured owner.
    void Promise.resolve()
      .then(() => window.stopCaptured(captured.epoch))
      .then((confirmed) => {
        if (!confirmed || blocked !== captured) return;
        ledger.disarm();
        lastRevoked = captured;
        blocked = null;
      })
      .catch(() => {});
  };
  const disarm = (window: CommandLeftWindow): void => {
    if (armed !== window) return;
    if (ledger.size() > 0) {
      stopAndBlock(window);
      return;
    }
    lastRevoked = { window, epoch };
    tracked = null;
    armed = null;
    ledger.disarm();
    resetMonitor();
  };
  return {
    arm(
      window: CommandLeftWindow,
      focused: CommandLeftWindow | null,
    ): number | null {
      if (faulted || blocked || window.isDestroyed() || focused !== window) return null;
      if (armed !== window) {
        if (armed) disarm(armed);
        if (blocked || !resetMonitor()) return null;
        tracked = null;
        armed = window;
        epoch = ledger.arm();
      }
      return epoch;
    },
    claimStart(
      window: CommandLeftWindow,
      focused: CommandLeftWindow | null,
      gesture: number,
      expectedEpoch: number,
    ): NativeGesturePhase {
      if (window.isDestroyed() || focused !== window || armed !== window)
        return 'invalid';
      const phase = ledger.claim(gesture, expectedEpoch);
      if (phase === 'invalid') return phase;
      try {
        if (window.captureStart(gesture, expectedEpoch, phase)) {
          if (!blocked && armed === window && epoch === expectedEpoch && !window.isDestroyed())
            return phase;
          return 'invalid';
        }
      } catch {
        /* capture failure cannot establish no effect */
      }
      stopAndBlock(window);
      return 'invalid';
    },
    isClaimCurrent(window, gesture, expectedEpoch): boolean {
      return !blocked && armed === window && !window.isDestroyed() &&
        expectedEpoch === epoch && ledger.isClaimCurrent(gesture, expectedEpoch);
    },
    confirmStopped(
      window: CommandLeftWindow,
      gesture: number,
      expectedEpoch: number,
    ): boolean {
      if (window.isDestroyed() || armed !== window) return false;
      return ledger.confirmStopped(gesture, expectedEpoch);
    },
    retire(
      window: CommandLeftWindow,
      focused: CommandLeftWindow | null,
      gesture: number,
      expectedEpoch: number,
    ): boolean {
      return (
        !window.isDestroyed() &&
        focused === window &&
        armed === window &&
        ledger.retire(gesture, expectedEpoch)
      );
    },
    revoke(
      window: CommandLeftWindow,
      expectedEpoch: number,
    ): 'revoked' | 'already-revoked' | 'pending' | 'rejected' {
      if (blocked?.window === window && blocked.epoch === expectedEpoch)
        return 'pending';
      if (window.isDestroyed()) return 'rejected';
      if (window === armed && expectedEpoch === epoch) {
        disarm(window);
        return blocked ? 'pending' : 'revoked';
      }
      return lastRevoked?.window === window &&
        lastRevoked.epoch === expectedEpoch
        ? 'already-revoked'
        : 'rejected';
    },
    disarm,
    fault(): void {
      faulted = true;
      if (armed) disarm(armed);
    },
    receive(event: CommandLeftEvent, focused: CommandLeftWindow | null): void {
      const window = armed;
      if (
        !window ||
        window !== focused ||
        window.isDestroyed() ||
        !window.matchesWindow(event.windowNumber)
      )
        return;
      if (
        !Number.isSafeInteger(event.serial) ||
        event.serial <= lastSerial ||
        !Number.isSafeInteger(event.gesture) ||
        event.gesture < 1
      )
        return;
      if (event.phase === 'down') {
        if (tracked) {
          stopAndBlock(window);
          return;
        }
        const accepted = ledger.down(event.gesture);
        if (accepted.status === 'overflow') {
          const overflowEpoch = epoch;
          stopAndBlock(window);
          try {
            window.sendOverflow(overflowEpoch);
          } catch {
            /* safety stop remains pending */
          }
          return;
        }
        if (accepted.status !== 'accepted') return;
        tracked = { window, gesture: event.gesture, epoch };
      } else if (
        !tracked ||
        tracked.window !== window ||
        tracked.gesture !== event.gesture ||
        tracked.epoch !== epoch ||
        !ledger.end(event.gesture)
      )
        return;
      lastSerial = event.serial;
      const { windowNumber: _windowNumber, ...message } = event;
      try {
        window.sendEvent({ ...message, epoch });
      } catch {
        stopAndBlock(window);
        return;
      }
      if (event.phase !== 'down') tracked = null;
    },
  };
};
