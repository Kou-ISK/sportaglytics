// @vitest-environment node
import { EventEmitter } from 'node:events';
import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock('node:child_process', () => ({ spawn: mocks.spawn }));
import { runMediaProcess } from './mediaProcessRunner';

it('does not reject on abort until the owned child emits close', async () => {
  const child = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    killed: false,
    kill: vi.fn(),
  });
  mocks.spawn.mockReturnValue(child);
  const controller = new AbortController();
  const task = runMediaProcess('probe', [], {
    timeoutMs: 5000,
    maxOutputBytes: 100,
    signal: controller.signal,
  });
  let settled = false;
  void task.then(
    () => {
      settled = true;
    },
    () => {
      settled = true;
    },
  );
  controller.abort();
  await Promise.resolve();
  expect(child.kill).toHaveBeenCalledWith('SIGKILL');
  expect(settled).toBe(false);
  child.emit('close', null);
  await expect(task).rejects.toMatchObject({ name: 'AbortError' });
});

it('does not spawn when the signal is already aborted', async () => {
  mocks.spawn.mockClear();
  const controller = new AbortController();
  controller.abort();
  await expect(
    runMediaProcess('probe', [], {
      timeoutMs: 5000,
      maxOutputBytes: 100,
      signal: controller.signal,
    }),
  ).rejects.toMatchObject({ name: 'AbortError' });
  expect(mocks.spawn).not.toHaveBeenCalled();
});
