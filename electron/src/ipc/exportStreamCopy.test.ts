import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  canConcatenateWithoutEncoding,
  resolveMediaCopyMode,
} from './exportStreamCopy';
import { runMediaProcess } from './mediaProcessRunner';
vi.mock('./mediaProcessRunner', () => ({ runMediaProcess: vi.fn() }));
vi.mock('../mediaTools', () => ({ getFfprobePath: () => '/ffprobe' }));
const stream = {
  codec_type: 'video',
  codec_name: 'h264',
  time_base: '1/30000',
  width: 1280,
  height: 720,
  extradata_hash: 'SHA256:synthetic',
  has_b_frames: 0,
};
const probe = (changes = {}) => ({
  stdout: JSON.stringify({
    format: { duration: '60', start_time: '0' },
    streams: [{ ...stream, ...changes }],
  }),
  stderr: '',
});
describe('lossless export eligibility', () => {
  beforeEach(() => {
    vi.mocked(runMediaProcess).mockReset();
  });
  it('copies entire compatible movies without decoding frames', async () => {
    vi.mocked(runMediaProcess).mockResolvedValue(probe());
    expect(
      await canConcatenateWithoutEncoding(['first.mp4', 'second.mp4']),
    ).toBe(true);
    expect(await resolveMediaCopyMode('first.mp4', 0, 60)).toBe('whole-file');
    expect(
      vi
        .mocked(runMediaProcess)
        .mock.calls.every(([, args]) => !args.includes('-show_frames')),
    ).toBe(true);
  });
  it.each([
    { width: 1920 },
    { time_base: '1/60000' },
    { extradata_hash: 'different' },
    { codec_name: 'hevc' },
  ])('does not concatenate incompatible streams (%o)', async (change) => {
    vi.mocked(runMediaProcess)
      .mockResolvedValueOnce(probe())
      .mockResolvedValueOnce(probe(change));
    expect(await canConcatenateWithoutEncoding(['a.mp4', 'b.mp4'])).toBe(false);
  });
  it('only copies partial intervals at verified keyframes without reorder or audio packet ambiguity', async () => {
    vi.mocked(runMediaProcess)
      .mockResolvedValueOnce(probe())
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          frames: [{ key_frame: 1, best_effort_timestamp_time: '10' }],
        }),
        stderr: '',
      })
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          frames: [{ key_frame: 1, best_effort_timestamp_time: '12' }],
        }),
        stderr: '',
      });
    expect(await resolveMediaCopyMode('a.mp4', 10, 2)).toBe('keyframe-range');
    vi.mocked(runMediaProcess).mockResolvedValue(probe({ has_b_frames: 2 }));
    expect(await resolveMediaCopyMode('a.mp4', 10, 2)).toBeNull();
    vi.mocked(runMediaProcess).mockResolvedValue({
      stdout: JSON.stringify({
        format: { duration: '60' },
        streams: [stream, { codec_type: 'audio', codec_name: 'aac' }],
      }),
      stderr: '',
    });
    expect(await resolveMediaCopyMode('a.mp4', 10, 2)).toBeNull();
  });
  it('falls back to encoding when metadata cannot be proven compatible', async () => {
    vi.mocked(runMediaProcess).mockRejectedValue(new Error('probe failed'));
    expect(await canConcatenateWithoutEncoding(['a.mp4', 'b.mp4'])).toBe(false);
    expect(await resolveMediaCopyMode('a.mp4', 0, 2)).toBeNull();
  });
  it.each([
    null,
    { format: { duration: 60 }, streams: [stream] },
    { format: { duration: '60', start_time: 0 }, streams: [stream] },
    { format: { duration: '60' }, streams: [null] },
    { format: { duration: '60' }, streams: 'video' },
  ])(
    'rejects malformed metadata without enabling stream copy (%o)',
    async (data) => {
      vi.mocked(runMediaProcess).mockResolvedValue({
        stdout: JSON.stringify(data),
        stderr: '',
      });
      expect(await resolveMediaCopyMode('a.mp4', 0, 60)).toBeNull();
    },
  );
  it('rejects malformed keyframe responses instead of trusting a partial match', async () => {
    vi.mocked(runMediaProcess)
      .mockResolvedValueOnce(probe())
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          frames: [{ key_frame: 1, best_effort_timestamp_time: '10' }, null],
        }),
        stderr: '',
      });
    expect(await resolveMediaCopyMode('a.mp4', 10, 2)).toBeNull();
  });
});
