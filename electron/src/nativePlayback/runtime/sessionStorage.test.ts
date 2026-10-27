import { afterEach, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createSessionDirectory,
  readNativeReceipt,
  removeOwnedSession,
} from './sessionStorage';

const directories: string[] = [];
const fixture = async (): Promise<string> => {
  const directory = await mkdtemp(path.join(tmpdir(), 'native-session-'));
  directories.push(directory);
  return directory;
};
afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((root) => rm(root, { recursive: true, force: true })),
  );
});
it('preserves occupied slots; creates and removes only the acquired directory', async () => {
  const root = await fixture();
  await mkdir(path.join(root, 'session-1'));
  await writeFile(path.join(root, 'session-1/keep'), 'existing');
  const owned = createSessionDirectory(root);
  expect(owned).toBe(path.join(root, 'session-2'));
  await removeOwnedSession(owned);
  expect(await readFile(path.join(root, 'session-1/keep'), 'utf8')).toBe(
    'existing',
  );
});
it('fails closed when all four session slots are occupied', async () => {
  const root = await fixture();
  for (let slot = 1; slot <= 4; slot++)
    await mkdir(path.join(root, `session-${slot}`));
  expect(() => createSessionDirectory(root)).toThrow('SLOTS_OCCUPIED');
});
it('rejects oversized receipt before reading its bytes', async () => {
  const owned = createSessionDirectory(await fixture());
  await writeFile(
    path.join(owned, 'native-run-1/native-result.json'),
    Buffer.alloc(2 * 1024 * 1024 + 1),
  );
  await expect(readNativeReceipt(owned)).rejects.toThrow('BOUND');
});
