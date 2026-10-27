import { expect, it, vi } from 'vitest';
import { createNativePlaybackBridge } from './nativePlaybackBridge';
const owner = { generation: 'one', sourceKey: 'a'.repeat(64) };
const snapshot = {
  intent: null,
  observation: null,
  lastConfirmedTime: 3,
  error: null,
  closing: false,
  closed: false,
};
it('filters another owner, rejects malformed notices, and ignores late events after unsubscribe', () => {
  let receive: (value: unknown) => void = () => {};
  const unsubscribe = vi.fn();
  const bridge = createNativePlaybackBridge({
    invoke: vi.fn(),
    acknowledge: vi.fn(),
    subscribe: (listener) => {
      receive = listener;
      return unsubscribe;
    },
  });
  const listener = vi.fn();
  const stop = bridge.onSnapshot(owner, listener);
  receive({ delivery: 1, owner: { ...owner, generation: 'old' }, snapshot });
  expect(listener).not.toHaveBeenCalled();
  receive({ delivery: 1, owner, snapshot });
  expect(listener).toHaveBeenLastCalledWith(snapshot);
  receive({
    delivery: 1,
    owner,
    snapshot: { ...snapshot, lastConfirmedTime: NaN },
  });
  expect(listener).toHaveBeenLastCalledWith(null);
  receive({ delivery: 1, owner, snapshot, unexpected: true });
  expect(listener).toHaveBeenLastCalledWith(null);
  stop();
  expect(unsubscribe).not.toHaveBeenCalled();
  listener.mockClear();
  receive({ delivery: 1, owner, snapshot });
  expect(listener).not.toHaveBeenCalled();
});
it('does not mistake an application callback exception for a malformed payload', () => {
  let receive: (value: unknown) => void = () => {};
  const bridge = createNativePlaybackBridge({
    invoke: vi.fn(),
    acknowledge: vi.fn(),
    subscribe: (listener) => {
      receive = listener;
      return () => {};
    },
  });
  const listener = vi.fn(() => {
    throw Error('consumer');
  });
  bridge.onSnapshot(owner, listener);
  expect(() => receive({ delivery: 1, owner, snapshot })).toThrow('consumer');
  expect(listener).toHaveBeenCalledOnce();
});

it('acknowledges notices after logical unsubscribe and for another owner so a reopen cannot strand delivery', () => {
  let receive: (value: unknown) => void = () => {};
  const acknowledge = vi.fn();
  const bridge = createNativePlaybackBridge({
    invoke: vi.fn(),
    acknowledge,
    subscribe: (listener) => {
      receive = listener;
      return () => {};
    },
  });
  const listener = vi.fn();
  const stop = bridge.onSnapshot(owner, listener);
  expect(() => bridge.onSnapshot(owner, listener)).toThrow(
    'NATIVE_ALREADY_SUBSCRIBED',
  );
  stop();
  receive({ owner, delivery: 5, snapshot });
  expect(listener).not.toHaveBeenCalled();
  expect(acknowledge).toHaveBeenLastCalledWith({ owner, delivery: 5 });
  bridge.onSnapshot({ ...owner, generation: 'next' }, listener);
  receive({ owner, delivery: 6, snapshot });
  expect(listener).not.toHaveBeenCalled();
  expect(acknowledge).toHaveBeenLastCalledWith({ owner, delivery: 6 });
});

it('only invokes the dedicated numeric failure endpoint with validated values', async () => {
  const invoke = vi.fn(async () => undefined);
  const bridge = createNativePlaybackBridge({
    invoke,
    acknowledge: vi.fn(),
    subscribe: () => () => {},
  });
  const failure = {
    stage: 2,
    code: 26,
    sequence: 1,
    seekId: 1,
    targetTime: 3,
    confirmedTime: 2,
  };
  if (!bridge.reportFailure) throw Error('missing failure bridge');
  await expect(
    bridge.reportFailure(owner, { ...failure, code: NaN }),
  ).rejects.toThrow();
  expect(invoke).not.toHaveBeenCalled();
  await bridge.reportFailure(owner, failure);
  expect(invoke).toHaveBeenCalledExactlyOnceWith(
    'native-playback:report-failure',
    { owner, failure },
  );
});
