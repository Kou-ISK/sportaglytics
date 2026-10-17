import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';

/** Stream every copied byte, including media, without loading videos in memory. */
export const packageCopyDigest = async (
  root: string,
  ignoreFinderMetadata = false,
): Promise<string> => {
  const digest = createHash('sha256');
  let count = 0;
  const walk = async (directory: string): Promise<void> => {
    const names = (await fs.readdir(directory)).sort();
    for (const name of names) {
      if (ignoreFinderMetadata && ['.DS_Store', '.localized'].includes(name))
        continue;
      if (++count > 100_000) throw new Error('PACKAGE_TOO_MANY_FILES');
      const file = path.join(directory, name);
      const stat = await fs.lstat(file);
      if (stat.isSymbolicLink() || (!stat.isFile() && !stat.isDirectory()))
        throw new Error('PACKAGE_SYMLINK_UNSUPPORTED');
      digest.update(
        JSON.stringify([
          path.relative(root, file),
          stat.isDirectory() ? 'directory' : stat.size,
        ]),
      );
      if (stat.isDirectory()) await walk(file);
      else
        for await (const chunk of createReadStream(file)) digest.update(chunk);
    }
  };
  await walk(root);
  return digest.digest('hex');
};
