import { expect, it, vi } from 'vitest';
import type { IElectronAPI } from '../../../../renderer';
import type { NativePlaybackController } from './nativePlaybackController';
import type { NativeGesturePhase } from '../../../../types/ipc/nativeCommandLeft';
import { createCommandGestureAdapter } from './commandGestureAdapter';
const event = (phase: 'down' | 'up', serial: number) => ({ phase, serial, gesture: 1, epoch: 1, meta: true, shift: false, alt: false, control: false });
const tick = async (): Promise<void> => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const make = () => {
  let revision = 4; let held = true;
  let controls = { playing: true, rate: -6, audioTrack: 0, volume: 1, muted: false };
  const controller = {
    prepareCommandGesture: vi.fn(async () => true),
    reserveCommandGesture: vi.fn(() => 1), interruptCommandGesture: vi.fn(),
    startCommandGesture: vi.fn(async () => 1), hasCommandGesture: () => held,
    get commandRevision() { return revision; }, get requestedControls() { return controls; },
    stopCommandGesture: () => { controls = { ...controls, playing: false }; return ++revision; },
    normalizeCommandGesture: () => { controls = { ...controls, playing: false, rate: 1 }; revision++; return true; },
    get hasConfirmedSeek() { return true; }, isFallingBack: false,
    snapshot: () => ({ phase: 'active', observation: { phase: 'paused', videoReady: true, audioReady: true } }),
    subscribe: () => () => {},
  } as unknown as NativePlaybackController;
  const api = { claim: vi.fn(async (): Promise<NativeGesturePhase> => 'active'), apply: vi.fn(async () => {}),
    retire: vi.fn(async () => true), revoke: vi.fn(async () => 'revoked' as const),
    ready: vi.fn(async () => 1), onEvent: () => () => {}, onOverflow: () => () => {} } satisfies NonNullable<IElectronAPI['nativeCommandLeft']>;
  const onControls = vi.fn(); const onFailure = vi.fn();
  const adapter = createCommandGestureAdapter({ api, epoch: 1, current: () => controller, onControls, onFailure });
  return { adapter, api, controller, onControls, onFailure, interrupt: () => { held = false; } };
};
it('routes the same gesture through claim, guarded start, drawn stop and retirement', async () => {
  const f = make(); f.adapter.receive(event('down', 1)); await tick();
  expect(f.api.claim).toHaveBeenCalledWith(1, 1);
  expect(f.controller.startCommandGesture).toHaveBeenCalledOnce();
  expect(f.onControls).toHaveBeenCalledWith(true, -6);
  f.adapter.receive(event('up', 2)); await tick();
  expect(f.api.retire).toHaveBeenCalledWith(1, 1);
  expect(f.onControls).toHaveBeenLastCalledWith(false, 1);
  expect(f.onFailure).not.toHaveBeenCalled();
});
it('finishes cancellation on confirmed revoke without waiting for a lost claim response', async () => {
  const f = make(); const claim = Promise.withResolvers<'active' | 'ended' | 'invalid'>();
  f.api.claim.mockReturnValueOnce(claim.promise);
  f.adapter.receive(event('down', 1)); await tick();
  await f.adapter.cancel(); expect(f.api.revoke).toHaveBeenCalledOnce();
  claim.resolve('active'); await tick();
  expect(f.controller.startCommandGesture).not.toHaveBeenCalled();
});
it('waits for the controller writer before asking Main to capture the next gesture', async () => {
  const f = make(); const ready = Promise.withResolvers<boolean>();
  vi.mocked(f.controller.prepareCommandGesture).mockReturnValueOnce(ready.promise);
  f.adapter.receive(event('down', 1)); await tick();
  expect(f.api.claim).not.toHaveBeenCalled();
  ready.resolve(true); await tick();
  expect(f.api.claim).toHaveBeenCalledWith(1, 1);
});
it('waits for captured-owner revoke when another operation supersedes the hold', async () => {
  const f = make(); f.adapter.receive(event('down', 1)); await tick();
  f.interrupt(); f.adapter.receive(event('up', 2)); await tick();
  expect(f.api.revoke).toHaveBeenCalledOnce(); expect(f.api.retire).not.toHaveBeenCalled();
});
it('never normalizes after cancellation if an old retirement reply arrives late', async () => {
  const f = make(); const retirement = Promise.withResolvers<boolean>();
  f.api.retire.mockReturnValueOnce(retirement.promise);
  f.adapter.receive(event('down', 1)); await tick();
  f.adapter.receive(event('up', 2)); await tick();
  expect(f.api.retire).toHaveBeenCalledOnce();
  await f.adapter.cancel();
  retirement.resolve(true); await tick();
  expect(f.onControls).not.toHaveBeenCalledWith(false, 1);
});
it('fails closed when the revoke IPC never replies', async () => {
  vi.useFakeTimers();
  try {
    const f = make(); f.api.revoke.mockReturnValueOnce(new Promise(() => {}));
    const result = expect(f.adapter.cancel()).rejects.toThrow('NATIVE_GESTURE_REVOKE_TIMEOUT');
    await vi.advanceTimersByTimeAsync(5001); await result;
    f.adapter.receive(event('down', 1)); await tick();
    expect(f.api.claim).not.toHaveBeenCalled();
  } finally { vi.useRealTimers(); }
});
