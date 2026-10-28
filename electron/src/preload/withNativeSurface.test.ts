import { afterEach, expect, it, vi } from 'vitest';
import type { IElectronAPI } from '../../../src/renderer';
import { withSurface } from './withNativeSurface';

const surface = vi.hoisted(() => ({
  prepare: vi.fn(),
  expect: vi.fn(),
  close: vi.fn(),
  bind: vi.fn(),
}));
vi.mock('./nativeSurfaceBridge', () => ({
  createSurfaceBridge: () => surface,
}));
afterEach(() => vi.clearAllMocks());
const owner = { generation: 'owner', sourceKey: 'a'.repeat(64) };
const intent = {
  ...owner,
  sequence: 2,
  seekId: 2,
  targetTime: 3,
  playing: false,
  rate: 1,
  audioTrack: 0,
  muted: true,
  volume: 1,
};
const setup = () => {
  const opening = Promise.withResolvers<void>();
  const applying = Promise.withResolvers<void>();
  const nativePlayback: IElectronAPI['nativePlayback'] = {
    inspect: vi.fn(),
    open: vi.fn(() => opening.promise),
    apply: vi.fn(() => applying.promise),
    observe: vi.fn(),
    onSnapshot: vi.fn(() => () => {}),
    close: vi.fn(),
  };
  // This wrapper touches only nativePlayback; unrelated bridge APIs are not used.
  const wrapped = withSurface({
    nativePlayback,
  } as IElectronAPI).nativePlayback;
  return { opening, applying, nativePlayback, wrapped };
};
it('prepares only a stopped, validated intent of the open owner without waiting for IPC', async () => {
  const f = setup();
  const opened = f.wrapped.open(owner);
  expect(() => f.wrapped.prepareSeek?.(intent)).toThrow();
  f.opening.resolve();
  await opened;
  const oldApply = f.wrapped.apply({ ...intent, seekId: 1, sequence: 1 });
  f.wrapped.prepareSeek?.(intent);
  expect(surface.prepare).toHaveBeenCalledExactlyOnceWith('owner', 2);
  expect(f.nativePlayback.apply).toHaveBeenCalledOnce();
  for (const bad of [
    { ...intent, playing: true },
    { ...intent, sourceKey: 'b'.repeat(64) },
    { ...intent, seekId: NaN },
  ])
    expect(() => f.wrapped.prepareSeek?.(bad)).toThrow();
  expect(surface.prepare).toHaveBeenCalledOnce();
  f.applying.resolve();
  await oldApply;
  await f.wrapped.close(owner);
  expect(() => f.wrapped.prepareSeek?.(intent)).toThrow();
});
it('cannot restore preparation rights when an old open resolves after close', async () => {
  const f = setup();
  const opened = f.wrapped.open(owner);
  await f.wrapped.close(owner);
  f.opening.resolve();
  await opened;
  expect(() => f.wrapped.prepareSeek?.(intent)).toThrow();
  expect(surface.prepare).not.toHaveBeenCalled();
});
