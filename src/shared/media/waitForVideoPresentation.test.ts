// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import {
  isConfirmedDisplayedFrame,
  issueVideoPresentationSeek,
  waitForVideoPresentation,
} from './waitForVideoPresentation';
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
  const image = (pts: number, submitted = performance.now() + 1): void =>
    receive(0, {
      mediaTime: pts,
      expectedDisplayTime: 0,
      presentationTime: submitted,
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
  expect(done.mock.calls[0][0]).toBeCloseTo(9.283333, 8);
});

it('retains only a painted matching frame until a new media operation', async () => {
  const f = setup();
  const work = waitForVideoPresentation(
    [f.target],
    new AbortController().signal,
    () => {
      f.video.currentTime = 10;
    },
  );
  f.image(9.984);
  f.paint();
  expect(isConfirmedDisplayedFrame(f.video, 9.984)).toBe(false);
  f.paint();
  await work;
  expect(isConfirmedDisplayedFrame(f.video, 9.984)).toBe(true);
  expect(isConfirmedDisplayedFrame(f.video, 9.983)).toBe(false);
  f.video.dispatchEvent(new Event('seeking'));
  expect(isConfirmedDisplayedFrame(f.video, 9.984)).toBe(false);
});

it.each(['play', 'emptied', 'loadstart'])(
  'invalidates the displayed-frame proof on %s',
  async (eventName) => {
    const f = setup();
    const work = waitForVideoPresentation(
      [f.target],
      new AbortController().signal,
      () => {
        f.video.currentTime = 10;
      },
    );
    f.image(9.984);
    f.paint();
    f.paint();
    await work;
    expect(isConfirmedDisplayedFrame(f.video, 9.984)).toBe(true);
    f.video.dispatchEvent(new Event(eventName));
    expect(isConfirmedDisplayedFrame(f.video, 9.984)).toBe(false);
  },
);
it('rejects a proof after source or seek-clock change', async () => {
  const f = setup();
  const work = waitForVideoPresentation(
    [f.target],
    new AbortController().signal,
    () => {
      f.video.currentTime = 10;
    },
  );
  f.image(9.984);
  f.paint();
  f.paint();
  await work;
  f.video.currentTime = 11;
  expect(isConfirmedDisplayedFrame(f.video, 9.984)).toBe(false);
  Object.defineProperty(f.video, 'currentSrc', { value: 'file:///other.mp4' });
  expect(isConfirmedDisplayedFrame(f.video, 9.984)).toBe(false);
});

it('never reuses a paused proof while the media element is playing', async () => {
  const f = setup();
  const work = waitForVideoPresentation(
    [f.target],
    new AbortController().signal,
    () => {
      f.video.currentTime = 10;
    },
  );
  f.image(9.984);
  f.paint();
  f.paint();
  await work;
  expect(isConfirmedDisplayedFrame(f.video, 9.984)).toBe(true);
  Object.defineProperty(f.video, 'paused', {
    configurable: true,
    value: false,
  });
  expect(isConfirmedDisplayedFrame(f.video, 9.984)).toBe(false);
});

it('does not accept a cached PTS after a same-URL reload', async () => {
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
  f.video.dispatchEvent(new Event('loadstart'));
  const done = vi.fn();
  const abort = new AbortController();
  const next = waitForVideoPresentation([f.target], abort.signal, () => {
    f.video.currentTime = 10;
  }).then(done);
  f.paint();
  f.paint();
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  f.image(10);
  f.paint();
  f.paint();
  await next;
  expect(done).toHaveBeenCalledOnce();
});
it('rejects a wait invalidated by reload before the paint fence', async () => {
  const f = setup();
  const next = waitForVideoPresentation(
    [f.target],
    new AbortController().signal,
    () => {
      f.video.currentTime = 10;
    },
  ).catch((error: Error) => error.message);
  f.image(10);
  f.paint();
  f.video.dispatchEvent(new Event('loadstart'));
  f.paint();
  expect(await next).toBe('REVERSE_MEDIA_CHANGED');
});

