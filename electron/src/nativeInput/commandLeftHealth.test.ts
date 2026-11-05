import { expect, it, vi } from 'vitest';
import { createCommandLeftBroker } from './commandLeftBroker';
import { createCommandLeftHealth } from './commandLeftHealth';
import type { CommandLeftWindow } from './commandLeftBroker';

const make = () => {
  let callback: ((value: unknown) => boolean) | null = null;
  const monitor = {
    start: vi.fn((cb: (value: unknown) => boolean) => { callback = cb; }),
    reset: vi.fn(() => 0), stop: vi.fn(),
    health: vi.fn((): unknown => ({ faulted: false, faultSerial: 0, faultGesture: 0, faultWindow: 0 })),
  };
  const broker = createCommandLeftBroker(monitor);
  const window: CommandLeftWindow = {
    isDestroyed: () => false, matchesWindow: (id) => id === 7,
    sendEvent: vi.fn(), sendOverflow: vi.fn(), captureStart: () => true,
    stopCaptured: vi.fn(async () => true),
  };
  const guard = createCommandLeftHealth(monitor, broker, () => window);
  const input = (value: unknown): boolean => {
    if (!callback) throw Error('missing callback');
    return callback(value);
  };
  return { monitor, broker, window, guard, input };
};
const down = { phase: 'down', gesture: 1, serial: 1, windowNumber: 7,
  meta: true, shift: false, alt: false, control: false };
it('revokes and drains a captured operation on monitor fault and never rearms', async () => {
  const { monitor, broker, window, guard, input } = make();
  expect(guard.start()).toBe(true);
  const epoch = broker.arm(window, window);
  if (epoch === null) throw Error('missing epoch');
  expect(input(down)).toBe(true);
  expect(broker.claimStart(window, window, 1, epoch)).toBe('active');
  monitor.health.mockReturnValue({ faulted: true, faultSerial: 2, faultGesture: 1, faultWindow: 7 });
  guard.poll();
  expect(broker.isClaimCurrent(window, 1, epoch)).toBe(false);
  expect(broker.arm(window, window)).toBeNull();
  for (let i = 0; i < 5; i++) await Promise.resolve();
  expect(window.stopCaptured).toHaveBeenCalledWith(epoch);
  guard.dispose();
});
it.each(['throw', 'invalid'])('fails closed on %s health', (mode) => {
  const { monitor, broker, window, guard } = make();
  expect(guard.start()).toBe(true);
  expect(broker.arm(window, window)).not.toBeNull();
  if (mode === 'throw') monitor.health.mockImplementation(() => { throw Error('unavailable'); });
  else monitor.health.mockReturnValue(null);
  guard.poll();
  expect(broker.arm(window, window)).toBeNull();
  guard.dispose();
});
it('rejects malformed callbacks synchronously and stops monitoring on dispose', () => {
  const { monitor, guard, input } = make();
  expect(guard.start()).toBe(true);
  expect(input({ ...down, extra: true })).toBe(false);
  guard.dispose();
  expect(monitor.stop).toHaveBeenCalledOnce();
  expect(input(down)).toBe(false);
});
it('does not leave a monitor running if disposed synchronously during start', () => {
  const { monitor, guard } = make();
  monitor.start.mockImplementation(() => { guard.dispose(); });
  expect(guard.start()).toBe(false);
  expect(monitor.stop).toHaveBeenCalledOnce();
});
it('does not create a timer if disposed synchronously during health check', () => {
  const { monitor, guard } = make();
  monitor.health.mockImplementation(() => {
    guard.dispose();
    return { faulted: false, faultSerial: 0, faultGesture: 0, faultWindow: 0 };
  });
  expect(guard.start()).toBe(false);
  expect(monitor.stop).toHaveBeenCalledOnce();
});
it('does not stop a different monitor when start rejects without ownership', () => {
  const { monitor, broker, window, guard } = make();
  monitor.start.mockImplementation(() => { throw Error('already owned'); });
  expect(guard.start()).toBe(false);
  expect(broker.arm(window, window)).toBeNull();
  guard.dispose();
  expect(monitor.stop).not.toHaveBeenCalled();
});
