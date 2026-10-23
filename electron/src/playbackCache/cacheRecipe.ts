import path from 'node:path';
import { rational } from './cacheRational';
import type { CacheMediaMetadata } from './cacheMediaMetadata';

export const CACHE_RECIPE = 'mac-videotoolbox-sdr-field-times-v1';
export const cacheVideoBitrate = (metadata: CacheMediaMetadata): number =>
  Math.ceil(
    Math.max(
      8000000,
      (((metadata.video.width ?? 0) *
        (metadata.video.height ?? 0) *
        metadata.outputFps.numerator) /
        metadata.outputFps.denominator) *
        0.18,
    ),
  );

/** Fixed bundled recipe; not equivalent to an external libx264 CRF diagnosis.
 * No trimming, frame-rate conversion, audio encoding or source overwrite. */
export const buildCacheRecipe = (
  source: string,
  output: string,
  metadata: CacheMediaMetadata,
  platform: NodeJS.Platform = process.platform,
): string[] => {
  if (platform !== 'darwin') throw Error('CACHE_PLATFORM_UNSUPPORTED');
  if (
    !path.isAbsolute(source) ||
    !path.isAbsolute(output) ||
    source === output ||
    path.extname(source).toLowerCase() !== '.mp4'
  )
    throw Error('CACHE_INVALID_PATH');
  let movieTimeScale = metadata.timeScale;
  for (const audio of metadata.audio) {
    const base = rational(audio.time_base);
    let a = movieTimeScale;
    let b = base.denominator;
    while (b) [a, b] = [b, a % b];
    movieTimeScale = (movieTimeScale / a) * base.denominator;
    if (!Number.isSafeInteger(movieTimeScale) || movieTimeScale > 2147483647)
      throw Error('CACHE_UNSUPPORTED_TIME_SCALE');
  }
  const args = [
    '-hide_banner',
    '-nostdin',
    '-n',
    '-loglevel',
    'error',
    '-threads',
    '2',
    '-copyts',
    '-protocol_whitelist',
    'file,pipe',
    '-format_whitelist',
    'mov',
    '-f',
    'mov',
    '-enable_drefs',
    '0',
    '-use_absolute_path',
    '0',
    '-i',
    source,
    '-map',
    '0:v:0',
  ];
  for (const track of metadata.audio) args.push('-map', '0:' + track.index);
  args.push(
    '-map_metadata',
    '0',
    '-map_chapters',
    '-1',
    '-filter_threads',
    '1',
  );
  if (metadata.interlaced)
    args.push('-vf', 'bwdif=mode=send_field:parity=auto:deint=all');
  args.push(
    '-c:v',
    'h264_videotoolbox',
    '-allow_sw',
    '0',
    '-b:v',
    String(cacheVideoBitrate(metadata)),
    '-profile:v',
    'high',
    '-pix_fmt',
    'yuv420p',
    '-fps_mode:v',
    'passthrough',
    '-enc_time_base:v',
    '1:' + metadata.timeScale,
    '-c:a',
    'copy',
    '-video_track_timescale',
    String(metadata.timeScale),
    '-movie_timescale',
    String(movieTimeScale),
    '-avoid_negative_ts',
    'disabled',
    '-use_editlist',
    '1',
    '-movflags',
    '+faststart',
    '-nostats',
    '-stats_period',
    '0.25',
    '-progress',
    'pipe:1',
    output,
  );
  return args;
};
