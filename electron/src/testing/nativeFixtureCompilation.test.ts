// @vitest-environment node
import { ChildProcess } from 'node:child_process';
import { expect, it, vi } from 'vitest';
import { prepareNativeFixture } from './nativeFixtureCompilation';
import type { NativeCompilerJob } from './nativeFixtureCompilation';

const deferred = <T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
} => {
  let resolve: (value: T) => void = () => {
    throw new Error('Deferred promise was not initialized');
  };
  let reject: (error: Error) => void = () => {
    throw new Error('Deferred promise was not initialized');
  };
  const promise = new Promise<T>((fulfill, fail) => {
    resolve = fulfill;
    reject = fail;
  });
  return {
    promise,
    resolve: (value): void => resolve(value),
    reject: (error): void => reject(error),
  };
};

const compiler = (): {
  child: ChildProcess;
  job: NativeCompilerJob;
  finish: () => void;
  fail: (error: Error) => void;
} => {
  // An unspawned stdlib event emitter: no process, signal or OS query is used.
  const child = new ChildProcess();
  const result = deferred<{ stdout: string; stderr: string }>();
  return {
    child,
    job: Object.assign(result.promise, { child }),
    finish: (): void => result.resolve({ stdout: '', stderr: '' }),
    fail: (error): void => result.reject(error),
  };
};

it('prohibits cleanup during filesystem preparation and until the owned child closes', async () => {
  const files = deferred<readonly string[]>();
  const worker = compiler();
  const launch = vi.fn(() => worker.job);
  const task = prepareNativeFixture(() => files.promise, launch);
  expect(task.canCleanup()).toBe(false);
  expect(launch).not.toHaveBeenCalled();
  files.resolve(['synthetic.cpp']);
  await Promise.resolve();
  expect(launch).toHaveBeenCalledOnce();
  expect(task.canCleanup()).toBe(false);
  worker.child.emit('close', 0, null);
  worker.finish();
  await task.ready;
  expect(task.canCleanup()).toBe(true);
});

it('does not treat exit or a prematurely fulfilled callback as confirmed close', async () => {
  const worker = compiler();
  const task = prepareNativeFixture(
    async () => [],
    () => worker.job,
  );
  await Promise.resolve();
  worker.child.emit('exit', 0, null);
  worker.finish();
  await expect(task.ready).rejects.toThrow('compiler close was not confirmed');
  expect(task.canCleanup()).toBe(false);
  worker.child.emit('close', 0, null);
  expect(task.canCleanup()).toBe(true);
});

it.each(['ETIMEDOUT', 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', 'ENOENT'])(
  'preserves the original %s failure and prohibits cleanup before close',
  async (code) => {
    const worker = compiler();
    const task = prepareNativeFixture(
      async () => [],
      () => worker.job,
    );
    await Promise.resolve();
    const error = Object.assign(new Error('synthetic compiler failure'), {
      code,
      stdout: 'compiler output',
      stderr: 'compiler diagnostic',
    });
    worker.fail(error);
    await expect(task.ready).rejects.toBe(error);
    expect(error.stderr).toBe('compiler diagnostic');
    expect(task.canCleanup()).toBe(false);
    worker.child.emit('close', 1, null);
    expect(task.canCleanup()).toBe(true);
  },
);

it('retains uncertain launch state instead of assuming no child was started', async () => {
  const error = new Error('synthetic launcher failure');
  const task = prepareNativeFixture(
    async () => [],
    () => {
      throw error;
    },
  );
  await expect(task.ready).rejects.toBe(error);
  expect(task.canCleanup()).toBe(false);
});

it('can clean up a settled file-preparation failure that never started a child', async () => {
  const error = new Error('synthetic preparation failure');
  const launch = vi.fn(() => compiler().job);
  const task = prepareNativeFixture(async () => {
    throw error;
  }, launch);
  await expect(task.ready).rejects.toBe(error);
  expect(launch).not.toHaveBeenCalled();
  expect(task.canCleanup()).toBe(true);
});

it('does not use another compilation child close as cleanup confirmation', async () => {
  const first = compiler();
  const second = compiler();
  const a = prepareNativeFixture(
    async () => [],
    () => first.job,
  );
  const b = prepareNativeFixture(
    async () => [],
    () => second.job,
  );
  await Promise.resolve();
  first.child.emit('close', 0, null);
  first.finish();
  await a.ready;
  expect(a.canCleanup()).toBe(true);
  expect(b.canCleanup()).toBe(false);
  second.child.emit('close', 0, null);
  second.finish();
  await b.ready;
  expect(b.canCleanup()).toBe(true);
});

it('does not launch a compiler after a timed-out suite abandons pending filesystem preparation', async () => {
  const files = deferred<readonly string[]>();
  const launch = vi.fn(() => compiler().job);
  const task = prepareNativeFixture(() => files.promise, launch);
  task.abandon();
  expect(task.canCleanup()).toBe(false);
  files.resolve(['synthetic.cpp']);
  await expect(task.ready).rejects.toThrow('preparation was abandoned');
  expect(launch).not.toHaveBeenCalled();
  expect(task.canCleanup()).toBe(true);
});

it('abandoning an already started compilation still requires its own close', async () => {
  const worker = compiler();
  const task = prepareNativeFixture(
    async () => [],
    () => worker.job,
  );
  await Promise.resolve();
  task.abandon();
  expect(task.canCleanup()).toBe(false);
  worker.child.emit('close', 0, null);
  worker.finish();
  await task.ready;
  expect(task.canCleanup()).toBe(true);
});
