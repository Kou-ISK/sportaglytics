// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { waitForVideoPresentation } from './waitForVideoPresentation';
const setup = () => {
  vi.useFakeTimers();
  const raf = new Map<number, FrameRequestCallback>();
  let serial = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    raf.set(++serial, callback);
    return serial;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => raf.delete(id));
  const video = document.createElement('video');
  let receive: VideoFrameRequestCallback = () => {};
  video.requestVideoFrameCallback = vi.fn((callback) => {
    receive = callback;
    return ++serial;
  });
  video.cancelVideoFrameCallback = vi.fn();
  Object.defineProperty(video, 'currentSrc', {
    configurable: true,
    value: 'file:///synthetic.mp4',
  });
  Object.defineProperty(video, 'readyState', { value: 4 });
  const target = { video, source: video.currentSrc, time: 10, offset: 0.7 };
  const paint = (): void => {
    const pending = [...raf.values()];
    raf.clear();
    pending.forEach((callback) => callback(0));
  };
  const image = (pts: number): void =>
    receive(0, {
      mediaTime: pts,
      expectedDisplayTime: 0,
      presentationTime: 0,
      presentedFrames: 1,
      width: 320,
      height: 180,
    });
  return { video, target, paint, image };
};
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it('does not confirm the assigned clock or receipt before the paint fence', async () => {
  const f = setup();
  const done = vi.fn();
  const work = waitForVideoPresentation(
    [f.target],
    new AbortController().signal,
    () => {
      f.video.currentTime = 10;
    },
  ).then(done);
  f.paint();
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  f.image(10);
  f.paint();
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  f.paint();
  await work;
  expect(done).toHaveBeenCalledWith(9.3);
});
it('rejects a source replacement between receipt and paint', async () => {
  const f = setup();
  const abort = new AbortController();
  const done = vi.fn();
  const work = waitForVideoPresentation([f.target], abort.signal, () => {
    f.video.currentTime = 10;
  }).then(done, (e: Error) => e.message);
  f.image(10);
  f.paint();
  Object.defineProperty(f.video, 'currentSrc', {
    value: 'file:///replacement.mp4',
  });
  f.paint();
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  abort.abort();
  expect(await work).toBe('REVERSE_CANCELLED');
});
it('aborts old callbacks before a replacement operation and releases pending frame callbacks', async () => {
  const f = setup();
  const abort = new AbortController();
  const work = waitForVideoPresentation([f.target], abort.signal, () => {
    f.video.currentTime = 10;
  }).catch((e: Error) => e.message);
  abort.abort();
  f.image(10);
  f.paint();
  expect(await work).toBe('REVERSE_CANCELLED');
  expect(f.video.cancelVideoFrameCallback).toHaveBeenCalled();
});

it('does not reuse a later cached PTS for the next small reverse step', async () => {
  const f = setup();
  const first = waitForVideoPresentation(
    [f.target],
    new AbortController().signal,
    () => {
      f.video.currentTime = 10;
    },
  );
  f.image(10);
  f.paint();
  f.paint();
  await first;
  const done = vi.fn();
  const next = waitForVideoPresentation(
    [{ ...f.target, time: 9.99 }],
    new AbortController().signal,
    () => {
      f.video.currentTime = 9.99;
    },
  ).then(done);
  f.paint();
  f.paint();
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  f.image(9.983333);
  f.paint();
  f.paint();
  await next;
  expect(done.mock.calls[0][0]).toBeCloseTo(9.29, 8);
});
