import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { CacheWorkerEvents } from '../../playbackCache/cacheConversionRunner';
import { spawnCacheWorker } from '../../playbackCache/cacheWorkerProcess';
import { parseNativeGroupCapability, probeNativeGroupCapability } from './groupCapability';

vi.mock('../../playbackCache/cacheWorkerProcess', () => ({ spawnCacheWorker: vi.fn() }));
const declared = { version: 1, transport: 2, mode: 'placed-pair-decoded-samples',
  angles: 2, clipsPerAngle: 1, timescale: 120000, imageBudgetBytes: 536870912,
  stopAuthority: 'submitted-pair-v1' };
const children: Array<{ events: CacheWorkerEvents; terminate: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn> }> = [];
let started: () => void;
let start: Promise<void>;
beforeEach(() => {
  vi.useFakeTimers();
  children.length = 0;
  start = new Promise<void>((resolve) => { started = resolve; });
  vi.mocked(spawnCacheWorker).mockReset().mockImplementation((_host, _args, events) => {
    const child = { events, terminate: vi.fn(() => true), dispose: vi.fn() };
    children.push(child); started(); return child;
  });
});
afterEach(() => { vi.useRealTimers(); });
const response = (index = 0, raw = JSON.stringify(declared)): void => {
  children[index].events.output('progress', Buffer.from(raw));
  children[index].events.closed(0, null);
};
it('copies only the exact finite protocol declaration', () => {
  const value = parseNativeGroupCapability(declared);
  expect(value).toEqual(declared); expect(value).not.toBe(declared);
  expect(Object.isFrozen(value)).toBe(true);
  for (const raw of [null, {}, { ...declared, extra: true },
    { ...declared, angles: 3 }, { ...declared, timescale: 60000 },
    { ...declared, imageBudgetBytes: 1073741824 }, { ...declared, stopAuthority: 'clock' },
    { ...declared, transport: 1 }, { ...declared, mode: 'unknown' }])
    expect(() => parseNativeGroupCapability(raw)).toThrow();
});
it('waits for close after a complete response and passes only the fixed command', async () => {
  const work = probeNativeGroupCapability('/verified/NativeProductHost', new AbortController().signal);
  let settled = false; void work.then(() => { settled = true; });
  await start;
  const body = JSON.stringify(declared);
  children[0].events.output('progress', Buffer.from(body.slice(0, 9)));
  children[0].events.output('progress', Buffer.from(body.slice(9)));
  await Promise.resolve(); expect(settled).toBe(false);
  expect(spawnCacheWorker).toHaveBeenCalledWith('/verified/NativeProductHost',
    ['--group-playback-capabilities'], expect.any(Object));
  children[0].events.closed(0, null);
  await expect(work).resolves.toEqual(declared);
  expect(children[0].dispose).toHaveBeenCalledOnce();
});
it.each(['timeout', 'cancel', 'oversize', 'diagnostic'] as const)(
  'does not infer drainage from %s', async (failure) => {
    const signal = new AbortController();
    const work = probeNativeGroupCapability('/verified/NativeProductHost', signal.signal);
    const result = work.then(() => 'accepted', () => 'rejected');
    let settled = false; void result.then(() => { settled = true; });
    await start;
    if (failure === 'timeout') await vi.advanceTimersByTimeAsync(2000);
    else if (failure === 'cancel') signal.abort();
    else children[0].events.output(failure === 'diagnostic' ? 'diagnostic' : 'progress',
      Buffer.from(failure === 'oversize' ? 'x'.repeat(4097) : 'unexpected stderr'));
    await Promise.resolve();
    expect(children[0].terminate).toHaveBeenCalledOnce();
    expect(settled).toBe(false); expect(children[0].dispose).not.toHaveBeenCalled();
    children[0].events.closed(null, 'SIGTERM');
    expect(await result).toBe('rejected'); expect(children[0].dispose).toHaveBeenCalledOnce();
  },
);
it.each(['', '{', '{}'])( 'rejects malformed or unknown response %j', async (raw) => {
  const work = probeNativeGroupCapability('/verified/NativeProductHost', new AbortController().signal);
  const result = work.then(() => 'accepted', () => 'rejected'); await start;
  response(0, raw); expect(await result).toBe('rejected');
});
it('does not infer support from an old host exit or failed spawn', async () => {
  const work = probeNativeGroupCapability('/verified/NativeProductHost', new AbortController().signal);
  const result = work.then(() => 'accepted', () => 'rejected'); await start;
  children[0].events.error(Error('spawn failed'));
  children[0].events.closed(64, null); expect(await result).toBe('rejected');
});
it('does not start an already cancelled caller', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(probeNativeGroupCapability('/verified/NativeProductHost', controller.signal)).rejects.toThrow();
  expect(spawnCacheWorker).not.toHaveBeenCalled();
});
it('keeps cancellation local to one caller', async () => {
  const first = new AbortController();
  const a = probeNativeGroupCapability('/verified/NativeProductHost', first.signal);
  const aResult = a.then(() => 'accepted', () => 'rejected'); await start;
  start = new Promise<void>((resolve) => { started = resolve; });
  const b = probeNativeGroupCapability('/verified/NativeProductHost', new AbortController().signal);
  await start; first.abort();
  expect(children[0].terminate).toHaveBeenCalledOnce();
  expect(children[1].terminate).not.toHaveBeenCalled();
  response(1); await expect(b).resolves.toEqual(declared);
  children[0].events.closed(null, 'SIGTERM'); expect(await aResult).toBe('rejected');
});
