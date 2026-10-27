// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { RangeMediaSourceTransport } from './RangeMediaSourceTransport';
import { getRangePlaybackClock } from './rangePlaybackRegistry';
import type { PlaybackRangeIndex } from './rangeBufferIndex';
import type { PlaybackRangeReader } from './PlaybackRangeBuffer';
const index: PlaybackRangeIndex = {
  sourceGeneration: 'session',
  initializationBytes: 10,
  presentationEnd: 1.07,
  fragments: [
    {
      id: 0,
      bytes: 100,
      videoStart: 0.055,
      videoEnd: 1.055,
      sampleStart: 0.043,
      sampleEnd: 1.07,
      dependencies: [0],
    },
  ],
};
const bufferOwner = vi.hoisted(() => ({
  seek: vi.fn(),
  demand: vi.fn(),
  isReady: vi.fn(() => true),
  sourceClosed: vi.fn(),
  dispose: vi.fn(async () => {}),
}));
vi.mock('./PlaybackRangeBuffer', () => ({
  PlaybackRangeBuffer: class {
    seek = bufferOwner.seek;
    demand = bufferOwner.demand;
    isReady = bufferOwner.isReady;
    sourceClosed = bufferOwner.sourceClosed;
    dispose = bufferOwner.dispose;
  },
}));
class Source extends EventTarget {
  static isTypeSupported = vi.fn(() => true);
  static latest: Source;
  constructor() {
    super();
    Source.latest = this;
  }
  readyState = 'closed';
  duration = NaN;
  buffer = { timestampOffset: 99, appendWindowStart: 99, appendWindowEnd: 99 };
  addSourceBuffer = vi.fn(() => this.buffer);
}
const setup = (): {
  video: HTMLVideoElement;
  reader: PlaybackRangeReader;
  fail: ReturnType<typeof vi.fn>;
  transport: RangeMediaSourceTransport;
} => {
  vi.stubGlobal('MediaSource', Source);
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:ranges'),
    revokeObjectURL: vi.fn(),
  });
  const video = document.createElement('video'),
    reader: PlaybackRangeReader = {
      read: vi.fn(),
      close: vi.fn(async () => {}),
    },
    fail = vi.fn();
  const transport = new RangeMediaSourceTransport(
    video,
    index,
    'video/mp4',
    reader,
    0.555,
    fail,
  );
  return { video, reader, fail, transport };
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it('queues the latest stopped seek until sourceopen without offsetting tracks or playing video', async () => {
  const { video, transport } = setup();
  transport.seek(0.655);
  video.src = transport.url;
  const play = vi.spyOn(video, 'play');
  Source.latest.dispatchEvent(new Event('sourceopen'));
  expect(bufferOwner.seek).toHaveBeenLastCalledWith(0.655);
  expect(Source.latest.buffer).toEqual({
    timestampOffset: 0,
    appendWindowStart: 0,
    appendWindowEnd: Infinity,
  });
  expect(Source.latest.duration).toBe(1.07);
  expect(play).not.toHaveBeenCalled();
  expect(getRangePlaybackClock(video)).toBe(transport);
  Source.latest.dispatchEvent(new Event('sourceclose'));
  expect(bufferOwner.sourceClosed).toHaveBeenCalledOnce();
  await transport.dispose();
  expect(getRangePlaybackClock(video)).toBeUndefined();
});
it('a never-attached transport closes its reader once and cannot later open', async () => {
  const { transport, reader } = setup();
  const closed = transport.dispose();
  await closed;
  Source.latest.dispatchEvent(new Event('sourceopen'));
  expect(Source.latest.addSourceBuffer).not.toHaveBeenCalled();
  expect(reader.close).toHaveBeenCalledOnce();
  expect(transport.dispose()).toBe(closed);
});
it('failed source initialization retains ownership until real sourceclose', async () => {
  const { video, transport, reader, fail } = setup();
  video.src = transport.url;
  Source.latest.addSourceBuffer = vi.fn(() => {
    throw Error('init failed');
  });
  Source.latest.dispatchEvent(new Event('sourceopen'));
  expect(fail).toHaveBeenCalledOnce();
  const closed = transport.dispose();
  await Promise.resolve();
  expect(reader.close).not.toHaveBeenCalled();
  Source.latest.dispatchEvent(new Event('sourceclose'));
  await closed;
  expect(reader.close).toHaveBeenCalledOnce();
});

it('assigned URL and queued sourceopen retain reader and clock binding until sourceclose', async () => {
  const { video, transport, reader } = setup();
  video.src = transport.url;
  Source.latest.readyState = 'open';
  const closing = transport.dispose();
  await Promise.resolve();
  expect(reader.close).not.toHaveBeenCalled();
  expect(getRangePlaybackClock(video)).toBe(transport);
  expect(transport.isReady(0.555, video)).toBe(false);
  Source.latest.readyState = 'closed';
  Source.latest.dispatchEvent(new Event('sourceclose'));
  await closing;
  expect(reader.close).toHaveBeenCalledOnce();
  expect(getRangePlaybackClock(video)).toBeUndefined();
});
