import { spawn } from 'child_process';
import { afterEach, expect, it, vi } from 'vitest';
import { ensureWindowsH264Encoder } from '../windowsH264Capability';
import { runFfmpegProcess } from './exportFfmpegProcess';

vi.mock('child_process', () => ({ spawn: vi.fn() }));
vi.mock('../windowsH264Capability', () => ({
  ensureWindowsH264Encoder: vi.fn(),
}));
afterEach(() => vi.resetAllMocks());

it('returns the media feature guidance before starting an export process', async () => {
  const unavailable = new Error('Media Feature Pack is required');
  vi.mocked(ensureWindowsH264Encoder).mockRejectedValue(unavailable);
  const progress = vi.fn();
  await expect(
    runFfmpegProcess(
      () => 'synthetic-ffmpeg',
      ['-c:v', 'h264_mf', 'output.mp4'],
      {
        durationSeconds: 3,
        onProgress: progress,
      },
    ),
  ).rejects.toBe(unavailable);
  expect(ensureWindowsH264Encoder).toHaveBeenCalledWith('synthetic-ffmpeg');
  expect(spawn).not.toHaveBeenCalled();
  expect(progress).not.toHaveBeenCalled();
});

it('does not require a Windows encoder for a stream-copy operation', async () => {
  const reachedProcess = new Error('synthetic process boundary');
  vi.mocked(spawn).mockImplementation(() => {
    throw reachedProcess;
  });
  await expect(
    runFfmpegProcess(() => 'synthetic-ffmpeg', ['-c', 'copy', 'output.mp4']),
  ).rejects.toBe(reachedProcess);
  expect(ensureWindowsH264Encoder).not.toHaveBeenCalled();
  expect(spawn).toHaveBeenCalledTimes(1);
});
