import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

/** Required IPC manifests/receipts are temporary owner data, not diagnostics.
 * Never overwrite or delete a pre-existing slot, even after a crash. */
export const createSessionDirectory = (root: string): string => {
  fs.mkdirSync(root, { recursive: true, mode: 0o700 });
  if (!fs.lstatSync(root).isDirectory())
    throw Error('NATIVE_SESSION_DIRECTORY');
  for (let slot = 1; slot <= 4; slot++) {
    const directory = path.join(root, `session-${slot}`);
    try {
      fs.mkdirSync(directory, { mode: 0o700 });
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'EEXIST')
        continue;
      throw error;
    }
    try {
      fs.mkdirSync(path.join(directory, 'native-run-1'), { mode: 0o700 });
      return directory;
    } catch (error) {
      fs.rmdirSync(directory);
      throw error;
    }
  }
  throw Error('NATIVE_SESSION_SLOTS_OCCUPIED');
};

export const readNativeReceipt = async (directory: string): Promise<Buffer> => {
  const file = path.join(directory, 'native-run-1/native-result.json');
  const stat = await fsp.lstat(file);
  if (!stat.isFile() || stat.size < 1 || stat.size > 2 * 1024 * 1024)
    throw Error('NATIVE_RECEIPT_BOUND');
  return fsp.readFile(file);
};

export const removeOwnedSession = async (directory: string): Promise<void> => {
  await fsp.rm(directory, { recursive: true });
};
