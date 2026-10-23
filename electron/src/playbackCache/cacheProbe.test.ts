import { afterEach, expect, it, vi } from 'vitest';
import { probeCacheMetadata, probeCacheTiming } from './cacheProbe';
import { parseCacheMediaMetadata } from './cacheMediaMetadata';
import type { CacheWorkerEvents } from './cacheConversionRunner';
const mocks = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('./cacheWorkerProcess', () => ({ spawnCacheWorker: mocks.spawn }));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
it.each(['metadata', 'frames'])(
  '%s rejects even a small decode error with close(0), but owns the worker until close',
  async (stage) => {
    let events: CacheWorkerEvents | undefined;
    const terminate = vi.fn(() => true);
    const dispose = vi.fn();
    mocks.spawn.mockImplementation(
      (_exe, args, callbacks: CacheWorkerEvents) => {
        expect(args).toContain('-format_whitelist');
        expect(args[args.indexOf('-f') + 1]).toBe('mov');
        expect(args[args.indexOf('-protocol_whitelist') + 1]).toBe('file,pipe');
        expect(args[args.indexOf('-threads') + 1]).toBe(
          stage === 'frames' ? '4' : '2',
        );
        events = callbacks;
        return { terminate, dispose };
      },
    );
    let settled = false;
    const context = {
      executable: '/app/ffprobe',
      signal: new AbortController().signal,
      stopWaiting: vi.fn(),
    };
    const metadata = parseCacheMediaMetadata({
      streams: [
        {
          index: 0,
          codec_type: 'video',
          codec_name: 'h264',
          time_base: '1/24',
          start_pts: 0,
          duration_ts: 24,
          width: 320,
          height: 180,
          pix_fmt: 'yuv420p',
          field_order: 'progressive',
          avg_frame_rate: '24/1',
          disposition: {},
        },
      ],
    });
    const work =
      stage === 'frames'
        ? probeCacheTiming('/package/source.mp4', metadata, context)
        : probeCacheMetadata('/package/source.mp4', context);
    const rejection = expect(work).rejects.toThrow('CACHE_PROBE_DECODE_ERROR');
    void work.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    for (let index = 0; index < 12; index++) await Promise.resolve();
    if (!events) throw Error('missing worker');
    events.output('diagnostic', Buffer.from('Invalid NAL unit\n'));
    events.output('progress', Buffer.from('{"streams":[]}'));
    await Promise.resolve();
    expect(terminate).toHaveBeenCalledOnce();
    expect(settled).toBe(false);
    expect(dispose).not.toHaveBeenCalled();
    events.closed(0, null);
    await rejection;
    expect(dispose).toHaveBeenCalledOnce();
  },
);

const missingFieldMetadata = {
  streams: [
    {
      index: 0,
      codec_type: 'video',
      codec_name: 'h264',
      time_base: '1/1000',
      start_pts: 55,
      duration_ts: 80,
      width: 320,
      height: 180,
      pix_fmt: 'yuv420p',
      avg_frame_rate: '25/1',
      disposition: {},
    },
  ],
};
const scanFrame = { interlaced_frame: 1, top_field_first: 1, repeat_pict: 0 };
it('uses one bounded owned prefix worker only for absent field_order and preserves its absence', async () => {
  mocks.spawn.mockImplementation(
    (_exe, args: string[], events: CacheWorkerEvents) => {
      const prefix = args.includes('-read_intervals');
      if (prefix) {
        expect(args[args.indexOf('-read_intervals') + 1]).toBe('%+#64');
        expect(args[args.indexOf('-select_streams') + 1]).toBe('v:0');
      }
      queueMicrotask(() => {
        events.output(
          'progress',
          Buffer.from(
            JSON.stringify(
              prefix ? { frames: [scanFrame] } : missingFieldMetadata,
            ),
          ),
        );
        events.closed(0, null);
      });
      return { terminate: vi.fn(), dispose: vi.fn() };
    },
  );
  const metadata = await probeCacheMetadata('/source.mp4', {
    executable: '/app/probe',
    signal: new AbortController().signal,
    stopWaiting: vi.fn(),
  });
  expect(mocks.spawn).toHaveBeenCalledTimes(2);
  expect(metadata.video.field_order).toBeUndefined();
  expect(metadata.displayScan).toBe('top-first');
  expect(metadata.displayScanEvidence).toBe('decoded-prefix');
});
it.each(['empty', 'mixed', 'diagnostic', 'cancelled', 'truncated'])(
  'rejects %s prefix without another worker, retaining ownership until close',
  async (failure) => {
    let events: CacheWorkerEvents | undefined;
    const terminate = vi.fn(() => true);
    const dispose = vi.fn();
    mocks.spawn
      .mockImplementationOnce((_exe, _args, callbacks: CacheWorkerEvents) => {
        queueMicrotask(() => {
          callbacks.output(
            'progress',
            Buffer.from(JSON.stringify(missingFieldMetadata)),
          );
          callbacks.closed(0, null);
        });
        return { terminate: vi.fn(), dispose: vi.fn() };
      })
      .mockImplementation((_exe, _args, callbacks: CacheWorkerEvents) => {
        events = callbacks;
        return { terminate, dispose };
      });
    const controller = new AbortController();
    const work = probeCacheMetadata('/source.mp4', {
      executable: '/app/probe',
      signal: controller.signal,
      stopWaiting: vi.fn(),
    });
    const rejected = expect(work).rejects.toThrow();
    let settled = false;
    void work.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    for (let i = 0; i < 40; i++) await Promise.resolve();
    if (!events) throw Error('prefix worker not started');
    if (failure === 'cancelled') controller.abort();
    else if (failure === 'diagnostic')
      events.output('diagnostic', Buffer.from('decode error'));
    else
      events.output(
        'progress',
        Buffer.from(
          failure === 'truncated'
            ? '{"frames":['
            : JSON.stringify({
                frames:
                  failure === 'empty'
                    ? []
                    : [scanFrame, { ...scanFrame, top_field_first: 0 }],
              }),
        ),
      );
    await Promise.resolve();
    expect(settled).toBe(false);
    expect(dispose).not.toHaveBeenCalled();
    if (['mixed', 'diagnostic', 'cancelled'].includes(failure))
      expect(terminate).toHaveBeenCalledOnce();
    events.closed(0, null);
    await rejected;
    expect(mocks.spawn).toHaveBeenCalledTimes(2);
    expect(dispose).toHaveBeenCalledOnce();
  },
);
it.each([null, '', 'unknown', 'progressive'])(
  'does not use prefix fallback for field_order=%s',
  async (order) => {
    mocks.spawn.mockImplementation((_exe, _args, events: CacheWorkerEvents) => {
      queueMicrotask(() => {
        events.output(
          'progress',
          Buffer.from(
            JSON.stringify({
              streams: [
                { ...missingFieldMetadata.streams[0], field_order: order },
              ],
            }),
          ),
        );
        events.closed(0, null);
      });
      return { terminate: vi.fn(), dispose: vi.fn() };
    });
    const work = probeCacheMetadata('/source.mp4', {
      executable: '/app/probe',
      signal: new AbortController().signal,
      stopWaiting: vi.fn(),
    });
    if (order === 'progressive')
      expect((await work).displayScanEvidence).toBe('stream');
    else await expect(work).rejects.toThrow();
    expect(mocks.spawn).toHaveBeenCalledOnce();
  },
);
