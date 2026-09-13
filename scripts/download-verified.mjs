import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { run } from './media-tools/process.mjs';

export const hashFile = async (file) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};

export const downloadVerified = async (url, file, sha256) => {
  if (existsSync(file) && (await hashFile(file)) === sha256) return;
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.download`;
  try {
    await run('curl', [
      '--fail',
      '--location',
      '--retry',
      '3',
      '--retry-all-errors',
      '--connect-timeout',
      '15',
      '--max-time',
      '600',
      '--output',
      temporary,
      url,
    ]);
    if ((await hashFile(temporary)) !== sha256)
      throw new Error(`Checksum mismatch: ${url}`);
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
};
