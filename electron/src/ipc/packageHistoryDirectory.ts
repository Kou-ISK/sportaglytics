import fs from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { awaitPackageHistoryRead } from './packageHistoryRead';

const pendingDirectories = new Map<string, Promise<unknown>>();

/** A cancelled readdir still occupies OS resources. Keep one physical read per
 * resolved parent path until it settles. Each live request then reads afresh:
 * a cancelled request's stale snapshot must never hide a restored backup. */
const readDirectory = <T>(
  directory: string,
  read: () => Promise<T>,
  signal?: AbortSignal,
): Promise<T> =>
  awaitPackageHistoryRead(async () => {
    let previous = pendingDirectories.get(directory);
    while (previous) {
      // Its result/error belongs to the previous request, not this one.
      await previous.catch(() => undefined);
      signal?.throwIfAborted();
      previous = pendingDirectories.get(directory);
    }
    signal?.throwIfAborted();
    // No await between checking ownership and recording the actual OS read.
    const reading = read();
    pendingDirectories.set(directory, reading);
    try {
      return await reading;
    } finally {
      if (pendingDirectories.get(directory) === reading)
        pendingDirectories.delete(directory);
    }
  }, signal);

export const readPackageHistoryDirectory = (
  directory: string,
  signal?: AbortSignal,
): Promise<string[]> =>
  readDirectory(directory, () => fs.readdir(directory), signal);

export const readPackageHistoryEntries = (
  directory: string,
  signal?: AbortSignal,
): Promise<Dirent[]> =>
  readDirectory(
    directory,
    () => fs.readdir(directory, { withFileTypes: true }),
    signal,
  );
