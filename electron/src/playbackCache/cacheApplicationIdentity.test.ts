import native from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, expect, it as itOnAnyHost, vi } from 'vitest';
import {
  readCacheApplicationIdentity,
  isCacheApplicationCurrent,
} from './cacheApplicationIdentity';
// Real POSIX descriptor/ownership contracts for the Mac-only cache path.
// Windows keeps the unsupported-platform and pure/IPC regressions.
const it = itOnAnyHost.skipIf(process.platform === 'win32');
let root: string, file: string, abort: AbortController;
beforeEach(async () => {
  root = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'app-proof-')),
  );
  file = path.join(root, 'app.asar');
  await fs.writeFile(file, 'synthetic archive bytes');
  abort = new AbortController();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fs.rm(root, { recursive: true, force: true });
});
it('hashes physical archive bytes and rejects a same-size replacement revision', async () => {
  const result = await readCacheApplicationIdentity(file, abort.signal, native);
  expect(result?.scope).toBe(
    createHash('sha256').update('synthetic archive bytes').digest('hex'),
  );
  expect(
    result && (await isCacheApplicationCurrent(result, abort.signal, native)),
  ).toBe(true);
  await fs.writeFile(path.join(root, 'replacement'), 'synthetic archive bytes');
  await fs.rename(path.join(root, 'replacement'), file);
  expect(
    result && (await isCacheApplicationCurrent(result, abort.signal, native)),
  ).toBe(false);
});
it('does not open the archive after cancellation during path lookup and permits a later independent caller', async () => {
  const realpath = fs.realpath.bind(fs);
  vi.spyOn(fs, 'realpath').mockImplementationOnce(async (...args) => {
    const value = await realpath(...args);
    abort.abort();
    return value;
  });
  const open = vi.spyOn(fs, 'open');
  await expect(
    readCacheApplicationIdentity(file, abort.signal, native),
  ).rejects.toThrow();
  expect(open).not.toHaveBeenCalled();
  expect(
    await readCacheApplicationIdentity(
      file,
      new AbortController().signal,
      native,
    ),
  ).not.toBeNull();
});
it('rejects linked archives and development directories without reading bytes', async () => {
  await fs.link(file, path.join(root, 'link'));
  expect(
    await readCacheApplicationIdentity(file, abort.signal, native),
  ).toBeNull();
  expect(
    await readCacheApplicationIdentity(root, abort.signal, native),
  ).toBeNull();
});
