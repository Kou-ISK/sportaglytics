import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { listSportscodeBundleFiles } from './sportscodeBundle';

let work: string;
beforeEach(async () => {
  work = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'bundle-input-')),
  );
});
afterEach(async () => {
  await fs.rm(work, { recursive: true, force: true });
});
it('finds individual XML and media without merging timelines, reading native databases, or crossing nested packages', async () => {
  const root = path.join(work, 'Match.SCpkg');
  await fs.mkdir(path.join(root, 'other.scpkg'), { recursive: true });
  await fs.mkdir(path.join(root, 'media'));
  for (const name of [
    'a.xml',
    'b.xml',
    'media/First.mp4',
    'media/Second.mov',
    'native.timeline',
    'other.scpkg/hidden.xml',
    '.hidden.xml',
  ])
    await fs.writeFile(path.join(root, name), 'fixture');
  const result = await listSportscodeBundleFiles(root);
  expect(result.xml.sort()).toEqual(
    ['a.xml', 'b.xml'].map((n) => path.join(root, n)),
  );
  expect(result.movies.sort()).toEqual(
    ['media/First.mp4', 'media/Second.mov'].map((n) => path.join(root, n)),
  );
});
it('distinguishes raw native data from an XML interchange file', async () => {
  const root = path.join(work, 'Match.scpkg');
  await fs.mkdir(root);
  await fs.writeFile(path.join(root, 'native.timeline'), 'fixture');
  expect(await listSportscodeBundleFiles(root)).toEqual({
    xml: [],
    movies: [],
  });
  await expect(listSportscodeBundleFiles(work)).rejects.toThrow('.scpkg');
});
