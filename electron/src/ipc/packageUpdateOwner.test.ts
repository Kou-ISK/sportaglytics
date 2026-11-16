import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { readProcessStartIdentity } from './packageUpdateOwner';

const mock = vi.hoisted(() => ({
  execute:
    vi.fn<
      (...args: unknown[]) => Promise<{ stdout: string; stderr: string }>
    >(),
}));
// No real process is started by this suite, on any platform.
vi.mock('node:child_process', async () => {
  const { promisify } = await import('node:util');
  return {
    execFile: Object.assign(
      () => {
        throw new Error('Expected the mocked promise executor');
      },
      { [promisify.custom]: mock.execute },
    ),
  };
});

beforeEach(() => {
  mock.execute.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

it('bounds a cold Windows lookup without changing the owner identity query', async () => {
  vi.stubGlobal('process', { ...process, platform: 'win32' });
  mock.execute.mockResolvedValue({
    stdout: ' 639000000000000000\r\n',
    stderr: '',
  });
  await expect(readProcessStartIdentity(123)).resolves.toBe(
    '639000000000000000',
  );
  expect(mock.execute).toHaveBeenCalledExactlyOnceWith(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      '(Get-Process -Id 123 -ErrorAction Stop).StartTime.ToUniversalTime().Ticks',
    ],
    { timeout: 10000, windowsHide: true },
  );
});

it.each(['darwin', 'linux'])(
  'preserves the existing finite lookup on %s',
  async (platform) => {
    vi.stubGlobal('process', { ...process, platform });
    mock.execute.mockResolvedValue({
      stdout: ' Mon Nov 16 00:00:00 2026\n',
      stderr: '',
    });
    await expect(readProcessStartIdentity(123)).resolves.toBe(
      'Mon Nov 16 00:00:00 2026',
    );
    expect(mock.execute).toHaveBeenCalledExactlyOnceWith(
      '/bin/ps',
      ['-o', 'lstart=', '-p', '123'],
      { timeout: 5000 },
    );
  },
);

it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
  'rejects an invalid process identity before executing: %s',
  async (pid) => {
    await expect(readProcessStartIdentity(pid)).rejects.toThrow(
      'PACKAGE_UPDATE_OWNER_INVALID',
    );
    expect(mock.execute).not.toHaveBeenCalled();
  },
);

it.each(['EPERM', 'ENOENT', 'timeout'])(
  'preserves a %s failure and never retries or manufactures an inactive owner',
  async (code) => {
    vi.stubGlobal('process', { ...process, platform: 'win32' });
    const error = Object.assign(new Error('synthetic lookup failure'), {
      code: code === 'timeout' ? null : code,
      killed: code === 'timeout',
      signal: code === 'timeout' ? 'SIGTERM' : null,
    });
    mock.execute.mockRejectedValue(error);
    await expect(readProcessStartIdentity(123)).rejects.toBe(error);
    expect(mock.execute).toHaveBeenCalledTimes(1);
  },
);

it('rejects an empty lookup result without retrying', async () => {
  mock.execute.mockResolvedValue({ stdout: ' \r\n', stderr: '' });
  await expect(readProcessStartIdentity(123)).rejects.toThrow(
    'PACKAGE_UPDATE_OWNER_INVALID',
  );
  expect(mock.execute).toHaveBeenCalledTimes(1);
});
