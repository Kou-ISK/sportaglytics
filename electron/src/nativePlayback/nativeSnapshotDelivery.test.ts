import { expect, it, vi } from 'vitest';
import { NativeSnapshotDelivery } from './nativeSnapshotDelivery';
const owner = { generation: 'one', sourceKey: 'a'.repeat(64) };
const snapshot = (time: number) => ({
  intent: null,
  observation: null,
  lastConfirmedTime: time,
  error: null,
  closing: false,
  closed: false,
});
it('retains only one sent and the latest pending snapshot while the renderer is blocked', () => {
  const send = vi.fn();
  const delivery = new NativeSnapshotDelivery(send);
  for (let i = 0; i < 10000; i++) delivery.publish(owner, snapshot(i));
  expect(send).toHaveBeenCalledTimes(1);
  delivery.acknowledge(owner, 1);
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[1][0].snapshot.lastConfirmedTime).toBe(9999);
  delivery.acknowledge(owner, 1);
  expect(send).toHaveBeenCalledTimes(2);
  delivery.acknowledge(owner, 2);
  expect(send).toHaveBeenCalledTimes(2);
});
it('does not let another owner or a late document acknowledgement release the current notice', () => {
  const send = vi.fn();
  const delivery = new NativeSnapshotDelivery(send);
  delivery.publish(owner, snapshot(1));
  delivery.publish(owner, snapshot(2));
  delivery.acknowledge({ ...owner, generation: 'other' }, 1);
  expect(send).toHaveBeenCalledTimes(1);
  delivery.resetDocument();
  delivery.publish(owner, snapshot(3));
  delivery.publish(owner, snapshot(4));
  delivery.acknowledge(owner, 1);
  expect(send).toHaveBeenCalledTimes(2);
  delivery.acknowledge(owner, 2);
  expect(send).toHaveBeenCalledTimes(3);
  expect(send.mock.calls[2][0].snapshot.lastConfirmedTime).toBe(4);
});
it('bounds a same-document reopen behind the previous acknowledgement', () => {
  const send = vi.fn();
  const delivery = new NativeSnapshotDelivery(send);
  const next = { ...owner, generation: 'next' };
  delivery.publish(owner, snapshot(1));
  delivery.publish(next, snapshot(2));
  delivery.publish(next, snapshot(3));
  expect(send).toHaveBeenCalledTimes(1);
  delivery.acknowledge(owner, 1);
  expect(send.mock.calls[1][0]).toMatchObject({
    owner: next,
    snapshot: { lastConfirmedTime: 3 },
  });
});
it('does not silently retain an unsent notice after transport failure', () => {
  const send = vi.fn(() => {
    throw Error('destroyed sender');
  });
  const delivery = new NativeSnapshotDelivery(send);
  expect(() => delivery.publish(owner, snapshot(1))).toThrow(
    'destroyed sender',
  );
  delivery.acknowledge(owner, 1);
  expect(send).toHaveBeenCalledTimes(1);
});
