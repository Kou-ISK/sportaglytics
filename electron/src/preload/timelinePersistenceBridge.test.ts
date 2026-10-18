import { expect, it, vi } from 'vitest';
import { TIMELINE_PERSISTENCE_CHANNELS as channels } from '../../../src/types/ipc/timelinePersistence';
import { createTimelinePersistenceBridge } from './timelinePersistenceBridge';

const fixture = () => {
  const listeners = new Map<
    string,
    (event: unknown, payload: unknown) => void
  >();
  const send = vi.fn();
  const bridge = createTimelinePersistenceBridge({
    on: (channel, listener) => listeners.set(channel, listener),
    send,
  });
  const emit = (channel: string, payload: unknown) =>
    listeners.get(channel)?.({}, payload);
  const request = () => ({
    registrationId: send.mock.calls.at(-1)?.[1].registrationId,
    requestId: 'request-1',
  });
  return { bridge, send, emit, request };
};

it('freezes synchronously, acknowledges once after saving and resumes only the matching request', async () => {
  const f = fixture();
  let finish: ((success: boolean) => void) | undefined;
  const flush = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
  );
  const resume = vi.fn();
  f.bridge.registerCloseHandler(flush, resume);
  const request = f.request();
  f.emit(channels.flush, request);
  f.emit(channels.flush, request);
  expect(flush).toHaveBeenCalledOnce();
  expect(f.send).not.toHaveBeenCalledWith(channels.ack, expect.anything());
  finish?.(true);
  await Promise.resolve();
  expect(f.send).toHaveBeenLastCalledWith(channels.ack, {
    ...request,
    success: true,
  });
  f.emit(channels.resume, { ...request, requestId: 'stale' });
  expect(resume).not.toHaveBeenCalled();
  f.emit(channels.resume, request);
  expect(resume).toHaveBeenCalledOnce();
  f.emit(channels.flush, { ...request, requestId: 'request-2' });
  expect(flush).toHaveBeenCalledTimes(2);
});

it('rejects malformed/wrong-owner requests and reports failed saves', async () => {
  const f = fixture();
  const flush = vi.fn().mockRejectedValue(new Error('disk full'));
  f.bridge.registerCloseHandler(flush, vi.fn());
  f.emit(channels.flush, null);
  f.emit(channels.flush, { ...f.request(), registrationId: 'old' });
  expect(flush).not.toHaveBeenCalled();
  const request = f.request();
  f.emit(channels.flush, request);
  await Promise.resolve();
  expect(f.send).toHaveBeenLastCalledWith(channels.ack, {
    ...request,
    success: false,
  });
});

it('does not acknowledge a completed stale save after resume or owner replacement', async () => {
  const f = fixture();
  let finish: ((success: boolean) => void) | undefined;
  const off = f.bridge.registerCloseHandler(
    () =>
      new Promise<boolean>((resolve) => {
        finish = resolve;
      }),
    vi.fn(),
  );
  const request = f.request();
  f.emit(channels.flush, request);
  f.emit(channels.resume, request);
  f.bridge.registerCloseHandler(async () => true, vi.fn());
  off();
  finish?.(true);
  await Promise.resolve();
  expect(f.send).not.toHaveBeenCalledWith(channels.ack, expect.anything());
  expect(f.send).not.toHaveBeenCalledWith(
    channels.unregister,
    expect.anything(),
  );
});
