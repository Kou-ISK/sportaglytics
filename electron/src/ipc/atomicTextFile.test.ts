import fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import {
  drainAtomicTextWrites,
  renameTextFileWithRetry,
  writeTextFileAtomically,
} from './atomicTextFile';

const directories: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
});

it('drains concurrent destinations, including a write queued during the drain', async () => {
  const { dir, file } = await fixture();
  const rename = fs.rename.bind(fs);
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const entered = Promise.withResolvers<void>();
  vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
    if (to === file) {
      entered.resolve();
      await held;
    }
    await rename(from, to);
  });
  const first = writeTextFileAtomically(file, 'first');
  await entered.promise;
  let drained = false;
  const drain = drainAtomicTextWrites().then(() => {
    drained = true;
  });
  const second = writeTextFileAtomically(file, 'latest');
  const other = path.join(dir, 'other.json');
  const third = writeTextFileAtomically(other, 'other');
  await Promise.resolve();
  expect(drained).toBe(false);
  release?.();
  await Promise.all([first, second, third, drain]);
  expect(await fs.readFile(file, 'utf8')).toBe('latest');
  expect(await fs.readFile(other, 'utf8')).toBe('other');
});

it('drain propagates an earlier in-flight failure even if the same-file queue recovers', async () => {
  const { file } = await fixture();
  const rename = fs.rename.bind(fs);
  const held = Promise.withResolvers<void>();
  const entered = Promise.withResolvers<void>();
  let calls = 0;
  vi.spyOn(fs, 'rename').mockImplementation(async (from, to) => {
    if (++calls === 1) {
      entered.resolve();
      await held.promise;
      throw new Error('synthetic in-flight failure');
    }
    return rename(from, to);
  });
  const failed = writeTextFileAtomically(file, 'failed');
  const failure = expect(failed).rejects.toThrow('synthetic in-flight failure');
  await entered.promise;
  const recovery = writeTextFileAtomically(file, 'recovered');
  const drain = expect(drainAtomicTextWrites()).rejects.toThrow(
    'synthetic in-flight failure',
  );
  held.resolve();
  await Promise.all([failure, recovery, drain]);
  expect(await fs.readFile(file, 'utf8')).toBe('recovered');
  // A later attempt starts from a quiescent queue; renderer owns prior dirty errors.
  await expect(drainAtomicTextWrites()).resolves.toBeUndefined();
});
const fixture = async (): Promise<{ dir: string; file: string }> => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sportaglytics-atomic-'));
  directories.push(dir);
  const file = path.join(dir, '日本語 🏉 #%.json');
  await fs.writeFile(file, '{"original":true}');
  return { dir, file };
};

it.each(['EACCES', 'ENOSPC', 'EIO'])(
  'keeps the original after a failed commit: %s',
  async (code) => {
    const { dir, file } = await fixture();
    vi.spyOn(fs, 'rename').mockRejectedValue(
      Object.assign(new Error('synthetic failure'), { code }),
    );
    await expect(
      writeTextFileAtomically(file, '{"replacement":true}'),
    ).rejects.toThrow('synthetic failure');
    expect(await fs.readFile(file, 'utf8')).toBe('{"original":true}');
    expect(await fs.readdir(dir)).toEqual([path.basename(file)]);
  },
);

it('commits concurrent writes in order and cleans temporary files', async () => {
  const { dir, file } = await fixture();
  await Promise.all([
    writeTextFileAtomically(file, 'first'),
    writeTextFileAtomically(file, 'latest'),
  ]);
  expect(await fs.readFile(file, 'utf8')).toBe('latest');
  expect(await fs.readdir(dir)).toEqual([path.basename(file)]);
});

it('rejects a symlink destination without changing its target', async () => {
  const { dir, file } = await fixture();
  const link = path.join(dir, 'link.json');
  await fs.symlink(file, link);
  await expect(writeTextFileAtomically(link, 'replacement')).rejects.toThrow();
  expect(await fs.readFile(file, 'utf8')).toBe('{"original":true}');
});

it('respects a read-only destination even when its parent could be replaced', async () => {
  const { dir, file } = await fixture();
  const access = fs.access.bind(fs);
  vi.spyOn(fs, 'access').mockImplementation(async (candidate, mode) => {
    if (candidate === file && mode === fs.constants.W_OK)
      throw Object.assign(new Error('read-only destination'), {
        code: 'EACCES',
      });
    return access(candidate, mode);
  });
  await expect(writeTextFileAtomically(file, 'replacement')).rejects.toThrow(
    'read-only destination',
  );
  expect(await fs.readFile(file, 'utf8')).toBe('{"original":true}');
  expect(await fs.readdir(dir)).toEqual([path.basename(file)]);
});

it.each(['EPERM', 'EACCES', 'EBUSY'])(
  'retries a transient Windows replacement denial without deleting the original: %s',
  async (code) => {
    const { dir, file } = await fixture();
    const temporary = path.join(dir, 'prepared.json');
    await fs.writeFile(temporary, '{"replacement":true}');
    const rename = vi
      .spyOn(fs, 'rename')
      .mockRejectedValueOnce(
        Object.assign(new Error('transient reader lock'), { code }),
      );
    await renameTextFileWithRetry(temporary, file, 'win32');
    expect(rename).toHaveBeenCalledTimes(2);
    expect(await fs.readFile(file, 'utf8')).toBe('{"replacement":true}');
  },
);
it('bounds a persistent Windows denial and retains both complete files for the caller to clean up', async () => {
  const { dir, file } = await fixture();
  const temporary = path.join(dir, 'prepared.json');
  await fs.writeFile(temporary, '{"replacement":true}');
  const rename = vi
    .spyOn(fs, 'rename')
    .mockRejectedValue(
      Object.assign(new Error('persistent denial'), { code: 'EPERM' }),
    );
  await expect(
    renameTextFileWithRetry(temporary, file, 'win32'),
  ).rejects.toThrow('persistent denial');
  expect(rename).toHaveBeenCalledTimes(5);
  expect(await fs.readFile(file, 'utf8')).toBe('{"original":true}');
  expect(await fs.readFile(temporary, 'utf8')).toBe('{"replacement":true}');
});
