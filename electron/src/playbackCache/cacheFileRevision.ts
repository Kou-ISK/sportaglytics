import type { BigIntStats } from 'node:fs';
export const cacheFileRevision = (info: BigIntStats): string =>
  [info.dev, info.ino, info.size, info.mtimeNs, info.ctimeNs, info.nlink].join(
    ':',
  );
