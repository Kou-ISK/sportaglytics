import { expect, it, vi } from 'vitest';
import { createCommandLeftBroker } from './commandLeftBroker';
import type { CommandLeftEvent, CommandLeftWindow } from './commandLeftBroker';
const windowFor = (number: number) =>
  ({
    isDestroyed: () => false,
    matchesWindow: (value: number) => value === number,
    sendEvent: vi.fn(),
    sendOverflow: vi.fn(),
    captureStart: vi.fn(() => true),
    stopCaptured: vi.fn(async () => true),
  }) satisfies CommandLeftWindow;
const event = (
  phase: CommandLeftEvent['phase'],
  gesture: number,
  serial: number,
  windowNumber = 7,
): CommandLeftEvent => ({
  phase,
  gesture,
  serial,
  windowNumber,
  meta: true,
  shift: false,
  alt: false,
  control: false,
});
it('delivers a held gesture only to its focused and armed window and retains it until retirement', () => {
  const monitor = { reset: vi.fn(() => 0) },
    broker = createCommandLeftBroker(monitor),
    first = windowFor(7),
    other = windowFor(8);
  expect(broker.arm(first, other)).toBeNull();
  const epoch = broker.arm(first, first);
  expect(epoch).not.toBeNull();
  if (epoch === null) throw Error('missing epoch');
  broker.receive(event('down', 1, 1), other);
  expect(first.sendEvent).not.toHaveBeenCalled();
  broker.receive(event('down', 1, 1), first);
  broker.receive(event('up', 1, 2), first);
  expect(first.sendEvent).toHaveBeenCalledTimes(2);
  expect(broker.claimStart(first, first, 1, epoch)).toBe('ended');
  expect(broker.retire(first, first, 1, epoch)).toBe(false);
  expect(broker.confirmStopped(first, 1, epoch)).toBe(true);
  expect(broker.retire(first, first, 1, epoch)).toBe(true);
  expect(broker.claimStart(first, first, 1, epoch)).toBe('invalid');
  broker.receive(event('down', 1, 3), first);
  expect(first.sendEvent).toHaveBeenCalledTimes(2);
});
it('blocks rearm during blur until captured stop is confirmed', async () => {
  const broker = createCommandLeftBroker({ reset: vi.fn(() => 0) }),
    win = windowFor(7);
  const epoch = broker.arm(win, win);
  if (epoch === null) throw Error('missing epoch');
  broker.receive(event('down', 1, 1), win);
  broker.disarm(win);
  expect(broker.revoke(win, epoch)).toBe('pending');
  expect(broker.claimStart(win, win, 1, epoch)).toBe('invalid');
  expect(broker.arm(win, win)).toBeNull();
  for (let i = 0; i < 4; i++) await Promise.resolve();
  expect(win.stopCaptured).toHaveBeenCalledWith(epoch);
  expect(broker.revoke(win, epoch)).toBe('already-revoked');
  const next = broker.arm(win, win);
  expect(next).not.toBe(epoch);
  broker.receive(event('down', 2, 1), win);
  broker.receive(event('up', 1, 2), win);
  expect(win.sendEvent).toHaveBeenCalledTimes(1);
});
it('rejects a claim when capture synchronously revokes its own lease', async () => {
  const broker = createCommandLeftBroker({ reset: () => 0 });
  const win = windowFor(7);
  const epoch = broker.arm(win, win);
  if (epoch === null) throw Error('missing epoch');
  broker.receive(event('down', 1, 1), win);
  win.captureStart.mockImplementationOnce(() => {
    broker.disarm(win);
    return true;
  });
  expect(broker.claimStart(win, win, 1, epoch)).toBe('invalid');
  expect(broker.arm(win, win)).toBeNull();
  for (let i = 0; i < 4; i++) await Promise.resolve();
  expect(win.stopCaptured).toHaveBeenCalledWith(epoch);
});
it('fails closed on bounded overflow and does not accept stale serials', () => {
  const broker = createCommandLeftBroker({ reset: vi.fn(() => 0) }, 1),
    win = windowFor(7);
  const epoch = broker.arm(win, win);
  if (epoch === null) throw Error('missing epoch');
  broker.receive(event('down', 1, 2), win);
  broker.receive(event('up', 1, 1), win);
  expect(win.sendEvent).toHaveBeenCalledTimes(1);
  broker.receive(event('up', 1, 3), win);
  broker.receive(event('down', 2, 4), win);
  expect(win.sendOverflow).toHaveBeenCalledWith(epoch);
  expect(broker.claimStart(win, win, 1, epoch)).toBe('invalid');
});

it('fences an old event generated before rearm but delivered afterwards', () => {
  let issued = 0;
  const broker = createCommandLeftBroker({ reset: () => issued });
  const win = windowFor(7);
  broker.arm(win, win);
  issued = 1;
  broker.receive(event('down', 1, 1), win);
  issued = 2;
  broker.receive(event('up', 1, 2), win);
  expect(broker.retire(win, win, 1, 1)).toBe(true);
  issued = 3;
  broker.disarm(win);
  broker.arm(win, win);
  broker.receive(event('down', 2, 3), win);
  expect(win.sendEvent).toHaveBeenCalledTimes(2);
  issued = 4;
  broker.receive(event('down', 3, 4), win);
  expect(win.sendEvent).toHaveBeenCalledTimes(3);
});
it('does not arm when the monitor cannot establish a watermark', () => {
  const broker = createCommandLeftBroker({
      reset: () => {
        throw Error('unavailable');
      },
    }),
    win = windowFor(7);
  expect(broker.arm(win, win)).toBeNull();
  broker.receive(event('down', 1, 1), win);
  expect(win.sendEvent).not.toHaveBeenCalled();
});

it('keeps admission closed when delivery or captured stop fails', async () => {
  const broker = createCommandLeftBroker({ reset: () => 0 }),
    win = windowFor(7);
  win.sendEvent.mockImplementationOnce(() => {
    throw Error('delivery failed');
  });
  win.stopCaptured.mockResolvedValue(false);
  const epoch = broker.arm(win, win);
  if (epoch === null) throw Error('missing epoch');
  broker.receive(event('down', 1, 1), win);
  for (let i = 0; i < 4; i++) await Promise.resolve();
  expect(win.stopCaptured).toHaveBeenCalledWith(epoch);
  expect(broker.arm(win, win)).toBeNull();
  expect(broker.revoke(win, epoch)).toBe('pending');
});
