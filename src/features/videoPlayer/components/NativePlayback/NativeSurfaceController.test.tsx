// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { useState } from 'react';
import type { ReactElement } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import type { IElectronAPI } from '../../../../renderer';
import { useNativePackageClock } from '../../app/hooks/useNativePackageClock';
import { NativePlaybackController } from '../../shared/nativePlayback/nativePlaybackController';
import { bindNativePlayback } from '../../shared/nativePlayback/nativePlaybackRegistry';
import { nativePresentedTime } from '../../shared/nativePlayback/nativePresentedFrame';
import { hasNativeSurface } from '../../shared/nativePlayback/nativeSurfaceBinding';
import {
  claimNativePlayback,
  htmlPlaybackAllowed,
} from '../../shared/nativePlayback/playbackAuthority';
import { NativeSurfaceController } from './NativeSurfaceController';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('shows a verified intermediate original image and clock while retaining the lease for the latest seek', async () => {
  vi.useFakeTimers();
  const owner = { generation: 'one', sourceKey: 'a'.repeat(64) };
  const source = 'file:///synthetic.mp4';
  const api: IElectronAPI['nativePlayback'] = {
    inspect: async () => {
      throw Error('not inspected');
    },
    open: async () => {},
    apply: async () => {},
    observe: async () => ({
      intent: null,
      observation: null,
      lastConfirmedTime: 3,
      error: null,
      closing: false,
      closed: false,
    }),
    onSnapshot: () => () => {},
    close: async () => ({
      generation: owner.generation,
      nativeDrained: true,
      processStarted: true,
      processExited: true,
      pipesClosed: true,
      stopped: null,
    }),
  };
  const first = Promise.withResolvers<void>();
  const latest = Promise.withResolvers<void>();
  const restore = vi
    .fn()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(latest.promise);
  const release = claimNativePlayback();
  let unbind = (): void => {};
  const controller = new NativePlaybackController(
    api,
    owner,
    source,
    3,
    { playing: false, rate: 1, audioTrack: 0, volume: 0.5, muted: true },
    {
      pause: () => {},
      restore,
      release: () => {
        unbind();
        release();
      },
    },
    {
      width: 1920,
      height: 1080,
      start: 0,
      end: 20,
      seekEnd: 19,
      playEnd: 19.5,
      rates: [1],
      audioTracks: 3,
      seekGrid: null,
      mutedOnly: true,
      exactFloatVolume: true,
      audioSwitch: false,
    },
  );
  unbind = bindNativePlayback(controller);
  type Surface = NonNullable<IElectronAPI['nativeSurface']>;
  let onFrame: Parameters<Surface['bind']>[1] | undefined;
  const detach = vi.fn();
  const bind: Surface['bind'] = (_id, callback) => {
    onFrame = callback;
    return detach;
  };
  vi.stubGlobal('electronAPI', { nativeSurface: { bind } });
  const mount = document.createElement('div');
  document.body.append(mount);
  const Screen = (): ReactElement => {
    const [time, setTime] = useState(3);
    const [playing, setPlaying] = useState(false);
    useNativePackageClock(source, playing, 1, setTime, setPlaying);
    return (
      <>
        <output aria-label="confirmed tag/save clock">{time}</output>
        <NativeSurfaceController id="video_0" source={source} mount={mount} />
      </>
    );
  };
  const screen = render(<Screen />);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1);
  });
  act(() => onFrame?.({ generation: 'one', seekId: 1, pts: 3, timescale: 1 }));
  const canvas = screen.getByLabelText('ネイティブ再生映像');
  if (!(canvas instanceof HTMLCanvasElement)) throw Error('canvas required');
  expect(canvas.style.visibility).toBe('visible');
  expect(nativePresentedTime(controller)).toBe(3.000000001);
  act(() => onFrame?.({ generation: 'old', seekId: 1, pts: 8, timescale: 1 }));
  expect(nativePresentedTime(controller)).toBe(3.000000001);
  let recovery: Promise<void> | undefined;
  await act(async () => {
    controller.seek(40);
    recovery = controller.returnToOriginal();
    await vi.advanceTimersByTimeAsync(1);
    controller.seek(42);
  });
  expect(canvas.style.visibility).toBe('visible');
  expect(htmlPlaybackAllowed()).toBe(false);
  await act(async () => {
    first.resolve();
    await vi.advanceTimersByTimeAsync(1);
  });
  expect(screen.getByLabelText('ネイティブ再生映像')).toBe(canvas);
  expect(canvas.style.visibility).toBe('hidden');
  expect(screen.getByLabelText('confirmed tag/save clock').textContent).toBe(
    '40',
  );
  expect(controller.seekCommandTime).toBe(42);
  expect(restore.mock.calls.map(([time]) => time)).toEqual([40, 42]);
  expect(htmlPlaybackAllowed()).toBe(false);
  expect(hasNativeSurface(source)).toBe(true);
  expect(detach).not.toHaveBeenCalled();
  expect(nativePresentedTime(controller)).toBe(40);
  await act(async () => {
    latest.resolve();
    await recovery;
  });
  expect(htmlPlaybackAllowed()).toBe(true);
  screen.unmount();
  mount.remove();
  expect(detach).toHaveBeenCalledOnce();
});
