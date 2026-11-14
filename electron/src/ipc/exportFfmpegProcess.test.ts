import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  concatFfmpegFiles,
  FfmpegExecutionError,
  parseFfmpegProgressLine,
  runFfmpegProcess,
} from './exportFfmpegProcess';
import {
  H264_ENCODER_ARGS,
  resolveExportH264Encoder,
  resolveH264Encoder,
} from '../mediaTools';

describe('parseFfmpegProgressLine', () => {
  it('converts FFmpeg microsecond timestamps into a bounded fraction', () => {
    expect(parseFfmpegProgressLine('out_time_us=2500000', 10)).toBe(0.25);
    expect(parseFfmpegProgressLine('out_time_ms=15000000', 10)).toBe(1);
  });

  it('reports completion and ignores malformed progress values', () => {
    expect(parseFfmpegProgressLine('progress=end', 10)).toBe(1);
    expect(parseFfmpegProgressLine('frame=42', 10)).toBeNull();
    expect(parseFfmpegProgressLine('out_time_us=invalid', 10)).toBeNull();
    expect(parseFfmpegProgressLine('out_time_us=1000', 0)).toBeNull();
  });
});

it.skipIf(process.platform === 'win32')(
  'stops only the started child and waits for its close on cancellation',
  async () => {
    const dir = await fs.mkdtemp(
      path.join(os.tmpdir(), 'export-cancel-child-'),
    );
    const controller = new AbortController();
    let task: Promise<void> | undefined;
    try {
      const ready = path.join(dir, 'ready');
      const closed = path.join(dir, 'closed');
      const program = `const fs = require('node:fs'); process.on('SIGTERM', () => setTimeout(() => { fs.writeFileSync(process.argv[2], 'closed'); process.exit(0); }, 75)); fs.writeFileSync(process.argv[1], 'ready'); setInterval(() => {}, 1000);`;
      task = runFfmpegProcess(
        () => process.execPath,
        ['-e', program, ready, closed],
        undefined,
        controller.signal,
      );
      const rejected = expect(task).rejects.toMatchObject({
        name: 'AbortError',
      });
      await vi.waitFor(async () =>
        expect(await fs.readFile(ready, 'utf8')).toBe('ready'),
      );
      controller.abort();
      await rejected;
      expect(await fs.readFile(closed, 'utf8')).toBe('closed');
    } finally {
      controller.abort();
      await task?.catch(() => undefined);
      await fs.rm(dir, { recursive: true, force: true });
    }
  },
);

describe('resolveH264Encoder', () => {
  it('uses the OS software encoder on Windows without GPU prerequisites', () => {
    const encoder = resolveH264Encoder('win32');
    expect(encoder.backend).toBe('mediafoundation');
    expect(encoder.args).toContain('h264_mf');
    expect(encoder.args).toEqual(
      expect.arrayContaining([
        '-hw_encoding',
        '0',
        '-profile:v',
        '77',
        '-pix_fmt',
        'nv12',
      ]),
    );
    expect(encoder.args).not.toContain('h264_videotoolbox');
  });
  it('uses the bundled macOS VideoToolbox encoder without libx264 options', () => {
    const configuration = resolveH264Encoder('darwin');

    expect(configuration.backend).toBe('videotoolbox');
    expect(configuration.args).toEqual(
      expect.arrayContaining(['-c:v', 'h264_videotoolbox', '-b:v', '5M']),
    );
    expect(configuration.args).not.toContain('libx264');
    expect(configuration.args).not.toContain('-crf');
  });

  it('permits VideoToolbox software encoding for offline exports without changing capture', () => {
    const capture = resolveH264Encoder('darwin');
    const output = resolveExportH264Encoder('darwin');
    expect(output.backend).toBe('videotoolbox');
    expect(output.args).toEqual([...capture.args, '-allow_sw', '1']);
    expect(capture.args).not.toContain('-allow_sw');
    expect(output.args).not.toContain('-require_sw');
    expect(resolveExportH264Encoder('win32')).toEqual(
      resolveH264Encoder('win32'),
    );
    expect(resolveExportH264Encoder('linux')).toEqual(
      resolveH264Encoder('linux'),
    );
  });

  it.skipIf(process.platform !== 'darwin')(
    'uses the software-permitted configuration in the actual macOS export arguments',
    () => {
      expect(H264_ENCODER_ARGS).toEqual(
        resolveExportH264Encoder('darwin').args,
      );
    },
  );

  it('keeps libx264 settings for non-macOS development toolchains', () => {
    expect(resolveH264Encoder('linux')).toEqual({
      backend: 'libx264',
      args: ['-c:v', 'libx264', '-preset', 'fast', '-crf', '20'],
    });
  });
});

