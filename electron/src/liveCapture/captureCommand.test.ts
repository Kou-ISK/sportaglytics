import { describe, expect, it } from 'vitest';
import { buildCaptureCommand, parseCompletedSegments } from './captureCommand';

describe('live capture encoding', () => {
  it.each(['darwin', 'win32', 'linux'] as const)(
    'creates independently playable bounded segments on %s',
    (platform) => {
      const args = buildCaptureCommand(
        { id: 'one', name: 'Angle 1', kind: 'device' },
        '1080p',
        platform,
      );
      expect(args[args.indexOf('-protocol_whitelist') + 1]).toBe('pipe');
      expect(args).toContain('pipe:0');
      expect(args).toContain('movflags=+faststart');
      expect(args[args.indexOf('-bf') + 1]).toBe('0');
      expect(args[args.indexOf('-segment_time') + 1]).toBe('2');
      expect(args).toContain(
        platform === 'darwin'
          ? 'h264_videotoolbox'
          : platform === 'win32'
            ? 'libopenh264'
            : 'libx264',
      );
    },
  );
  it('constrains nested playlists to network protocols and uses RTSP TCP', () => {
    const args = buildCaptureCommand(
      {
        id: 'one',
        name: 'Angle',
        kind: 'network',
        url: 'rtsp://camera.example/live',
      },
      '720p',
    );
    const protocols = args[args.indexOf('-protocol_whitelist') + 1].split(',');
    expect(protocols).not.toContain('file');
    expect(protocols).not.toContain('pipe');
    expect(args[args.indexOf('-rtsp_transport') + 1]).toBe('tcp');
    expect(args[args.indexOf('-timeout') + 1]).toBe('15000000');
    expect(args).not.toContain('-rw_timeout');
    expect(() =>
      buildCaptureCommand(
        { id: 'one', name: 'Angle', kind: 'network', url: 'file:///outside' },
        '720p',
      ),
    ).toThrow();
  });
  it.each(['rtmp', 'rtmps', 'http', 'https'])(
    'uses protocol I/O timeout for %s streams',
    (protocol) => {
      const args = buildCaptureCommand(
        {
          id: 'one',
          name: 'Angle',
          kind: 'network',
          url: `${protocol}://camera.example/live`,
        },
        '720p',
      );
      expect(args[args.indexOf('-rw_timeout') + 1]).toBe('15000000');
      expect(args).not.toContain('-rtsp_transport');
    },
  );
  it('publishes only complete CSV rows with safe paths and valid timestamps', () => {
    const csv =
      'segment-000000.mp4,0.000000,2.000000\n../outside.mp4,2,4\nsegment-000001.mp4,2,4\nsegment-000002.mp4,4,3\nsegment-000003.mp4,4,Infinity\nsegment-000004.mp4,4,90\nsegment-000005.mp4,4,6';
    expect(parseCompletedSegments(csv)).toEqual([
      { file: 'segment-000000.mp4', start: 0, end: 2 },
      { file: 'segment-000001.mp4', start: 2, end: 4 },
    ]);
  });
});
