import { expect, it, vi } from 'vitest';
import { createNativeGroupControlBridge } from './nativeGroupControlBridge';
import type { NativePlaybackIntent } from '../../../src/types/ipc/nativePlayback';
import type { NativeGroupPresentation } from '../../../src/types/ipc/nativeGroupSurface';
const owner = { generation: 'owner', sourceKey: 'a'.repeat(64) };
const intent = (sequence: number, playing = false): NativePlaybackIntent => ({
  ...owner,
  sequence,
  seekId: 1,
  targetTime: 20,
  playing,
  rate: -2,
  audioTrack: 0,
  volume: 1,
  muted: true,
});
const pair = (operation = 2, seekId = 1): NativeGroupPresentation => ({
  document: 'doc',
  generation: owner.generation,
  operation,
  seekId,
  pair: 4,
  globalTicks: 2300000,
  ids: [7, 8],
});
it('captures a complete pair before synchronously revoking the old paint operation', () => {
  const order: string[] = [];
  const surface = {
    freeze: () => {
      order.push('freeze');
      return pair();
    },
    expect: (_generation: string, operation: number) => {
      order.push('expect-' + operation);
    },
  };
  const bridge = createNativeGroupControlBridge(owner, surface);
  bridge.prepare(intent(1));
  bridge.prepare(intent(2, true));
  order.length = 0;
  const stop = bridge.prepare(intent(3));
  expect(order).toEqual(['freeze', 'expect-3']);
  expect(stop.presentationFence).toEqual(pair());
  expect(stop.targetTime).toBe(20); // requested seek remains separate from the drawn anchor
});
it('rejects caller-created receipts, stale operations and other owners before changing admission', () => {
  const surface = { freeze: vi.fn(() => pair()), expect: vi.fn() };
  const bridge = createNativeGroupControlBridge(owner, surface);
  bridge.prepare(intent(1));
  bridge.prepare(intent(2, true));
  surface.expect.mockClear();
  for (const raw of [
    intent(1),
    { ...intent(3), generation: 'other' },
    { ...intent(3), sourceKey: 'b'.repeat(64) },
    { ...intent(3), presentationFence: pair() },
  ])
    expect(() => bridge.prepare(raw)).toThrow();
  expect(surface.expect).not.toHaveBeenCalled();
  expect(bridge.prepare(intent(3)).presentationFence).toEqual(pair());
});
it('does not reuse a prior seek picture for a short press during a new seek', () => {
  const surface = { freeze: vi.fn(() => pair(2, 1)), expect: vi.fn() };
  const bridge = createNativeGroupControlBridge(owner, surface);
  bridge.prepare(intent(1));
  bridge.prepare(intent(2, true));
  expect(
    bridge.prepare({ ...intent(3), seekId: 2, targetTime: 5 })
      .presentationFence,
  ).toBeUndefined();
  bridge.prepare({ ...intent(4, true), seekId: 2, targetTime: 5 });
  expect(() =>
    bridge.prepare({ ...intent(5), seekId: 2, targetTime: 5 }),
  ).toThrow('FENCE_OWNER');
  expect(surface.expect).toHaveBeenLastCalledWith('owner', 4, 2);
});
it('revokes pending paint even when no complete pair exists, without inventing a clock', () => {
  const surface = { freeze: () => null, expect: vi.fn() };
  const bridge = createNativeGroupControlBridge(owner, surface);
  bridge.prepare(intent(1));
  bridge.prepare(intent(2, true));
  expect(() => bridge.prepare(intent(3))).toThrow();
  expect(surface.expect).toHaveBeenLastCalledWith('owner', 2, 1);
});
it('keeps a new re-press distinct from the old released request', () => {
  let shown = pair();
  const bridge = createNativeGroupControlBridge(owner, {
    freeze: () => shown,
    expect: () => {},
  });
  bridge.prepare(intent(1));
  bridge.prepare(intent(2, true));
  bridge.prepare(intent(3));
  bridge.prepare(intent(4, true));
  shown = { ...pair(4), pair: 5, ids: [9, 10] };
  expect(bridge.prepare(intent(5)).presentationFence).toEqual(shown);
});

it('preserves selected and latest release barriers without re-enabling paint for an older stop', () => {
  const surface = { freeze: vi.fn(() => pair()), expect: vi.fn() };
  const bridge = createNativeGroupControlBridge(owner, surface);
  bridge.prepare(intent(1));
  bridge.prepare(intent(2, true));
  bridge.freeze(intent(3));
  bridge.freeze(intent(5));
  bridge.freeze(intent(7));
  surface.expect.mockClear();
  expect(() => bridge.prepare(intent(4, true))).toThrow('STOP_FENCE_PENDING');
  expect(bridge.prepare(intent(3)).presentationFence).toEqual(pair());
  expect(surface.expect).not.toHaveBeenCalled();
  expect(() => bridge.prepare(intent(5))).toThrow('STOP_FENCE_PENDING');
  expect(bridge.prepare(intent(7)).presentationFence).toEqual(pair());
  expect(surface.expect).toHaveBeenCalledExactlyOnceWith('owner', 7, 1);
  bridge.prepare(intent(8, true));
});
it('explicit new seek supersedes an unsent release without accepting a later old release', () => {
  const bridge = createNativeGroupControlBridge(owner, {
    freeze: () => pair(),
    expect: vi.fn(),
  });
  bridge.prepare(intent(1));
  bridge.prepare(intent(2, true));
  bridge.freeze(intent(3));
  expect(
    bridge.prepare({ ...intent(4), seekId: 2 }).presentationFence,
  ).toBeUndefined();
  expect(() => bridge.prepare(intent(3))).toThrow('CONTROL_ORDER');
});

it('forwards an already selected play writer before its later frozen stop without allowing more paint', () => {
  const surface = { freeze: vi.fn(() => pair(1)), expect: vi.fn() };
  const bridge = createNativeGroupControlBridge(owner, surface);
  bridge.prepare(intent(1));
  bridge.freeze(intent(3));
  surface.expect.mockClear();
  expect(bridge.prepare(intent(2, true)).presentationFence).toBeUndefined();
  expect(surface.expect).not.toHaveBeenCalled();
  expect(bridge.prepare(intent(3)).presentationFence).toEqual(pair(1));
  expect(surface.expect).toHaveBeenCalledExactlyOnceWith('owner', 3, 1);
});
