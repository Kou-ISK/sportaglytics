import fs from 'node:fs/promises';
import { awaitPackageHistoryRead } from './packageHistoryRead';

const pendingDirectories = new Map<string, Promise<string[]>>();

/** A cancelled readdir still occupies OS resources. Keep one physical read per
 * resolved parent path until it settles. Each live request then reads afresh:
 * a cancelled request's stale snapshot must never hide a restored backup. */
export const readPackageHistoryDirectory = (
  directory: string,
  signal?: AbortSignal,
): Promise<string[]> =>
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
    const reading = fs.readdir(directory);
    pendingDirectories.set(directory, reading);
    try {
      return await reading;
    } finally {
      if (pendingDirectories.get(directory) === reading)
        pendingDirectories.delete(directory);
    }
  }, signal);
