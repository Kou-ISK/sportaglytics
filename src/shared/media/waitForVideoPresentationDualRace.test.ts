// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { waitForVideoPresentation } from './waitForVideoPresentation';

const setup = () => {
  vi.useFakeTimers();
  let id = 0;
  const raf = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    raf.set(++id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => raf.delete(key));
  const make = (source: string) => {
    const video = document.createElement('video');
    let src = source;
    const callbacks = new Map<number, VideoFrameRequestCallback>();
    video.requestVideoFrameCallback = vi.fn((cb) => {
      callbacks.set(++id, cb);
      return id;
    });
    video.cancelVideoFrameCallback = vi.fn((key) => {
      callbacks.delete(key);
    });
    Object.defineProperty(video, 'currentSrc', { get: () => src });
    Object.defineProperty(video, 'readyState', { value: 4 });
    const currentCallback = (): VideoFrameRequestCallback => {
      const cb = [...callbacks.values()].at(-1);
      if (!cb) throw Error('missing frame callback');
      return cb;
    };
    const image = (pts: number, cb = currentCallback()): void => {
      for (const [key, value] of callbacks)
        if (value === cb) callbacks.delete(key);
      cb(0, {
        mediaTime: pts,
        expectedDisplayTime: 0,
        presentationTime: 0,
        presentedFrames: 1,
        width: 1,
        height: 1,
      });
    };
    return {
      video,
      callbacks,
      image,
      currentCallback,
      setSource: (value: string) => {
        src = value;
      },
    };
  };
  const a = make('file:///a.mp4'),
    b = make('file:///b.mp4');
  const targets = [
    { video: a.video, source: 'file:///a.mp4', time: 10, offset: 0.7 },
    { video: b.video, source: 'file:///b.mp4', time: 12, offset: 2.7 },
  ];
  const paint = (): void => {
    const pending = [...raf.values()];
    raf.clear();
    pending.forEach((cb) => cb(0));
  };
  return { a, b, targets, paint, raf };
};
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it('invalidates the whole wait if one angle reloads before the second paint and releases both callbacks', async () => {
  const f = setup();
  const removeA = vi.spyOn(f.a.video, 'removeEventListener');
  const removeB = vi.spyOn(f.b.video, 'removeEventListener');
  const work = waitForVideoPresentation(
    f.targets,
    new AbortController().signal,
    () => {
      f.a.video.currentTime = 10;
      f.b.video.currentTime = 12;
    },
  ).catch((error: Error) => error.message);
  f.a.image(9.984);
  f.b.image(11.99);
  f.paint();
  f.b.video.dispatchEvent(new Event('loadstart'));
  f.paint();
  expect(await work).toBe('REVERSE_MEDIA_CHANGED');
  expect(f.a.video.cancelVideoFrameCallback).toHaveBeenCalled();
  expect(f.b.video.cancelVideoFrameCallback).toHaveBeenCalled();
  expect(f.a.callbacks.size).toBe(0);
  expect(f.b.callbacks.size).toBe(0);
  expect(f.raf.size).toBe(0);
  // No clip-transition listeners were installed for same-source angles.
  expect(
    removeA.mock.calls.filter(([name]) => name === 'loadeddata'),
  ).toHaveLength(0);
  expect(
    removeB.mock.calls.filter(([name]) => name === 'loadeddata'),
  ).toHaveLength(0);
});

it('aborts both angles during one angle transition and ignores stale completion in a new operation', async () => {
  const f = setup();
  const remove = vi.spyOn(f.b.video, 'removeEventListener');
  const abort = new AbortController();
  const target = [
    f.targets[0],
    { ...f.targets[1], source: 'file:///new-b.mp4' },
  ];
  const old = waitForVideoPresentation(target, abort.signal, () => {
    f.a.video.currentTime = 10;
    f.b.video.currentTime = 12;
  }).catch((error: Error) => error.message);
  const staleA = f.a.currentCallback(),
    staleB = f.b.currentCallback();
  f.a.image(9.984);
  f.paint();
  f.b.video.dispatchEvent(new Event('loadstart'));
  abort.abort();
  expect(await old).toBe('REVERSE_CANCELLED');
  expect(f.a.callbacks.size).toBe(0);
  expect(f.b.callbacks.size).toBe(0);
  expect(f.raf.size).toBe(0);
  expect(remove).toHaveBeenCalledWith('loadeddata', expect.any(Function));
  f.b.setSource('file:///new-b.mp4');
  f.b.video.dispatchEvent(new Event('loadeddata'));
  const done = vi.fn();
  const fresh = waitForVideoPresentation(
    target,
    new AbortController().signal,
    () => {},
  ).then(done);
  f.a.image(9.984, staleA);
  f.b.image(11.99, staleB);
  f.paint();
  f.paint();
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  f.a.image(9.984);
  f.b.image(11.99);
  f.paint();
  f.paint();
  await fresh;
  expect(done).toHaveBeenCalledOnce();
});

