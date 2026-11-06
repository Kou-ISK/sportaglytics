import { expect, it, vi } from 'vitest';
import type { NativePlaybackController } from './nativePlaybackController';
import { completeCommandGesture } from './completeCommandGesture';

const make = () => {
  let revision = 4; let listener = (): void => {}; let ready = false;
  let controls = { playing: true, rate: -6, audioTrack: 0, volume: 1, muted: false };
  const applyControls = vi.fn((value: Partial<typeof controls>) => { controls = { ...controls, ...value }; revision++; });
  const native = {
    get commandRevision() { return revision; }, get requestedControls() { return controls; },
    get hasConfirmedSeek() { return true; }, isFallingBack: false,
    snapshot: () => ({ phase: 'active', observation: ready ? { phase: 'paused', videoReady: true, audioReady: true } : null }),
    subscribe: (fn: () => void) => { listener = fn; return () => {}; },
    controls: applyControls,
    stopCommandGesture: (id: number) => { if (id !== 1) return null; applyControls({ playing: false, rate: -6 }); return revision; },
    normalizeCommandGesture: (id: number, expected: number) => { if (id !== 1 || expected !== revision) return false; applyControls({ playing: false, rate: 1 }); return true; },
  } as unknown as NativePlaybackController;
  return { native, confirm: () => { ready = true; listener(); }, supersede: () => { revision++; } };
};
it('waits for drawn stop and Main retirement before normalizing', async () => {
  const f = make(); const retire = vi.fn(async () => true); const normalized = vi.fn();
  const work = completeCommandGesture(f.native, 6, 1, 4, () => f.native, retire, new AbortController().signal, normalized);
  expect(retire).not.toHaveBeenCalled(); f.confirm(); await work;
  expect(retire).toHaveBeenCalledOnce();
  expect(f.native.controls).toHaveBeenNthCalledWith(1, { playing: false, rate: -6 });
  expect(f.native.controls).toHaveBeenNthCalledWith(2, { playing: false, rate: 1 });
  expect(normalized).toHaveBeenCalledOnce();
});
it('never normalizes over a new operation while retirement is pending', async () => {
  const f = make(); const pending = Promise.withResolvers<boolean>(); const normalized = vi.fn();
  const work = completeCommandGesture(f.native, 6, 1, 4, () => f.native, () => pending.promise, new AbortController().signal, normalized);
  f.confirm(); await Promise.resolve(); f.supersede(); pending.resolve(true); await work;
  expect(f.native.controls).toHaveBeenCalledOnce(); expect(normalized).not.toHaveBeenCalled();
});
it('does not normalize if Main cannot confirm retirement', async () => {
  const f = make(); const normalized = vi.fn();
  const work = completeCommandGesture(f.native, 6, 1, 4, () => f.native, async () => false, new AbortController().signal, normalized);
  f.confirm(); await expect(work).rejects.toThrow('NATIVE_GESTURE_RETIRE_UNCONFIRMED');
  expect(f.native.controls).toHaveBeenCalledOnce(); expect(normalized).not.toHaveBeenCalled();
});
it('does not publish normalized UI if a synchronous subscriber aborts during normalization', async () => {
  const f = make(); const abort = new AbortController(); const normalized = vi.fn();
  const controls = vi.mocked(f.native.controls);
  const original = controls.getMockImplementation();
  if (!original) throw Error('missing controls');
  controls.mockImplementation((value) => { original(value); if (value.rate === 1) abort.abort(); });
  const work = completeCommandGesture(f.native, 6, 1, 4, () => f.native, async () => true, abort.signal, normalized);
  f.confirm(); await work;
  expect(normalized).not.toHaveBeenCalled();
});
it('does not wait forever for a lost retirement response after cancellation', async () => {
  const f = make(); const abort = new AbortController(); const normalized = vi.fn();
  const work = completeCommandGesture(f.native, 6, 1, 4, () => f.native,
    () => new Promise<boolean>(() => {}), abort.signal, normalized);
  f.confirm(); await Promise.resolve(); abort.abort();
  await expect(work).rejects.toThrow('NATIVE_GESTURE_RETIRE_CANCELLED');
  expect(normalized).not.toHaveBeenCalled();
});