it('can confirm an unchanged displayed frame after a smaller seek without a new frame callback', async () => {
  const f = setup();
  const first = waitForVideoPresentation(
    [f.target],
    new AbortController().signal,
    () => {
      f.video.currentTime = 10;
    },
  );
  f.image(9.984);
  f.paint();
  f.paint();
  await first;
  const next = waitForVideoPresentation(
    [{ ...f.target, time: 9.99 }],
    new AbortController().signal,
    () => {
      f.video.currentTime = 9.99;
      f.video.dispatchEvent(new Event('seeking'));
    },
  );
  f.paint();
  f.paint();
  expect(await next).toBeCloseTo(9.284, 8);
});

it('confirms a requested clip transition only after the new source loads and delivers a new frame', async () => {
  const f = setup();
  const target = { ...f.target, source: 'file:///next.mp4' };
  const done = vi.fn();
  const work = waitForVideoPresentation(
    [target],
    new AbortController().signal,
    () => {},
  ).then(done);
  f.video.dispatchEvent(new Event('loadstart'));
  f.image(10);
  f.paint();
  f.paint();
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  Object.defineProperty(f.video, 'currentSrc', { value: 'file:///next.mp4' });
  f.video.currentTime = 10;
  f.video.dispatchEvent(new Event('loadeddata'));
  f.paint();
  f.paint();
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  f.image(10);
  f.paint();
  f.paint();
  await work;
  expect(done).toHaveBeenCalledOnce();
});

it('confirms the new clip frame presented between metadata and loadeddata in an exact scrub', async () => {
  const f = setup();
  const target = { ...f.target, source: 'file:///next.mp4' };
  const remove = vi.spyOn(f.video, 'removeEventListener');
  const work = waitForVideoPresentation(
    [target],
    new AbortController().signal,
    () => {},
    true,
  );
  f.video.dispatchEvent(new Event('loadstart'));
  Object.defineProperty(f.video, 'currentSrc', { value: target.source });
  f.video.currentTime = target.time;
  f.video.dispatchEvent(new Event('loadedmetadata'));
  f.image(target.time);
  f.video.dispatchEvent(new Event('loadeddata'));
  f.paint();
  f.paint();
  expect(await work).toBeCloseTo(target.time - target.offset);
  expect(remove).toHaveBeenCalledWith('loadedmetadata', expect.any(Function));
  expect(remove).toHaveBeenCalledWith('loadeddata', expect.any(Function));
});

it('rejects a second unexpected reload after an intended clip transition', async () => {
  const f = setup();
  const target = { ...f.target, source: 'file:///next.mp4' };
  const work = waitForVideoPresentation(
    [target],
    new AbortController().signal,
    () => {},
  ).catch((error: Error) => error.message);
  f.video.dispatchEvent(new Event('loadstart'));
  Object.defineProperty(f.video, 'currentSrc', { value: 'file:///next.mp4' });
  f.video.currentTime = 10;
  f.video.dispatchEvent(new Event('loadeddata'));
  f.video.dispatchEvent(new Event('loadstart'));
  f.video.dispatchEvent(new Event('loadeddata'));
  f.paint();
  expect(await work).toBe('REVERSE_MEDIA_CHANGED');
});

