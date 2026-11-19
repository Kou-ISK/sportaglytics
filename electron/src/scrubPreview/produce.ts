import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { getFfmpegPath, getFfprobePath } from '../mediaTools';
import { cacheFileRevision } from '../playbackCache/cacheFileRevision';
import type { NativeSourceAccess } from '../nativePlayback/nativeSourceAccess';
import {
  objectValue,
  arrayValue,
} from '../../../src/shared/validation/jsonValues';
import {
  scrubByteLimit,
  scrubTicksPerSecond,
} from '../../../src/types/ipc/scrubPreview';
import type { ScrubPreviewStrip } from '../../../src/types/ipc/scrubPreview';

const tick = scrubTicksPerSecond;
// Pipe output only. The seekable input is the already opened package source.
const run = (
  tool: string,
  args: string[],
  fd: number,
  max: number,
  signal: AbortSignal,
): Promise<{ bytes: Buffer; log: string }> =>
  new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const child = spawn(tool, args, { stdio: ['ignore', 'pipe', 'pipe', fd] });
    const out: Buffer[] = [],
      log: Buffer[] = [];
    let bytes = 0,
      logBytes = 0,
      failed = false;
    const stop = (): void => {
      if (!failed) {
        failed = true;
        child.kill('SIGKILL');
      }
    };
    signal.addEventListener('abort', stop, { once: true });
    const timer = setTimeout(stop, 12000);
    child.stdout?.on('data', (b: Buffer) => {
      bytes += b.length;
      if (bytes > max) stop();
      else if (!failed) out.push(b);
    });
    child.stderr?.on('data', (b: Buffer) => {
      logBytes += b.length;
      if (logBytes > 128 * 1024) stop();
      else if (!failed) log.push(b);
    });
    child.on('error', () => {
      failed = true;
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      signal.removeEventListener('abort', stop);
      if (failed || code !== 0 || signal.aborted)
        reject(Error('SCRUB_PREVIEW_UNAVAILABLE'));
      else
        resolve({
          bytes: Buffer.concat(out),
          log: Buffer.concat(log).toString('utf8'),
        });
    });
  });

export const parsePreviewPackets = (
  log: string,
  bytes: Buffer,
  start: number,
  end: number,
): ScrubPreviewStrip['frames'] => {
  if (!log.split('\n').includes('#tb 0: 1/60000'))
    throw Error('SCRUB_TIME_BASE');
  const frames: ScrubPreviewStrip['frames'] = [];
  let offset = 0;
  for (const line of log.trim().split('\n')) {
    if (line.startsWith('#')) continue;
    const parts = line.split(',');
    const [stream, dts, pts, duration, size] = parts.slice(0, 5).map(Number);
    if (
      parts.length < 6 ||
      stream !== 0 ||
      !Number.isSafeInteger(pts) ||
      dts !== pts ||
      duration !== 1001 ||
      pts < start ||
      pts >= end ||
      (frames.length > 0 && pts !== frames[frames.length - 1].pts + 1001) ||
      !Number.isSafeInteger(size) ||
      size < 4 ||
      size + offset > bytes.length ||
      bytes.readUInt16BE(offset) !== 0xffd8 ||
      bytes.readUInt16BE(offset + size - 2) !== 0xffd9
    )
      throw Error('SCRUB_INVALID_PACKET');
    frames.push({ pts, offset, size });
    offset += size;
  }
  if (
    frames.length < 2 ||
    frames.length > 480 ||
    offset !== bytes.length ||
    bytes.length > scrubByteLimit
  )
    throw Error('SCRUB_INVALID_STRIP');
  return frames;
};

export const produceScrubPreview = async (
  source: NativeSourceAccess,
  time: number,
  signal: AbortSignal,
): Promise<ScrubPreviewStrip> => {
  const start = Math.max(0, Math.floor(time) - 4),
    end = start + 8;
  const file = await fs.open(
    source.path,
    fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW,
  );
  try {
    const revision = cacheFileRevision(await file.stat({ bigint: true }));
    const check = async (): Promise<void> => {
      await source.assertCurrent();
      signal.throwIfAborted();
      if (
        revision !==
        cacheFileRevision(await fs.stat(source.path, { bigint: true }))
      )
        throw Error('SCRUB_CHANGED_SOURCE');
    };
    await check();
    const input = [
      '-protocol_whitelist',
      'file,pipe',
      '-enable_drefs',
      '0',
      '-use_absolute_path',
      '0',
      '-f',
      'mov',
    ];
    const header = await run(
      getFfprobePath(),
      [
        '-v',
        'error',
        ...input,
        '-select_streams',
        'v',
        '-read_intervals',
        String(start) + '%+#96',
        '-show_entries',
        'stream:stream_side_data:packet=flags',
        '-show_streams',
        '-of',
        'json',
        '/dev/fd/3',
      ],
      file.fd,
      65536,
      signal,
    );
    const metadata = objectValue(JSON.parse(header.bytes.toString()));
    const stream = objectValue(arrayValue(metadata.streams, 1, 1)[0]);
    // Skip intraframe and short-GOP clips even when their header is 1080p60.
    let dependent = 0;
    const longGop = arrayValue(metadata.packets, 1, 96).some((packet) => {
      const flags = objectValue(packet).flags;
      if (typeof flags !== 'string') return false;
      dependent = flags.includes('K') ? 0 : dependent + 1;
      return dependent >= 24;
    });
    if (
      !longGop ||
      stream.codec_name !== 'h264' ||
      stream.width !== 1920 ||
      stream.height !== 1080 ||
      stream.pix_fmt !== 'yuv420p' ||
      stream.start_pts !== 0 ||
      stream.time_base !== '1/60000' ||
      stream.avg_frame_rate !== '60000/1001' ||
      stream.r_frame_rate !== '60000/1001' ||
      stream.sample_aspect_ratio !== '1:1' ||
      stream.color_space !== 'bt709' ||
      stream.color_transfer !== 'bt709' ||
      stream.color_primaries !== 'bt709' ||
      stream.side_data_list !== undefined ||
      !(Number(stream.duration) > 12)
    )
      throw Error('SCRUB_UNSUPPORTED_SOURCE');
    // Absolute source PTS survive filtering and encoding. The renderer never adds clipStart.
    const filter =
      'trim=start=' +
      start +
      ':end=' +
      end +
      ',bwdif=mode=send_frame:parity=auto:deint=interlaced,scale=640:360,format=yuvj420p,settb=1/60000';
    const result = await run(
      getFfmpegPath(),
      [
        '-nostdin',
        '-hide_banner',
        '-v',
        'error',
        '-max_pixels',
        '2073600',
        '-threads',
        '1',
        '-ss',
        String(Math.max(0, start - 0.1)),
        '-copyts',
        ...input,
        '-i',
        '/dev/fd/3',
        '-map',
        '0:v:0',
        '-an',
        '-sn',
        '-dn',
        '-filter_threads',
        '1',
        '-vf',
        filter,
        '-frames:v',
        '480',
        '-fps_mode',
        'passthrough',
        '-enc_time_base',
        '1:60000',
        '-threads',
        '1',
        '-c:v',
        'mjpeg',
        '-q:v',
        '6',
        '-f',
        'tee',
        '[f=mjpeg]pipe:1|[f=framecrc]pipe:2',
      ],
      file.fd,
      scrubByteLimit,
      signal,
    );
    const frames = parsePreviewPackets(
      result.log,
      result.bytes,
      start * tick,
      end * tick,
    );
    await check();
    return {
      sourceUrl: source.url,
      bytes: new Uint8Array(result.bytes),
      frames,
    };
  } finally {
    await file.close();
  }
};
