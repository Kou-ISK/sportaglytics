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
  stdout: EventEmitter;
  stderr: EventEmitter;
  kill: ReturnType<typeof vi.fn>;
} =>
  Object.assign(new EventEmitter(), {
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