it('waits for both angles and returns the primary angle clock after each paint', async () => {
  vi.useFakeTimers();
  const frames = new Map<number, FrameRequestCallback>();
  let serial = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    frames.set(++serial, cb);
    return serial;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
  const make = (url: string) => {
    const video = document.createElement('video');
    let callback: VideoFrameRequestCallback = () => {};
    video.requestVideoFrameCallback = vi.fn((cb) => {
      callback = cb;
      return ++serial;
    });
    video.cancelVideoFrameCallback = vi.fn();
    Object.defineProperty(video, 'currentSrc', {
      value: url,
      configurable: true,
    });
    Object.defineProperty(video, 'readyState', { value: 4 });
    return {
      video,
      image: (pts: number) =>
        callback(0, {
          mediaTime: pts,
          expectedDisplayTime: 0,
          presentationTime: 0,
          presentedFrames: 1,
          width: 1,
          height: 1,
        }),
    };
  };
  const a = make('file:///a.mp4'),
    b = make('file:///b.mp4');
  const done = vi.fn();
  const work = waitForVideoPresentation(
    [
      { video: a.video, source: a.video.currentSrc, time: 10, offset: 0.7 },
      { video: b.video, source: b.video.currentSrc, time: 12, offset: 2.7 },
    ],
    new AbortController().signal,
    () => {
      a.video.currentTime = 10;
      b.video.currentTime = 12;
    },
  ).then(done);
  const paint = (): void => {
    const c = [...frames.values()];
    frames.clear();
    c.forEach((f) => f(0));
  };
  a.image(9.984);
  paint();
  paint();
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  b.image(11.99);
  paint();
  paint();
  await work;
  expect(done).toHaveBeenCalledOnce();
  expect(done.mock.calls[0][0]).toBeCloseTo(9.284, 8);
});
it('times out and detaches callbacks when an expected clip never loads', async () => {
  const f = setup();
  const removed = vi.spyOn(f.video, 'removeEventListener');
  const target = { ...f.target, source: 'file:///next.mp4' };
  const work = waitForVideoPresentation(
    [target],
    new AbortController().signal,
    () => {},
  ).catch((error: Error) => error.message);
  f.video.dispatchEvent(new Event('loadstart'));
  await vi.advanceTimersByTimeAsync(5000);
  expect(await work).toBe('REVERSE_IMAGE_TIMEOUT');
  expect(f.video.cancelVideoFrameCallback).toHaveBeenCalled();
  expect(removed).toHaveBeenCalledWith('loadeddata', expect.any(Function));
});

it('requires both scrub angles to present after their own requested seek starts', async () => {
  const f = setup();
  const g = setup();
  const done = vi.fn();
  const work = waitForVideoPresentation(
    [f.target, g.target],
    new AbortController().signal,
    () => {},
    true,
  ).then(done);
  for (const angle of [f, g]) {
    angle.video.currentTime = 10;
    angle.image(9.99); // An earlier display can arrive before React issues the seek.
    angle.video.dispatchEvent(new Event('seeking'));
  }
  f.image(9.99);
  g.paint();
  g.paint();
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  g.image(9.98);
  g.paint();
  g.paint();
  await work;
  expect(done).toHaveBeenCalledOnce();
});

it('retains a newly submitted distant seek image delivered before the DOM seeking event', async () => {
  const f = setup();
  let seeking = false;
  Object.defineProperty(f.video, 'seeking', { get: () => seeking });
  const work = waitForVideoPresentation(
    [f.target],
    new AbortController().signal,
    () => {
      f.video.currentTime = 10;
      seeking = true;
    },
    true,
  );
  f.image(9.99, performance.now() + 1);
  f.video.dispatchEvent(new Event('seeking'));
  seeking = false;
  f.paint();
  f.paint();
  expect(await work).toBeCloseTo(9.29);
});
it('rejects a frame submitted before issuing the distant seek', async () => {
  const f = setup();
  let seeking = false;
  Object.defineProperty(f.video, 'seeking', { get: () => seeking });
  const done = vi.fn();
  const work = waitForVideoPresentation(
    [f.target],
    new AbortController().signal,
    () => {
      f.video.currentTime = 10;
      seeking = true;
    },
    true,
  ).then(done);
  f.image(9.99, performance.now() - 1);
  f.video.dispatchEvent(new Event('seeking'));
  seeking = false;
  f.paint();
  f.paint();
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  f.image(9.99);
  f.paint();
  f.paint();
  await work;
  expect(done).toHaveBeenCalledOnce();
});

