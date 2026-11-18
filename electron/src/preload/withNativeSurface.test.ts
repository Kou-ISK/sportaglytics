import { afterEach, expect, it, vi } from 'vitest';
import type { IElectronAPI } from '../../../src/renderer';
import { withSurface } from './withNativeSurface';

const surface = vi.hoisted(() => ({
  expect: vi.fn(),
  close: vi.fn(),
  bind: vi.fn(),
  group: {
    bind: vi.fn(() => () => {}),
    expect: vi.fn(),
    current: vi.fn(),
    freeze: vi.fn(),
  },
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
  const bridge = withSurface({
    nativePlayback,
  } as IElectronAPI);
  return {
    opening,
    applying,
    nativePlayback,
    wrapped: bridge.nativePlayback,
    group: bridge.nativeGroupSurface,
  };
};
it('admits a seek before forwarding its asynchronous apply', async () => {
  const f = setup();
  const pending = f.wrapped.apply(intent);
  expect(surface.expect).toHaveBeenCalledExactlyOnceWith('owner', 2, 2, 1);
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

it('opens a Main-accepted group owner and forwards only preload-captured release evidence', async () => {
  const f = setup();
  if (!f.group) throw Error('missing typed group bridge');
  f.group.bind(['left', 'right'], () => {});
  const paused = { ...intent, sequence: 1, seekId: 1, rate: -2 };
  await expect(f.wrapped.apply(paused)).rejects.toThrow('OWNER_NOT_OPEN');
  expect(f.nativePlayback.apply).not.toHaveBeenCalled();
  const opening = f.wrapped.open(owner);
  f.opening.resolve();
  await opening;
  f.applying.resolve();
  await f.wrapped.apply(paused);
  await f.wrapped.apply({ ...paused, sequence: 2, playing: true });
  const receipt = {
    document: 'doc',
    generation: 'owner',
    operation: 2,
    seekId: 1,
    pair: 1,
    globalTicks: 300000,
    ids: [1, 2],
  };
  surface.group.freeze.mockReturnValue(receipt);
  if (!f.wrapped.freezePresentation) throw Error('missing synchronous fence');
  f.wrapped.freezePresentation({ ...paused, sequence: 3 });
  surface.group.freeze.mockReturnValue({ ...receipt, pair: 2, globalTicks: 299000 });
  await f.wrapped.apply({ ...paused, sequence: 3 });
  expect(surface.group.freeze).toHaveBeenCalledOnce();
  expect(f.nativePlayback.apply).toHaveBeenLastCalledWith({
    ...paused,
    sequence: 3,
    presentationFence: receipt,
  });
  expect(surface.group.expect).toHaveBeenLastCalledWith('owner', 3, 1);
  expect(surface.expect).not.toHaveBeenCalled();
});
it('stale group cleanup and old-owner calls cannot revoke the new pair binding', async () => {
  const f = setup();
  if (!f.group) throw Error('missing group bridge');
  const firstRelease = vi.fn(),
    secondRelease = vi.fn();
  surface.group.bind
    .mockReturnValueOnce(firstRelease)
    .mockReturnValueOnce(secondRelease);
  const release = f.group.bind(['left', 'right'], () => {});
  const opened = f.wrapped.open(owner);
  f.opening.resolve();
  await opened;
  release();
  f.group.bind(['new-left', 'new-right'], () => {});
  const nextOwner = { generation: 'next', sourceKey: 'b'.repeat(64) };
  await f.wrapped.open(nextOwner);
  release();
  expect(firstRelease).toHaveBeenCalledOnce();
  expect(secondRelease).not.toHaveBeenCalled();
  surface.group.expect.mockClear();
  await expect(
    f.wrapped.apply({ ...intent, sequence: 1, seekId: 1 }),
  ).rejects.toThrow('CONTROL_OWNER');
  expect(surface.group.expect).not.toHaveBeenCalled();
  f.nativePlayback.close.mockRejectedValueOnce(
    Error('Main rejects stale owner'),
  );
  await expect(f.wrapped.close(owner)).rejects.toThrow(
    'Main rejects stale owner',
  );
  expect(surface.close).not.toHaveBeenCalled();
});
it('does not accept a Main open whose canvas binding changed while it was pending', async () => {
  const f = setup();
  if (!f.group) throw Error('missing group bridge');
  const release = f.group.bind(['left', 'right'], () => {});
  const opened = f.wrapped.open(owner);
  release();
  f.group.bind(['replacement-left', 'replacement-right'], () => {});
  f.opening.resolve();
  await expect(opened).rejects.toThrow('BINDING_CHANGED');
  await expect(f.wrapped.apply(intent)).rejects.toThrow('OWNER_NOT_OPEN');
  expect(f.nativePlayback.apply).not.toHaveBeenCalled();
});
it('rejects a group fence on the legacy surface path', async () => {
  const f = setup();
  await expect(
    f.wrapped.apply({
      ...intent,
      sequence: 3,
      seekId: 1,
      presentationFence: {
        generation: 'owner',
        document: 'doc',
        operation: 2,
        seekId: 1,
        pair: 1,
        globalTicks: 300000,
        ids: [1, 2],
      },
    }),
  ).rejects.toThrow('STOP_AUTHORITY');
  expect(f.nativePlayback.apply).not.toHaveBeenCalled();
});
