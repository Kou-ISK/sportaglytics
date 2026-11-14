// @vitest-environment jsdom
import { useLayoutEffect } from 'react';
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useVideoTimeController } from './useVideoTimeController';

vi.mock('../../shared/videojs/videoJsAdapter', () => ({
  getVideoJsPlayer: vi.fn(),
  setVideoJsPlayerCurrentTime: vi.fn(),
}));

it('does not abort a new-owner seek started before the previous passive cleanup', async () => {
  const frames = new Map<number, FrameRequestCallback>();
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => frames.delete(key));
  let work: Promise<number | null> | undefined;
  const videos: string[] = [];
  const angles: never[] = [];
  const hook = renderHook(
    ({ mode }: { mode: 'auto' | 'manual' }) => {
      const controller = useVideoTimeController({
        videoList: videos,
        syncMode: mode,
        syncData: undefined,
        mediaAngles: angles,
      });
      useLayoutEffect(() => {
        if (mode === 'manual')
          work = controller.seekReverse(3, new AbortController().signal);
      }, [mode, controller.seekReverse]);
      return controller;
    },
    { initialProps: { mode: 'auto' as 'auto' | 'manual' } },
  );
  hook.rerender({ mode: 'manual' });
  expect(work).toBeDefined();
  await act(async () => {
    for (let i = 0; i < 2; i++) {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((cb) => cb(0));
    }
    await work;
  });
  expect(await work).toBeNull();
  hook.unmount();
  vi.unstubAllGlobals();
});