it('does not register the second angle after the first lacks frame callbacks', async () => {
  const f = setup();
  Object.defineProperty(f.a.video, 'requestVideoFrameCallback', {
    value: undefined,
  });
  const add = vi.spyOn(f.b.video, 'addEventListener');
  const targets = [
    f.targets[0],
    { ...f.targets[1], source: 'file:///new-b.mp4' },
  ];
  const result = await waitForVideoPresentation(
    targets,
    new AbortController().signal,
    () => {},
  ).catch((error: Error) => error.message);
  expect(result).toBe('REVERSE_FRAME_CALLBACK_UNAVAILABLE');
  expect(f.b.video.requestVideoFrameCallback).not.toHaveBeenCalled();
  expect(add.mock.calls.filter(([name]) => name === 'loadeddata')).toHaveLength(
    0,
  );
  expect(f.b.callbacks.size).toBe(0);
  expect(f.raf.size).toBe(0);
});

it('rejects a pre-transition callback delivered after the expected source has loaded', async () => {
  const f = setup();
  const targets = [f.targets[0], { ...f.targets[1], source: 'file:///new-b.mp4' }];
  const done = vi.fn();
  const work = waitForVideoPresentation(targets, new AbortController().signal, () => {
    f.a.video.currentTime = 10;
    f.b.video.currentTime = 12;
  }).then(done);
  const oldCallback = f.b.currentCallback();
  f.a.image(9.984);
  f.b.video.dispatchEvent(new Event('emptied'));
  f.b.video.dispatchEvent(new Event('loadstart'));
  f.b.setSource('file:///new-b.mp4');
  f.b.video.dispatchEvent(new Event('loadeddata'));
  f.b.image(11.99, oldCallback);
  f.paint();
  f.paint();
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  f.b.image(11.99);
  f.paint();
  f.paint();
  await work;
  expect(done).toHaveBeenCalledOnce();
});

it('waits for the expected load even if currentSrc changes before load events', async () => {
  const f = setup();
  const targets = [f.targets[0], { ...f.targets[1], source: 'file:///new-b.mp4' }];
  const done = vi.fn();
  const work = waitForVideoPresentation(targets, new AbortController().signal, () => {
    f.a.video.currentTime = 10;
    f.b.video.currentTime = 12;
  }).then(done);
  f.a.image(9.984);
  f.b.setSource('file:///new-b.mp4');
  f.b.image(11.99);
  f.paint(); f.paint();
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  f.b.video.dispatchEvent(new Event('loadstart'));
  f.b.video.dispatchEvent(new Event('loadeddata'));
  f.b.image(11.99);
  f.paint(); f.paint();
  await work;
  expect(done).toHaveBeenCalledOnce();
});

it('does not attribute an ambiguous error to the target while its source transition is pending', async () => {
  const f = setup();
  const targets = [f.targets[0], { ...f.targets[1], source: 'file:///new-b.mp4' }];
  const abort = new AbortController();
  const result = waitForVideoPresentation(targets, abort.signal, () => {
    f.a.video.currentTime = 10;
    f.b.video.currentTime = 12;
  }).catch((error: Error) => error.message);
  f.b.video.dispatchEvent(new Event('loadstart'));
  f.b.setSource('file:///new-b.mp4');
  Object.defineProperty(f.b.video, 'error', { configurable: true, value: { code: 3 } });
  f.b.video.dispatchEvent(new Event('error'));
  f.paint();
  await vi.advanceTimersByTimeAsync(4999);
  let settled = false;
  void result.then(() => { settled = true; });
  await Promise.resolve();
  expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(1);
  expect(await result).toBe('REVERSE_IMAGE_TIMEOUT');
  expect(f.a.callbacks.size).toBe(0);
  expect(f.b.callbacks.size).toBe(0);
  expect(f.raf.size).toBe(0);
});
