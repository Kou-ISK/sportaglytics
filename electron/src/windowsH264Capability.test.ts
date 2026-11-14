import { expect, it, vi } from 'vitest';
import {
  createWindowsH264Check,
  WINDOWS_H264_UNAVAILABLE,
} from './windowsH264Capability';
import {
  exportProcessContext,
  trackExportProcess,
} from './ipc/exportAbortContext';

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
  expect(run.mock.calls[0][2]).toMatchObject({
    timeoutMs: 15000,
    maxOutputBytes: 65536,
  });
  await check('other-ffmpeg', 'win32');
  expect(run).toHaveBeenCalledTimes(2);
});

it('cancels one waiter without stopping a shared probe needed by another', async () => {
  let finish: ((value: { stdout: string; stderr: string }) => void) | undefined;
  let shared: AbortSignal | undefined;
  const run = vi.fn(
    (
      _binary: string,
      _args: readonly string[],
      options: {
        timeoutMs: number;
        maxOutputBytes: number;
        signal?: AbortSignal;
      },
    ) => {
      shared = options.signal;
      return trackExportProcess(
        new Promise<{ stdout: string; stderr: string }>((resolve) => {
          finish = resolve;
        }),
      );
    },
  );
  const check = createWindowsH264Check(run);
  const a = new AbortController();
  const b = new AbortController();
  const registry = new Set<Promise<unknown>>();
  const first = exportProcessContext.run(registry, () =>
    check('ffmpeg', 'win32', a.signal),
  );
  expect(registry.size).toBe(1);
  const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
  const second = check('ffmpeg', 'win32', b.signal);
  a.abort();
  await rejected;
  expect(registry.size).toBe(0);
  expect(shared?.aborted).toBe(false);
  finish?.({ stdout: 'frame=3\n', stderr: '' });
  await expect(second).resolves.toBeUndefined();
  expect(run).toHaveBeenCalledTimes(1);
});

it('waits for the last cancelled shared probe to finish before rejecting and starts a new generation', async () => {
  const controllers: AbortSignal[] = [];
  const endings: Array<(value: { stdout: string; stderr: string }) => void> =
    [];
  const run = vi.fn(
    (
      _binary: string,
      _args: readonly string[],
      options: {
        timeoutMs: number;
        maxOutputBytes: number;
        signal?: AbortSignal;
      },
    ) => {
      if (options.signal) controllers.push(options.signal);
      return new Promise<{ stdout: string; stderr: string }>((resolve) => {
        endings.push(resolve);
      });
    },
  );
  const check = createWindowsH264Check(run);
  const abort = new AbortController();
  const first = check('ffmpeg', 'win32', abort.signal);
  let settled = false;
  void first.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  abort.abort();
  await Promise.resolve();
  expect(controllers[0].aborted).toBe(true);
  expect(settled).toBe(false);
  const second = check('ffmpeg', 'win32');
  expect(run).toHaveBeenCalledTimes(2);
  endings[0]({ stdout: 'frame=3\n', stderr: '' });
  await expect(first).rejects.toMatchObject({ name: 'AbortError' });
  endings[1]({ stdout: 'frame=3\n', stderr: '' });
  await expect(second).resolves.toBeUndefined();
  await check('ffmpeg', 'win32');
  expect(run).toHaveBeenCalledTimes(2);
});

it('does not start a probe for an already cancelled waiter', async () => {
  const run = vi.fn();
  const check = createWindowsH264Check(run);
  const abort = new AbortController();
  abort.abort();
  await expect(check('ffmpeg', 'win32', abort.signal)).rejects.toMatchObject({
    name: 'AbortError',
  });
  expect(run).not.toHaveBeenCalled();
});

it('stops the shared probe only after both waiters cancel, then waits for close', async () => {
  let end: ((value: { stdout: string; stderr: string }) => void) | undefined;
  let probeSignal: AbortSignal | undefined;
  const run = vi.fn(
    (
      _binary: string,
      _args: readonly string[],
      options: {
        timeoutMs: number;
        maxOutputBytes: number;
        signal?: AbortSignal;
      },
    ) => {
      probeSignal = options.signal;
      return new Promise<{ stdout: string; stderr: string }>((resolve) => {
        end = resolve;
      });
    },
  );
  const check = createWindowsH264Check(run);
  const a = new AbortController();
  const b = new AbortController();
  const first = check('ffmpeg', 'win32', a.signal);
  const second = check('ffmpeg', 'win32', b.signal);
  const firstRejected = expect(first).rejects.toMatchObject({
    name: 'AbortError',
  });
  let secondDone = false;
  void second.then(
    () => {
      secondDone = true;
    },
    () => {
      secondDone = true;
    },
  );
  a.abort();
  await firstRejected;
  expect(probeSignal?.aborted).toBe(false);
  b.abort();
  await Promise.resolve();
  expect(probeSignal?.aborted).toBe(true);
  expect(secondDone).toBe(false);
  end?.({ stdout: 'frame=3\n', stderr: '' });
  await expect(second).rejects.toMatchObject({ name: 'AbortError' });
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