describe('FfmpegExecutionError', () => {
  it('explains the exact VideoToolbox encoder availability failure while retaining details', () => {
    const details = { exitCode: 187, signal: null, stderrTail: '[h264_videotoolbox @ 0x123] Error: cannot create compression session: -12908\nConversion failed!', executablePath: '/private/ffmpeg', commandSummary: 'ffmpeg -i <value>', videoToolboxRequested: true };
    const error = new FfmpegExecutionError(details);
    expect(error.message).toContain('H.264 エンコーダーを利用できない');
    expect(error.message).toContain('-12908');
    expect(error.details).toEqual(details);
    expect(error.message).not.toContain('/private/ffmpeg');
  });

  it('does not classify unrelated diagnostics or a signal as encoder unavailable', () => {
    for (const details of [
      { exitCode: 1, signal: null, stderrTail: 'input contains -12908' },
      { exitCode: 1, signal: null, stderrTail: 'metadata: [h264_videotoolbox @ 0x123] Error: cannot create compression session: -12908' },
      { exitCode: 1, signal: null, stderrTail: '[h264_videotoolbox @ 0x123] Error: cannot create compression session: -129080' },
      { exitCode: 1, signal: null, stderrTail: '[h264_videotoolbox @ 0x123] Error: cannot create compression session: -1290' },
      { exitCode: 1, signal: null, stderrTail: '[h264_videotoolbox @ 0x123] Error: cannot create compression session: -12908 extra' },
      { exitCode: 1, signal: null, stderrTail: '[h264_videotoolbox @ 0x123] Error: cannot create compression session: -12915' },
      { exitCode: null, signal: 'SIGTERM' as const, stderrTail: '[h264_videotoolbox @ 0x123] Error: cannot create compression session: -12908' },
    ]) {
      const error = new FfmpegExecutionError({ ...details, executablePath: '/private/ffmpeg', commandSummary: 'ffmpeg', videoToolboxRequested: true });
      expect(error.message).not.toContain('H.264 エンコーダーを利用できない');
    }
    const noEncoder = new FfmpegExecutionError({ exitCode: 1, signal: null, stderrTail: '[h264_videotoolbox @ 0x123] Error: cannot create compression session: -12908', executablePath: '/private/ffmpeg', commandSummary: 'ffmpeg' });
    expect(noEncoder.message).not.toContain('H.264 エンコーダーを利用できない');
  });

  it('retains bounded diagnostic metadata separately from its summary', () => {
    const error = new FfmpegExecutionError({
      exitCode: 1,
      signal: null,
      stderrTail: 'Unknown encoder',
      executablePath: '/private/path/ffmpeg',
      commandSummary: 'ffmpeg -i <value>',
    });

    expect(error.message).toBe('ffmpeg exited with code 1');
    expect(error.details.stderrTail).toBe('Unknown encoder');
    expect(error.details.commandSummary).not.toContain('/private/path');
  });
});

it('copies a single completed file byte-for-byte and never overwrites an existing output', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'export-copy-test-'));
  try {
    const source = path.join(dir, 'source.mp4');
    const output = path.join(dir, 'output.mp4');
    const data = Buffer.from([0, 1, 2, 3]);
    await fs.writeFile(source, data);
    await concatFfmpegFiles(
      () => {
        throw new Error('FFmpeg must not run');
      },
      [source],
      output,
    );
    expect(await fs.readFile(output)).toEqual(data);
    await fs.writeFile(source, 'replacement');
    await expect(
      concatFfmpegFiles(() => '', [source], output),
    ).rejects.toMatchObject({ code: 'EEXIST' });
    expect(await fs.readFile(output)).toEqual(data);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
