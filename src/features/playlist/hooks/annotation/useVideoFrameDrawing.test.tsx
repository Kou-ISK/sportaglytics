import {
  bindVideoFrameClock,
  releaseVideoFrameClock,
} from '../../../../shared/media/videoFrameClock';
// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useVideoFrameDrawing } from './useVideoFrameDrawing';

it('draws the presented video time synchronously and keeps React clock updates from replacing it', () => {
  const video = document.createElement('video');
  Object.defineProperty(video, 'paused', { value: false, configurable: true });
  video.currentTime = 1.12;
  let callback: VideoFrameRequestCallback | undefined;
  video.requestVideoFrameCallback = vi.fn((next) => {
    callback = next;
    return 7;
  });
  video.cancelVideoFrameCallback = vi.fn();
  const videoRef = { current: video };
  const first = vi.fn();
  const { rerender, unmount } = renderHook(
    ({ draw }) => useVideoFrameDrawing(videoRef, true, draw),
    { initialProps: { draw: first } },
  );
  const metadata: VideoFrameCallbackMetadata = {
    mediaTime: 1,
    presentationTime: 0,
    expectedDisplayTime: 0,
    width: 640,
    height: 360,
    presentedFrames: 30,
    processingDuration: 0,
  };
  Object.defineProperty(video, 'currentSrc', {
    value: 'file:///D.mp4',
    configurable: true,
  });
  bindVideoFrameClock(video, 'file:///D.mp4', -8);
  act(() => callback?.(0, metadata));
  expect(first).toHaveBeenLastCalledWith(9);
  releaseVideoFrameClock(video);
  act(() => callback?.(0, metadata));
  expect(first).toHaveBeenLastCalledWith(1);
  const updated = vi.fn();
  rerender({ draw: updated });
  expect(updated).toHaveBeenLastCalledWith(1);
  act(() => callback?.(0, { ...metadata, mediaTime: 1 + 1 / 30 }));
  expect(updated).toHaveBeenLastCalledWith(1 + 1 / 30);
  Object.defineProperty(video, 'paused', { value: true });
  const paused = vi.fn();
  rerender({ draw: paused });
  expect(paused).toHaveBeenLastCalledWith(undefined);
  unmount();
  expect(video.cancelVideoFrameCallback).toHaveBeenCalledWith(7);
  act(() => callback?.(0, { ...metadata, mediaTime: 2 }));
  expect(paused).toHaveBeenCalledOnce();
});
