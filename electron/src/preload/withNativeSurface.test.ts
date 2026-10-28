import { afterEach, expect, it, vi } from 'vitest';
import type { IElectronAPI } from '../../../src/renderer';
import { withSurface } from './withNativeSurface';

const surface = vi.hoisted(() => ({
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
it('admits a seek before forwarding its asynchronous apply', async () => {
  const f = setup();
  const pending = f.wrapped.apply(intent);
  expect(surface.expect).toHaveBeenCalledExactlyOnceWith('owner', 2);
  expect(f.nativePlayback.apply).toHaveBeenCalledExactlyOnceWith(intent);
  f.applying.resolve();
  await pending;
});
it('still reports an unconfirmed surface close after the native close completes', async () => {
  const f = setup();
  surface.close.mockImplementationOnce(() => {
    throw Error('surface close failed');
  });
  await expect(f.wrapped.close(owner)).rejects.toThrow('surface close failed');
  expect(f.nativePlayback.close).toHaveBeenCalledExactlyOnceWith(owner);
});
