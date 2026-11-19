// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import type { ScrubPreviewStrip } from '../../../../types/ipc/scrubPreview';
import { findScrubFrame, ScrubPreviewLayer } from './scrubPreviewLayer';
const strip: ScrubPreviewStrip = {
  sourceUrl: 'file:///fixture.mp4',
  bytes: new Uint8Array(8),
  frames: [
    { pts: 600000, offset: 0, size: 4 },
    { pts: 601001, offset: 4, size: 4 },
  ],
};
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
it('selects the containing source frame without a second interval offset', () => {
  expect(findScrubFrame(strip, 10.01)?.pts).toBe(600000);
  for (const t of [9, 10.02, Infinity, NaN])
    expect(findScrubFrame(strip, t)).toBeNull();
});
it.each(['release', 'replace', 'move', 'abort'] as const)(
  'drops a late bitmap after %s',
  async (action) => {
    const video = document.createElement('video');
    Object.defineProperty(video, 'currentSrc', { value: strip.sourceUrl });
    document.body.append(video);
    let complete: (() => void) | undefined;
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn(
        () =>
          new Promise((resolve) => {
            complete = () => resolve({ close, width: 640, height: 360 });
          }),
      ),
    );
    const owner = new ScrubPreviewLayer(strip, video, async () => true);
    const abort = new AbortController();
    const draw = owner.draw(10.01, abort.signal);
    await Promise.resolve();
    await Promise.resolve();
    if (action === 'release') owner.end();
    else if (action === 'replace') video.remove();
    else if (action === 'move') owner.request(30);
    else abort.abort();
    expect(complete).toBeDefined();
    complete?.();
    expect(await draw).toBeNull();
    expect(close).toHaveBeenCalledOnce();
    expect(document.querySelector('canvas')).toBeNull();
  },
);
it('leaves the original visible when its package revision fails validation', async () => {
  const video = document.createElement('video');
  document.body.append(video);
  Object.defineProperty(video, 'currentSrc', { value: strip.sourceUrl });
  const decode = vi.fn();
  vi.stubGlobal('createImageBitmap', decode);
  expect(
    await new ScrubPreviewLayer(strip, video, async () => false).draw(
      10.01,
      new AbortController().signal,
    ),
  ).toBeNull();
  expect(decode).not.toHaveBeenCalled();
});
it('presents an in-flight frame when in-range input keeps arriving', async () => {
  const video = document.createElement('video');
  Object.defineProperty(video, 'currentSrc', { value: strip.sourceUrl });
  document.body.append(video);
  const close = vi.fn();
  const paint = vi.fn();
  const context = vi
    .spyOn(HTMLCanvasElement.prototype, 'getContext')
    .mockImplementation(() =>
      Object.assign(Object.create(null), { drawImage: paint }),
    );
  let complete: (() => void) | undefined;
  vi.stubGlobal(
    'createImageBitmap',
    () =>
      new Promise((resolve) => {
        complete = () => resolve({ close, width: 640, height: 360 });
      }),
  );
  try {
    const owner = new ScrubPreviewLayer(strip, video, async () => true);
    const draw = owner.draw(10, new AbortController().signal);
    await Promise.resolve();
    await Promise.resolve();
    for (const time of [10.003, 10.009, 10.001]) owner.request(time);
    complete?.();
    expect(await draw).toBe(10);
    expect(paint).toHaveBeenCalledOnce();
    expect(document.querySelector('canvas')).not.toBeNull();
    owner.end();
    expect(document.querySelector('canvas')).toBeNull();
    expect(close).toHaveBeenCalledOnce();
  } finally {
    context.mockRestore();
  }
});

it('falls back while a timed-out bitmap is still decoding', async () => {
  vi.useFakeTimers();
  const video = document.createElement('video');
  document.body.append(video);
  Object.defineProperty(video, 'currentSrc', { value: strip.sourceUrl });
  const close = vi.fn();
  let complete: (() => void) | undefined;
  const decode = vi.fn(
    () =>
      new Promise((resolve) => {
        complete = () => resolve({ close, width: 640, height: 360 });
      }),
  );
  vi.stubGlobal('createImageBitmap', decode);
  try {
    const owner = new ScrubPreviewLayer(strip, video, async () => true);
    const signal = new AbortController().signal;
    const first = owner.draw(10, signal);
    await vi.advanceTimersByTimeAsync(91);
    expect(await first).toBeNull();
    const second = owner.draw(10.01, signal);
    await vi.advanceTimersByTimeAsync(91);
    expect(await second).toBeNull();
    expect(decode).toHaveBeenCalledTimes(1);
    complete?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(close).toHaveBeenCalledOnce();
    expect(document.querySelector('canvas')).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});
