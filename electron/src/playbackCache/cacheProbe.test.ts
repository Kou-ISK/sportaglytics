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
