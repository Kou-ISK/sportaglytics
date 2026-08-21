import { describe, expect, it } from 'vitest';
import {
  FfmpegExecutionError,
  parseFfmpegProgressLine,
} from './exportFfmpegProcess';
import { resolveH264Encoder } from '../mediaTools';

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

describe('resolveH264Encoder', () => {
  it('uses the bundled macOS VideoToolbox encoder without libx264 options', () => {
    const configuration = resolveH264Encoder('darwin');

    expect(configuration.backend).toBe('videotoolbox');
    expect(configuration.args).toEqual(
      expect.arrayContaining(['-c:v', 'h264_videotoolbox', '-b:v', '5M']),
    );
    expect(configuration.args).not.toContain('libx264');
    expect(configuration.args).not.toContain('-crf');
  });

  it('keeps libx264 settings for non-macOS development toolchains', () => {
    expect(resolveH264Encoder('linux')).toEqual({
      backend: 'libx264',
      args: ['-c:v', 'libx264', '-preset', 'fast', '-crf', '20'],
    });
  });
});

describe('FfmpegExecutionError', () => {
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
