import type {
  CaptureInput,
  CaptureStartRequest,
} from '../../../src/types/liveCapture';
import {
  CAPTURE_SEGMENT_SECONDS,
  isCaptureUrl,
} from '../../../src/shared/liveCapture/validation';
import { resolveH264Encoder } from '../mediaTools';

/** Network inputs cannot open local files through a nested playlist or protocol. */
export const buildCaptureCommand = (
  input: CaptureInput,
  quality: CaptureStartRequest['quality'],
  platform: NodeJS.Platform = process.platform,
): string[] => {
  const args = [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-probesize',
    '1048576',
    '-analyzeduration',
    '1000000',
  ];
  if (input.kind === 'network') {
    if (!isCaptureUrl(input.url)) throw new Error('対応していない接続先です。');
    args.push(
      '-protocol_whitelist',
      'http,https,tcp,tls,udp,rtp,rtmp,rtmps,crypto',
    );
    // RTSP is a demuxer with its own timeout option; rw_timeout is rejected.
    const protocol = new URL(input.url).protocol;
    if (protocol === 'rtsp:' || protocol === 'rtsps:')
      args.push('-rtsp_transport', 'tcp', '-timeout', '15000000');
    else args.push('-rw_timeout', '15000000');
    args.push('-i', input.url);
  } else {
    args.push('-protocol_whitelist', 'pipe', '-f', 'matroska', '-i', 'pipe:0');
  }
  const height = quality === '1080p' ? 1080 : 720;
  args.push(
    '-map',
    '0:v:0',
    '-map',
    '0:a:0?',
    '-vf',
    `scale=w='min(iw,${(height * 16) / 9})':h='min(ih,${height})':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30`,
    ...resolveH264Encoder(platform).args,
    '-b:v',
    quality === '1080p' ? '8M' : '5M',
    '-g',
    '60',
    '-bf',
    '0',
    '-force_key_frames',
    `expr:gte(t,n_forced*${CAPTURE_SEGMENT_SECONDS})`,
    '-c:a',
    'aac',
    '-b:a',
    '160k',
    '-ar',
    '48000',
    '-f',
    'segment',
    '-segment_time',
    String(CAPTURE_SEGMENT_SECONDS),
    '-segment_time_delta',
    '0.016667',
    '-reset_timestamps',
    '1',
    '-segment_format_options',
    'movflags=+faststart',
    '-segment_list',
    'segments.csv',
    '-segment_list_type',
    'csv',
    'segment-%06d.mp4',
  );
  return args;
};

export interface CompletedCaptureSegment {
  file: string;
  start: number;
  end: number;
}

/** Ignore incomplete CSV tails, non-finite timestamps and names outside this recording. */
export const parseCompletedSegments = (
  csv: string,
): CompletedCaptureSegment[] => {
  const result: CompletedCaptureSegment[] = [];
  for (const line of csv.slice(0, csv.lastIndexOf('\n') + 1).split('\n')) {
    const match =
      /^(segment-\d{6}\.mp4),(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)\r?$/.exec(line);
    if (!match) continue;
    const start = Number(match[2]),
      end = Number(match[3]);
    if (
      Number.isFinite(start) &&
      Number.isFinite(end) &&
      start >= 0 &&
      end > start &&
      end - start <= 30
    )
      result.push({ file: match[1], start, end });
  }
  return result;
};
