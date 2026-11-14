// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { ChildProcess, spawn } from 'node:child_process';
import { PassThrough } from 'node:stream';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
vi.mock('electron', () => ({ app: { isPackaged: false } }));
vi.mock('node:child_process', async (original) => ({
  ...await original<typeof import('node:child_process')>(), spawn: vi.fn(),
}));
import { publishHeldSource } from './exportHeldPublish';
const roots: string[] = [];
afterEach(async () => {
  vi.useRealTimers(); vi.restoreAllMocks();
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});
const fixture = async (controller?: AbortController): Promise<{
  child: ChildProcess; stdout: PassThrough; result: Promise<unknown>; target: string;
}> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'held-child-'));
  roots.push(root);
  const target = path.join(root, 'result.mp4');
  const child = new ChildProcess();
  const stdout = new PassThrough();
  Object.assign(child, { stdout, stderr: new PassThrough() });
  vi.spyOn(child, 'kill').mockReturnValue(true);
  let markStarted: () => void = () => { throw new Error('Missing start waiter'); };
  const started = new Promise<void>((resolve) => { markStarted = resolve; });
  vi.mocked(spawn).mockImplementationOnce(() => { markStarted(); return child; });
  const result = publishHeldSource('/verified-host', 3, target, controller?.signal).then(() => 'success', (error: unknown) => error);
  await started;
  return { child, stdout, result, target };
};
it.skipIf(process.platform !== 'darwin')('does not settle cancellation before the child closes', async () => {
  const controller = new AbortController();
  const value = await fixture(controller);
  let settled = false; void value.result.then(() => { settled = true; });
  controller.abort();
  expect(value.child.kill).toHaveBeenCalledWith('SIGTERM');
  await Promise.resolve(); expect(settled).toBe(false);
  value.child.emit('close', null, 'SIGTERM');
  expect(await value.result).toMatchObject({ name: 'IndeterminatePublicationError' });
});
it.skipIf(process.platform !== 'darwin')('preserves a confirmed commit when cancellation races with close', async () => {
  const controller = new AbortController();
  const value = await fixture(controller);
  value.stdout.emit('data', Buffer.from('HELD1:OK\n'));
  controller.abort();
  value.child.emit('close', 0, null);
  expect(await value.result).toBe('success');
});
it.skipIf(process.platform !== 'darwin')('waits for close after the deadline and retains an uncertain result', async () => {
  vi.useFakeTimers();
  const value = await fixture();
  let settled = false; void value.result.then(() => { settled = true; });
  await vi.advanceTimersByTimeAsync(30000);
  expect(value.child.kill).toHaveBeenCalledWith('SIGTERM');
  expect(settled).toBe(false);
  value.child.emit('close', null, 'SIGTERM');
  expect(await value.result).toMatchObject({ name: 'IndeterminatePublicationError' });
  expect(vi.getTimerCount()).toBe(0);
});
it.skipIf(process.platform !== 'darwin')('rejects excessive output even when the child exits zero', async () => {
  const value = await fixture();
  value.stdout.emit('data', Buffer.alloc(4097));
  value.child.emit('close', 0, null);
  expect(await value.result).toMatchObject({ name: 'IndeterminatePublicationError' });
});
it.skipIf(process.platform !== 'darwin')('does not accept a truncated success receipt', async () => {
  const value = await fixture();
  value.stdout.emit('data', Buffer.from('HELD1:OK'));
  value.child.emit('close', 0, null);
  expect(await value.result).toMatchObject({ name: 'IndeterminatePublicationError' });
});
it.skipIf(process.platform !== 'darwin')('reports an old host as unsupported without retry', async () => {
  const value = await fixture();
  value.child.emit('close', 64, null);
  expect(await value.result).toMatchObject({ code: 'ENOTSUP' });
  await expect(fs.lstat(value.target)).rejects.toMatchObject({ code: 'ENOENT' });
});
