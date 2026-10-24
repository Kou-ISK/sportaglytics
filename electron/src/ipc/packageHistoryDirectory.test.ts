import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { readPackageHistoryDirectory } from './packageHistoryDirectory';

const roots: string[] = [];
const fixture = async (): Promise<string> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'history-read-'));
  roots.push(root);
  return root;
};
const deferred = (): {
  promise: Promise<string[]>;
  resolve: (value: string[]) => void;
  reject: (error: Error) => void;
} => {
  let resolve = (_value: string[]): void => undefined;
  let reject = (_error: Error): void => undefined;
  const promise = new Promise<string[]>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const holdFirstRead = (root: string, pending: Promise<string[]>) => {
  const readdir = fs.readdir.bind(fs);
  let started = false;
  return vi.spyOn(fs, 'readdir').mockImplementation((...args) => {
    if (String(args[0]) === root && args.length === 1 && !started) {
      started = true;
      return pending;
    }
    return Reflect.apply(readdir, fs, args);
  });
};
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    roots.splice(0).map((root) => fs.rm(root, { recursive: true })),
  );
});

it('keeps one OS read through repeated cancellation and reads fresh history on retry', async () => {
  const root = await fixture();
  const pending = deferred();
  const read = holdFirstRead(root, pending.promise);
  const first = new AbortController();
  const old = readPackageHistoryDirectory(root, first.signal);
  const cancelled = expect(old).rejects.toThrow('PACKAGE_OPEN_CANCELLED');
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  first.abort();
  await cancelled;
  for (let index = 0; index < 10; index++) {
    const abort = new AbortController();
    const queued = readPackageHistoryDirectory(root, abort.signal);
    const rejected = expect(queued).rejects.toThrow('PACKAGE_OPEN_CANCELLED');
    await Promise.resolve();
    abort.abort();
    await rejected;
  }
  const retry = readPackageHistoryDirectory(root);
  await Promise.resolve();
  expect(read).toHaveBeenCalledTimes(1);
  await fs.mkdir(path.join(root, 'Sample.stpkg.backup-new'));
  pending.resolve([]); // The old snapshot predates the restored backup.
  expect(await retry).toEqual(['Sample.stpkg.backup-new']);
  expect(read).toHaveBeenCalledTimes(2);
  await fs.mkdir(path.join(root, 'Sample.stpkg.backup-later'));
  expect(await readPackageHistoryDirectory(root)).toHaveLength(2);
  expect(read).toHaveBeenCalledTimes(3);
});

it('does not block another parent while a cancelled read is still pending', async () => {
  const blocked = await fixture();
  const available = await fixture();
  const pending = deferred();
  const read = holdFirstRead(blocked, pending.promise);
  const abort = new AbortController();
  const first = readPackageHistoryDirectory(blocked, abort.signal);
  const rejected = expect(first).rejects.toThrow('PACKAGE_OPEN_CANCELLED');
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  abort.abort();
  await rejected;
  expect(await readPackageHistoryDirectory(available)).toEqual([]);
  expect(read).toHaveBeenCalledTimes(2);
  pending.reject(Error('late EIO'));
  expect(await readPackageHistoryDirectory(blocked)).toEqual([]);
  expect(read).toHaveBeenCalledTimes(3);
});

it('propagates a live read failure, then releases ownership for a fresh retry', async () => {
  const root = await fixture();
  const pending = deferred();
  const read = holdFirstRead(root, pending.promise);
  const first = readPackageHistoryDirectory(root);
  const rejected = expect(first).rejects.toThrow('EIO');
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  const retry = readPackageHistoryDirectory(root);
  pending.reject(Error('EIO'));
  await rejected;
  expect(await retry).toEqual([]);
  expect(read).toHaveBeenCalledTimes(2);
});

it('does not issue I/O for requests cancelled before their turn', async () => {
  const root = await fixture();
  const read = vi.spyOn(fs, 'readdir');
  const abort = new AbortController();
  const queued = readPackageHistoryDirectory(root, abort.signal);
  const rejected = expect(queued).rejects.toThrow('PACKAGE_OPEN_CANCELLED');
  abort.abort();
  await rejected;
  await expect(readPackageHistoryDirectory(root, abort.signal)).rejects.toThrow(
    'PACKAGE_OPEN_CANCELLED',
  );
  expect(read).not.toHaveBeenCalled();
});

it('serializes multiple live waiters and gives each its own fresh snapshot', async () => {
  const root = await fixture();
  const firstRead = deferred();
  const secondRead = deferred();
  const readdir = fs.readdir.bind(fs);
  let calls = 0;
  const read = vi.spyOn(fs, 'readdir').mockImplementation((...args) => {
    if (String(args[0]) === root && args.length === 1) {
      calls++;
      if (calls === 1) return firstRead.promise;
      if (calls === 2) return secondRead.promise;
    }
    return Reflect.apply(readdir, fs, args);
  });
  const first = readPackageHistoryDirectory(root);
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  const second = readPackageHistoryDirectory(root);
  const third = readPackageHistoryDirectory(root);
  await Promise.resolve();
  expect(read).toHaveBeenCalledTimes(1);
  firstRead.resolve(['first']);
  expect(await first).toEqual(['first']);
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2));
  await fs.mkdir(path.join(root, 'new-backup'));
  secondRead.resolve(['second']);
  expect(await second).toEqual(['second']);
  expect(await third).toEqual(['new-backup']);
  expect(read).toHaveBeenCalledTimes(3);
});

it('releases a late failure after every requester cancelled without issuing queued I/O', async () => {
  const root = await fixture();
  const pending = deferred();
  const read = holdFirstRead(root, pending.promise);
  const controllers = Array.from({ length: 3 }, () => new AbortController());
  const requests = controllers.map((controller) =>
    readPackageHistoryDirectory(root, controller.signal),
  );
  const outcomes = Promise.all(
    requests.map((request) =>
      expect(request).rejects.toThrow('PACKAGE_OPEN_CANCELLED'),
    ),
  );
  await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(1));
  controllers.forEach((controller) => controller.abort());
  await outcomes;
  pending.reject(Error('late EIO'));
  await Promise.resolve();
  await Promise.resolve();
  expect(read).toHaveBeenCalledTimes(1);
  await fs.mkdir(path.join(root, 'fresh'));
  expect(await readPackageHistoryDirectory(root)).toEqual(['fresh']);
  expect(read).toHaveBeenCalledTimes(2);
});
