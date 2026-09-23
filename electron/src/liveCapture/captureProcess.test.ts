import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
const { spawn } = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn }));
import { CaptureProcess } from './captureProcess';
afterEach(() => vi.useRealTimers());
it('bounds stop even if a capture worker never acknowledges termination', async () => {
  vi.useFakeTimers();
  const child = Object.assign(new EventEmitter(), {
    stdin: Object.assign(new EventEmitter(), { end: vi.fn(), write: vi.fn() }),
    stdout: { resume: vi.fn() },
    stderr: { resume: vi.fn() },
    kill: vi.fn(),
  });
  spawn.mockReturnValue(child);
  const process = new CaptureProcess(
    'ffmpeg',
    'media',
    { id: 'one', name: 'Camera', kind: 'device' },
    '720p',
    () => {},
  );
  const stopped = expect(process.stop()).rejects.toThrow('タイムアウト');
  await vi.advanceTimersByTimeAsync(10000);
  await stopped;
  expect(child.kill).toHaveBeenCalledWith('SIGKILL');
});
it('resolves shutdown when the window notification target has already closed', async () => {
  const child = Object.assign(new EventEmitter(), {
    stdin: Object.assign(new EventEmitter(), { end: vi.fn(), write: vi.fn() }),
    stdout: { resume: vi.fn() },
    stderr: { resume: vi.fn() },
    kill: vi.fn(),
  });
  spawn.mockReturnValue(child);
  const process = new CaptureProcess(
    'ffmpeg',
    'media',
    { id: 'one', name: 'Camera', kind: 'device' },
    '720p',
    () => {
      throw new Error('Target destroyed');
    },
  );
  const stopped = process.stop();
  child.emit('close');
  await expect(stopped).resolves.toBeUndefined();
});
