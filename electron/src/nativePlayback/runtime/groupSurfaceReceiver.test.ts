import { Buffer } from 'node:buffer';
import { expect, it } from 'vitest';
import {
  bindNativeGroupReceiver,
  parseNativeGroupSurfacePacket,
} from './groupSurfaceReceiver';

const packet = (): Record<string, unknown> => ({
  id: 1,
  operation: 1,
  seekId: 1,
  pair: 1,
  angle: 0,
  sourceEpoch: 1,
  sourceIndex: 0,
  sourcePTS: 600000,
  sourceEndPTS: 602002,
  globalTicks: 600000,
  globalStart: 600000,
  globalEnd: 602002,
  content: 1,
  surfaceID: 101,
  handle: Buffer.alloc(8),
});
it('parses only the explicit native v2 packet shape and leaves its pointer Main-only', () => {
  const raw = packet();
  const value = parseNativeGroupSurfacePacket(raw);
  expect(value?.content).toBe('image');
  expect(value?.handle).toBe(raw.handle);
  expect(parseNativeGroupSurfacePacket({ ...raw, surfaceHeight: 720 })?.surfaceHeight).toBe(720);
  expect(() => parseNativeGroupSurfacePacket({ ...raw, surfaceHeight: 480 })).toThrow();
  expect(parseNativeGroupSurfacePacket(null)).toBeNull();
  for (const patch of [
    { handle: Buffer.alloc(4) },
    { handle: 'pointer' },
    { generation: 1 },
    { content: 'image' },
    { content: 3 },
    { sourceEndPTS: 600000 },
    { surfaceID: 0 },
  ])
    expect(() => parseNativeGroupSurfacePacket({ ...raw, ...patch })).toThrow();
});
it('rejects an old/unknown addon before opening rather than inferring group support', () => {
  expect(() =>
    bindNativeGroupReceiver({ open: () => null, setPeer: () => null }),
  ).toThrow('NATIVE_GROUP_RECEIVER_UNSUPPORTED');
});
it('binds every operation to its opening token and will not reopen or let late calls use another owner', () => {
  const calls: Array<{ name: string; args: readonly unknown[] }> = [];
  const module: Record<string, unknown> = {};
  for (const name of [
    'openGroupV2',
    'groupSetPeer',
    'groupPoll',
    'groupDrawn',
    'groupRelease',
    'groupRequest',
    'groupCount',
    'groupClose',
  ])
    module[name] = (...args: unknown[]): unknown => {
      calls.push({ name, args });
      return name === 'groupCount' ? 0 : null;
    };
  const native = bindNativeGroupReceiver(module);
  expect(() => native.poll()).toThrow('NATIVE_GROUP_RECEIVER_NOT_OPEN');
  native.open('synthetic-service');
  native.setPeer(10);
  native.drawn(1);
  native.release(1);
  native.request();
  native.count();
  native.close();
  expect(calls.every((call) => call.args[0] === 'synthetic-service')).toBe(
    true,
  );
  expect(() => native.open('other-service')).toThrow('OPEN_ATTEMPTED');
  expect(() => native.poll()).toThrow('NOT_OPEN');
  native.close();
  expect(calls.filter((call) => call.name === 'groupClose')).toHaveLength(1);
});
it('does not turn an invalid count or uncertain close into successful cleanup', () => {
  let closes = 0;
  const cause = Error('original close');
  const module = {
    openGroupV2: () => null,
    groupSetPeer: () => null,
    groupPoll: () => null,
    groupDrawn: () => null,
    groupRelease: () => null,
    groupRequest: () => null,
    groupCount: () => 7,
    groupClose: (): never => {
      closes++;
      throw cause;
    },
  };
  const native = bindNativeGroupReceiver(module);
  native.open('synthetic-service');
  expect(() => native.count()).toThrow();
  expect(() => native.close()).toThrow(cause);
  expect(() => native.close()).toThrow(cause);
  expect(closes).toBe(1);
});
