import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export interface PackageSourceSnapshot {
  fingerprint: string;
  revision: string;
  contentFingerprint: string;
  bytes: number;
}

/** Metadata is hashed; large media contents are never read for inventory. */
export const snapshotPackageSource = async (
  root: string,
): Promise<PackageSourceSnapshot> => {
  const hash = createHash('sha256');
  const revision = createHash('sha256');
  const contentHash = createHash('sha256');
  let bytes = 0;
  let count = 0;
  const walk = async (directory: string): Promise<void> => {
    const entries = (await fs.readdir(directory, { withFileTypes: true })).sort(
      (a, b) => a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      if (++count > 100_000) throw new Error('PACKAGE_TOO_MANY_FILES');
      const file = path.join(directory, entry.name);
      const stat = await fs.lstat(file);
      if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory()))
        throw new Error('PACKAGE_SYMLINK_UNSUPPORTED');
      const relative = path.relative(root, file);
      hash.update(
        JSON.stringify([relative, stat.size, stat.mtimeMs, stat.mode]),
      );
      contentHash.update(
        JSON.stringify([
          relative,
          stat.isDirectory() ? 'directory' : stat.size,
        ]),
      );
      if (stat.isDirectory()) await walk(file);
      else {
        bytes += stat.size;
        const metadata =
          /\.(json|xml|plist|txt)$/i.test(entry.name) &&
          stat.size <= 16 * 1024 * 1024;
        const data = metadata ? await fs.readFile(file) : undefined;
        if (data) {
          hash.update(data);
          contentHash.update(data);
        }
        // Finder metadata and directory mtime are not a document revision.
        if (!['.DS_Store', '.localized'].includes(entry.name)) {
          revision.update(
            JSON.stringify([
              relative,
              stat.size,
              metadata ? null : stat.mtimeMs,
            ]),
          );
          if (data) revision.update(data);
        }
      }
    }
  };
  await walk(root);
  return {
    fingerprint: hash.digest('hex'),
    revision: revision.digest('hex'),
    contentFingerprint: contentHash.digest('hex'),
    bytes,
  };
};

export const checkMigrationCapacity = async (
  destinationParent: string,
  bytes: number,
): Promise<void> => {
  await fs.access(destinationParent, fs.constants.W_OK);
  const capacity = await fs.statfs(destinationParent, { bigint: true });
  const required = BigInt(bytes) + 16n * 1024n * 1024n;
  if (capacity.bavail * capacity.bsize < required)
    throw new Error('PACKAGE_MIGRATION_SPACE');
};
