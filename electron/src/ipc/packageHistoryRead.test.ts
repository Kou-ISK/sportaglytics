import { expect, it, vi } from 'vitest';
import { awaitPackageHistoryRead } from './packageHistoryRead';
import { PackageOpenOperations } from './packageOpenOperations';

it('rejects cancellation while the OS read remains pending and consumes its late result', async () => {
  const abort = new AbortController();
  let finish: (value: string[]) => void = () => undefined;
  const subsequentWrite = vi.fn();
  const read = awaitPackageHistoryRead(
    () =>
      new Promise<string[]>((resolve) => {
        finish = resolve;
      }),
    abort.signal,
  ).then(subsequentWrite);
  const rejected = expect(read).rejects.toThrow('PACKAGE_OPEN_CANCELLED');
  await Promise.resolve();
  abort.abort();
  await rejected;
  finish(['Sample.stpkg.backup-existing']);
  await Promise.resolve();
  expect(subsequentWrite).not.toHaveBeenCalled();
});

it('does not start an already cancelled read or swallow a filesystem failure', async () => {
  const abort = new AbortController();
  abort.abort();
  const read = vi.fn(async () => []);
  await expect(awaitPackageHistoryRead(read, abort.signal)).rejects.toThrow(
    'PACKAGE_OPEN_CANCELLED',
  );
  expect(read).not.toHaveBeenCalled();
  await expect(
    awaitPackageHistoryRead(async () => {
      throw Error('EIO');
    }),
  ).rejects.toThrow('EIO');
});

it('requires the matching owner and request, and only cancels the read-only phase', () => {
  const operations = new PackageOpenOperations();
  const notify = vi.fn();
  const first = operations.begin(1, 'first', notify);
  expect(operations.cancel(1, 'first')).toBe(false);
  first.directoryWaiting(true);
  expect(operations.cancel(2, 'first')).toBe(false);
  expect(operations.cancel(1, 'stale')).toBe(false);
  expect(operations.cancel(1, 'first')).toBe(true);
  expect(first.signal.aborted).toBe(true);
  first.finish();
  const second = operations.begin(1, 'second', notify);
  second.directoryWaiting(true);
  first.finish();
  expect(operations.cancel(1, 'first')).toBe(false);
  second.directoryWaiting(false);
  expect(operations.cancel(1, 'second')).toBe(false);
  second.finish();
});

it('abandons a departed renderer before its history read and ignores a late rejection', async () => {
  const operations = new PackageOpenOperations();
  const queued = operations.begin(1, 'queued', vi.fn());
  operations.abandon(1, 'queued');
  const read = vi.fn(async () => []);
  await expect(awaitPackageHistoryRead(read, queued.signal)).rejects.toThrow(
    'PACKAGE_OPEN_CANCELLED',
  );
  expect(read).not.toHaveBeenCalled();
  queued.finish();
  const active = operations.begin(1, 'active', vi.fn());
  active.directoryWaiting(true);
  let rejectRead: (error: Error) => void = () => undefined;
  const waiting = awaitPackageHistoryRead(
    () =>
      new Promise<string[]>((_, reject) => {
        rejectRead = reject;
      }),
    active.signal,
  );
  const rejected = expect(waiting).rejects.toThrow('PACKAGE_OPEN_CANCELLED');
  await Promise.resolve();
  operations.abandon(1, 'active');
  await rejected;
  rejectRead(Error('late EIO'));
  await Promise.resolve();
  active.finish();
  expect(() => operations.begin(1, 'next', vi.fn())).not.toThrow();
});
