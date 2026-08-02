import { describe, expect, it } from 'vitest';
import { parseFfmpegProgressLine } from './exportFfmpegProcess';

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
