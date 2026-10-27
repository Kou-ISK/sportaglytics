// @vitest-environment node
import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { runNativeExportProcess } from './nativeExportProcess';
vi.mock('node:child_process', () => ({ spawn: vi.fn() }));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
const child = (): EventEmitter & {
  stdin: EventEmitter & { end: ReturnType<typeof vi.fn> };
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
} =>
  Object.assign(new EventEmitter(), {
    stdin: Object.assign(new EventEmitter(), { end: vi.fn() }),
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    kill: vi.fn(),
  });
it('does not release process ownership on deadline before close', async () => {
  vi.useFakeTimers();
  const c = child();
  vi.mocked(spawn).mockImplementation(
    () => c as unknown as ReturnType<typeof spawn>,
  ); // Deliberately partial subprocess test double.
  const settled = vi.fn();
  const promise = runNativeExportProcess('helper', 'request').catch((e) => {
    settled();
    return e;
  });
  await vi.advanceTimersByTimeAsync(120000);
  expect(c.stdin.end).toHaveBeenCalledOnce();
  expect(c.kill).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(2000);
  expect(c.kill).toHaveBeenCalledWith('SIGKILL');
  expect(settled).not.toHaveBeenCalled();
  c.emit('close', null, 'SIGKILL');
  expect(await promise).toEqual(Error('Native export deadline'));
});
it('retains a spawn error until stdio close', async () => {
  const c = child();
  vi.mocked(spawn).mockImplementation(
    () => c as unknown as ReturnType<typeof spawn>,
  ); // Deliberately partial subprocess test double.
  const settled = vi.fn();
  const promise = runNativeExportProcess('helper', 'request').catch((e) => {
    settled();
    return e;
  });
  c.emit('error', Error('spawn failed'));
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  c.emit('close', -1, null);
  expect(await promise).toEqual(Error('spawn failed'));
});
it('uses only the fixed export mode and holds cancellation until child close', async () => {
  vi.useFakeTimers();
  const c = child();
  vi.mocked(spawn).mockImplementation(
    () => c as unknown as ReturnType<typeof spawn>,
  ); // Partial process double.
  const controller = new AbortController(),
    settled = vi.fn();
  const result = runNativeExportProcess('signed-host', 'owned-request', {
    signal: controller.signal,
  }).catch((e) => {
    settled();
    return e;
  });
  expect(spawn).toHaveBeenCalledWith(
    'signed-host',
    ['--export-clip', 'owned-request'],
    { shell: false, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  controller.abort();
  expect(c.stdin.end).toHaveBeenCalledOnce();
  await Promise.resolve();
  expect(settled).not.toHaveBeenCalled();
  c.emit('close', 1, null);
  expect((await result).name).toBe('AbortError');
  await vi.advanceTimersByTimeAsync(5000);
  expect(c.kill).not.toHaveBeenCalled();
});