it.each([
  { old: 9.98, pending: false },
  { old: 0, pending: true },
])(
  'does not accept an early image for an ambiguous origin $old/$pending',
  async ({ old, pending }) => {
    const f = setup();
    let seeking = pending;
    Object.defineProperty(f.video, 'seeking', { get: () => seeking });
    f.video.currentTime = old;
    const done = vi.fn();
    const work = waitForVideoPresentation(
      [f.target],
      new AbortController().signal,
      () => {
        f.video.currentTime = 10;
        seeking = true;
      },
      true,
    ).then(done);
    f.image(9.99, performance.now() + 1);
    f.video.dispatchEvent(new Event('seeking'));
    seeking = false;
    f.paint();
    f.paint();
    await Promise.resolve();
    expect(done).not.toHaveBeenCalled();
    f.image(9.99);
    f.paint();
    f.paint();
    await work;
    expect(done).toHaveBeenCalledOnce();
  },
);

it('recognizes the compositor image for a source seek issued later by the mounted player', async () => {
  const f = setup();
  let seeking = false;
  Object.defineProperty(f.video, 'seeking', { get: () => seeking });
  const work = waitForVideoPresentation(
    [f.target],
    new AbortController().signal,
    () => {},
    true,
  );
  issueVideoPresentationSeek(f.video, () => {
    f.video.currentTime = 10;
    seeking = true;
  });
  f.image(9.99);
  f.video.dispatchEvent(new Event('seeking'));
  seeking = false;
  f.paint();
  f.paint();
  expect(await work).toBeCloseTo(9.29);
});
it('rejects a pre-command adjacent image delivered after the seeking event', async () => {
  const f = setup();
  f.video.currentTime = 9.98;
  const done = vi.fn();
  const work = waitForVideoPresentation(
    [f.target],
    new AbortController().signal,
    () => {
      f.video.currentTime = 10;
    },
    true,
  ).then(done);
  f.video.dispatchEvent(new Event('seeking'));
  f.image(9.98, performance.now() - 1);
  f.paint();
  f.paint();
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  f.image(9.99);
  f.paint();
  f.paint();
  await work;
  expect(done).toHaveBeenCalledOnce();
});

it('drops provisional proof when a newer presented image is outside the seek interval', async () => {
  const f = setup();
  let seeking = false;
  Object.defineProperty(f.video, 'seeking', { get: () => seeking });
  const done = vi.fn();
  const work = waitForVideoPresentation(
    [f.target],
    new AbortController().signal,
    () => {
      f.video.currentTime = 10;
      seeking = true;
    },
    true,
  ).then(done);
  f.image(9.99, performance.now() + 1);
  f.image(8, performance.now() + 2);
  f.video.dispatchEvent(new Event('seeking'));
  seeking = false;
  f.paint();
  f.paint();
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  f.image(9.99, performance.now() + 3);
  f.paint();
  f.paint();
  await work;
  expect(done).toHaveBeenCalledOnce();
});

it('confirms the first destination image when a clip switch defers the player seek until canplay', async () => {
  const f = setup();
  const source = 'file:///next.mp4';
  let clock = 0;
  let seeking = false;
  Object.defineProperties(f.video, {
    currentTime: {
      get: () => clock,
      set: (time: number) => {
        clock = time;
        seeking = true;
      },
    },
    seeking: { get: () => seeking },
  });
  const done = vi.fn();
  const work = waitForVideoPresentation(
    [{ ...f.target, source }],
    new AbortController().signal,
    () => {},
    true,
  ).then(done);
  f.video.dispatchEvent(new Event('loadstart'));
  Object.defineProperty(f.video, 'currentSrc', { value: source });
  f.video.dispatchEvent(new Event('loadedmetadata'));
  f.video.dispatchEvent(new Event('loadeddata'));
  // Video.js can cache currentTime while changing its source and apply it
  // later from canplay. The paused decoder may present its only image before
  // the browser dispatches the queued seeking/seeked events.
  if (clock !== f.target.time) f.video.currentTime = f.target.time;
  f.image(9.99);
  f.video.dispatchEvent(new Event('seeking'));
  seeking = false;
  f.video.dispatchEvent(new Event('seeked'));
  f.paint();
  f.paint();
  await Promise.resolve();
  expect(done).toHaveBeenCalledOnce();
  await work;
  expect(done.mock.calls[0][0]).toBeCloseTo(9.29);
});
