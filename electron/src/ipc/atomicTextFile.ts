import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import * as path from 'node:path';

const pendingWrites = new Map<string, Promise<void>>();

/** Windows can briefly deny replacing a file that another reader holds. */
export const renameTextFileWithRetry = async (
  from: string,
  to: string,
  platform: NodeJS.Platform = process.platform,
): Promise<void> => {
  for (let attempt = 0; ; attempt++) {
    try {
      await fs.rename(from, to);
      return;
    } catch (error: unknown) {
      if (
        platform !== 'win32' ||
        attempt >= 4 ||
        !(error instanceof Error) ||
        !('code' in error) ||
        !['EPERM', 'EACCES', 'EBUSY'].includes(String(error.code))
      )
        throw error;
      await delay(25 * 2 ** attempt);
    }
  }
};

const replaceText = async (
  filePath: string,
  content: string,
): Promise<void> => {
  let mode = 0o600;
  try {
    const stat = await fs.lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw new Error('保存先は通常のファイルを選択してください。');
    await fs.access(filePath, fs.constants.W_OK);
    mode = stat.mode & 0o777;
  } catch (error) {
    if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT'))
      throw error;
  }
  const temporary = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${randomUUID()}.writing`,
  );
  try {
    const handle = await fs.open(temporary, 'wx', mode);
    try {
      await handle.writeFile(content, 'utf8');
      await handle.sync();
    } finally {
      await handle.close();
    }
    // Same-directory rename keeps the previous complete file until commit.
    await renameTextFileWithRetry(temporary, filePath);
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => undefined);
  }
};

export const writeTextFileAtomically = async (
  filePath: string,
  content: string,
): Promise<void> => {
  const key = path.resolve(filePath);
  const write = (pendingWrites.get(key) ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => replaceText(key, content));
  pendingWrites.set(key, write);
  try {
    await write;
  } finally {
    if (pendingWrites.get(key) === write) pendingWrites.delete(key);
  }
};
