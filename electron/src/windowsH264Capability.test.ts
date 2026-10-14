import { expect, it, vi } from 'vitest';
import {
  createWindowsH264Check,
  WINDOWS_H264_UNAVAILABLE,
} from './windowsH264Capability';

it('requires real CPU frames, shares concurrent probes and caches success per executable', async () => {
  const run = vi
    .fn()
    .mockResolvedValue({ stdout: 'frame=3\r\nprogress=end\r\n', stderr: '' });
  const check = createWindowsH264Check(run);
  await Promise.all([check('ffmpeg', 'win32'), check('ffmpeg', 'win32')]);
  await check('ffmpeg', 'win32');
  expect(run).toHaveBeenCalledTimes(1);
  expect(run.mock.calls[0][1]).toEqual(
    expect.arrayContaining([
      'h264_mf',
      '-hw_encoding',
      '0',
      '-pix_fmt',
      'nv12',
    ]),
  );
  expect(run.mock.calls[0][2]).toEqual({
    timeoutMs: 15000,
    maxOutputBytes: 65536,
  });
  await check('other-ffmpeg', 'win32');
  expect(run).toHaveBeenCalledTimes(2);
});

it.each([
  'DLL mfplat.dll failed to open',
  'No suitable transform found',
  'Unknown encoder h264_mf',
  'Media process timed out',
  'ENOENT',
])(
  'explains missing or unusable Windows media support (%s), then permits repair/retry',
  async (message) => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error(message))
      .mockResolvedValue({ stdout: 'frame=3\n', stderr: '' });
    const check = createWindowsH264Check(run);
    await expect(check('ffmpeg', 'win32')).rejects.toThrow(
      WINDOWS_H264_UNAVAILABLE,
    );
    await check('ffmpeg', 'win32');
    expect(run).toHaveBeenCalledTimes(2);
  },
);

it('does not accept an encoder listing or zero-frame success as a working encoder', async () => {
  const check = createWindowsH264Check(
    vi
      .fn()
      .mockResolvedValue({ stdout: 'V..... h264_mf\nframe=0\n', stderr: '' }),
  );
  await expect(check('ffmpeg', 'win32')).rejects.toThrow(
    WINDOWS_H264_UNAVAILABLE,
  );
});

it('leaves macOS and other development platforms unchanged', async () => {
  const run = vi.fn();
  const check = createWindowsH264Check(run);
  await check('ffmpeg', 'darwin');
  await check('ffmpeg', 'linux');
  expect(run).not.toHaveBeenCalled();
});
