import fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { writeTextFileAtomically } from './atomicTextFile';

const directories: string[] = [];
afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(
    directories
      .splice(0)
      .map((dir) => fs.rm(dir, { recursive: true, force: true })),
  );
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
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(
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
