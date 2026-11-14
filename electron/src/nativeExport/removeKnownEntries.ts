import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { BigIntStats } from 'node:fs';

const sameIdentity = (left: BigIntStats, right: BigIntStats): boolean =>
  left.dev === right.dev && left.ino === right.ino && left.mode === right.mode;

/**
 * Remove a closed job's expected entries without recursive traversal.
 * Unexpected entries or observed replacements are retained. These checks are
 * not atomic with unlink: hostile same-UID mutation remains outside this guard.
 */
export const removeKnownEntries = async (
  directory: string,
  expectedDirectory: { device: string; inode: string } | undefined,
  allowed: ReadonlySet<string>,
  allowedFifos: ReadonlySet<string> = new Set(),
  expectedEntries?: ReadonlyMap<string, { device: string; inode: string }>,
): Promise<void> => {
  const originalDirectory = await fs.lstat(directory, { bigint: true });
  if (!expectedDirectory || !originalDirectory.isDirectory() ||
    String(originalDirectory.dev) !== expectedDirectory.device ||
    String(originalDirectory.ino) !== expectedDirectory.inode) throw new Error('Export staging directory changed');
  const names = await fs.readdir(directory);
  const entries: Array<{ name: string; identity: BigIntStats }> = [];
  // Inspect all entries before deleting any, including the empty-directory case.
  for (const name of names) {
    const identity = await fs.lstat(path.join(directory, name), { bigint: true });
    if (!((allowed.has(name) && identity.isFile()) ||
      (allowedFifos.has(name) && identity.isFIFO()))) {
      throw new Error('Export staging contains an unknown entry');
    }
    const expected = expectedEntries?.get(name);
    if (!expected || String(identity.dev) !== expected.device || String(identity.ino) !== expected.inode)
      throw new Error('Export staging entry ownership changed');
    entries.push({ name, identity });
  }
  const checkDirectory = async (): Promise<void> => {
    if (!sameIdentity(originalDirectory, await fs.lstat(directory, { bigint: true }))) {
      throw new Error('Export staging directory changed');
    }
  };
  for (const entry of entries) {
    await checkDirectory();
    const target = path.join(directory, entry.name);
    if (!sameIdentity(entry.identity, await fs.lstat(target, { bigint: true }))) {
      throw new Error('Export staging entry changed');
    }
    await fs.unlink(target);
  }
  await checkDirectory();
  // A late addition makes this fail with ENOTEMPTY; it must never be traversed.
  await fs.rmdir(directory);
};
