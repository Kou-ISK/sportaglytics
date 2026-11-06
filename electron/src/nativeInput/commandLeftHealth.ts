import { booleanValue, enumValue, exactKeys, integerValue, objectValue } from '../../../src/shared/validation/jsonValues';
import type { CommandLeftBroker, CommandLeftEvent, CommandLeftWindow } from './commandLeftBroker';

interface Monitor {
  /** A throwing start must roll back only resources acquired by that call. */
  start(callback: (raw: unknown) => boolean): void;
  health(): unknown;
  stop(): void;
}
interface HealthGuard {
  start(): boolean;
  poll(): void;
  dispose(): void;
}
const parseEvent = (raw: unknown): CommandLeftEvent => {
  const v = objectValue(raw);
  exactKeys(v, ['phase', 'gesture', 'serial', 'windowNumber', 'meta', 'shift', 'alt', 'control']);
  return { phase: enumValue(v.phase, ['down', 'up', 'cancel']),
    gesture: integerValue(v.gesture, 1), serial: integerValue(v.serial, 1),
    windowNumber: integerValue(v.windowNumber, 1), meta: booleanValue(v.meta),
    shift: booleanValue(v.shift), alt: booleanValue(v.alt), control: booleanValue(v.control) };
};
const healthy = (raw: unknown): boolean => {
  const v = objectValue(raw);
  exactKeys(v, ['faulted', 'faultSerial', 'faultGesture', 'faultWindow']);
  const faulted = booleanValue(v.faulted);
  integerValue(v.faultSerial, 0);
  integerValue(v.faultGesture, 0);
  integerValue(v.faultWindow, 0);
  return !faulted;
};
/** Main-only monitor. On uncertainty, synchronously revoke the gesture before
 * the broker drains the captured owner. A failed monitor never rearms. */
export const createCommandLeftHealth = (
  monitor: Monitor,
  broker: CommandLeftBroker,
  focused: () => CommandLeftWindow | null,
  intervalMs = 50,
): HealthGuard => {
  let timer: ReturnType<typeof setInterval> | null = null;
  let started = false;
  let stopped = false;
  let failed = false;
  let disposed = false;
  const stopOnce = (): void => {
    if (!started || stopped) return;
    stopped = true;
    try { monitor.stop(); } catch { /* owner remains draining */ }
  };
  const fail = (): void => {
    if (failed) return;
    failed = true;
    if (timer) clearInterval(timer);
    timer = null;
    broker.fault();
    stopOnce();
  };
  const poll = (): void => {
    if (!started || failed || disposed) return;
    try { if (!healthy(monitor.health())) fail(); } catch { fail(); }
  };
  return {
    start(): boolean {
      if (started || failed || disposed) return false;
      try {
        monitor.start((raw): boolean => {
          if (failed || disposed) return false;
          try { broker.receive(parseEvent(raw), focused()); return true; }
          catch { fail(); return false; }
        });
        started = true;
        if (failed || disposed) { stopOnce(); return false; }
        poll();
        if (failed || disposed) { stopOnce(); return false; }
        timer = setInterval(poll, intervalMs);
        timer.unref();
        return true;
      } catch { fail(); return false; }
    },
    poll,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (timer) clearInterval(timer);
      timer = null;
      broker.fault();
      stopOnce();
    },
  };
};
