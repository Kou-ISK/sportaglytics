// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { removeKnownEntries } from './removeKnownEntries';
vi.mock('node:fs/promises', async (original) => {
  const actual = await original<typeof import('node:fs/promises')>();
  return { ...actual, unlink: vi.fn(actual.unlink), readdir: vi.fn(actual.readdir) };
});
const roots: string[] = [];
const fileIdentities = new Map<string, Map<string, { device: string; inode: string }>>();
const identities = new Map<string, { device: string; inode: string }>();
beforeEach(() => { vi.clearAllMocks(); });
afterEach(async () => {
  vi.restoreAllMocks();
  // Only fresh fixtures created and owned by this test are removed.
  for (const root of roots.splice(0)) await fs.rm(root, { recursive: true, force: true });
});
const fixture = async (): Promise<string> => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'known-cleanup-'));
  roots.push(root);
  const stage = path.join(root, 'stage');
  await fs.mkdir(stage);
  await fs.writeFile(path.join(stage, 'clip.mp4'), 'owned test video');
  const stat = await fs.lstat(stage, { bigint: true });
  const fileStat = await fs.lstat(path.join(stage, 'clip.mp4'), { bigint: true });
  fileIdentities.set(stage, new Map([['clip.mp4', { device: String(fileStat.dev), inode: String(fileStat.ino) }]]));
  identities.set(stage, { device: String(stat.dev), inode: String(stat.ino) });
  return stage;
};
it('removes an ordinary completed staging directory', async () => {
  const stage = await fixture();
  await removeKnownEntries(stage, identities.get(stage), new Set(['clip.mp4']), new Set(), fileIdentities.get(stage));
  await expect(fs.lstat(stage)).rejects.toMatchObject({ code: 'ENOENT' });
});
it('retains all entries when an unexpected entry is initially present', async () => {
  const stage = await fixture();
  await fs.writeFile(path.join(stage, 'unrelated'), 'preserve');
  await expect(removeKnownEntries(stage, identities.get(stage), new Set(['clip.mp4']), new Set(), fileIdentities.get(stage))).rejects.toThrow('unknown entry');
  expect(await fs.readFile(path.join(stage, 'clip.mp4'), 'utf8')).toBe('owned test video');
  expect(fs.unlink).not.toHaveBeenCalled();
});
it('never recursively deletes a late unknown entry', async () => {
  const stage = await fixture();
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  vi.mocked(fs.unlink).mockImplementationOnce(async (target) => {
    await actual.mkdir(path.join(stage, 'late-directory'));
    await actual.writeFile(path.join(stage, 'late-directory', 'unrelated'), 'preserve');
    await actual.unlink(target);
  });
  await expect(removeKnownEntries(stage, identities.get(stage), new Set(['clip.mp4']), new Set(), fileIdentities.get(stage))).rejects.toMatchObject({ code: 'ENOTEMPTY' });
  expect(await fs.readFile(path.join(stage, 'late-directory', 'unrelated'), 'utf8')).toBe('preserve');
});
it('does not traverse a symlink even when its name is allowed', async () => {
  const stage = await fixture();
  const original = path.join(path.dirname(stage), 'original');
  await fs.rename(path.join(stage, 'clip.mp4'), original);
  await fs.symlink(original, path.join(stage, 'clip.mp4'));
  await expect(removeKnownEntries(stage, identities.get(stage), new Set(['clip.mp4']), new Set(), fileIdentities.get(stage))).rejects.toThrow('unknown entry');
  expect(await fs.readFile(original, 'utf8')).toBe('owned test video');
});
it('retains a directory substituted before entry inspection', async () => {
  const stage = await fixture();
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  vi.mocked(fs.readdir).mockImplementationOnce(async () => {
    await actual.rename(stage, `${stage}-original`);
    await actual.mkdir(stage);
    await actual.writeFile(path.join(stage, 'clip.mp4'), 'replacement');
    return ['clip.mp4'];
  });
  await expect(removeKnownEntries(stage, identities.get(stage), new Set(['clip.mp4']), new Set(), fileIdentities.get(stage))).rejects.toThrow(/directory changed|ownership changed/);
  expect(await fs.readFile(path.join(stage, 'clip.mp4'), 'utf8')).toBe('replacement');
  expect(fs.unlink).not.toHaveBeenCalled();
});

it('retains a directory replaced before cleanup starts', async () => {
  const stage = await fixture();
  await fs.rename(stage, `${stage}-original`);
  await fs.mkdir(stage);
  await fs.writeFile(path.join(stage, 'clip.mp4'), 'replacement');
  await expect(removeKnownEntries(stage, identities.get(stage), new Set(['clip.mp4']), new Set(), fileIdentities.get(stage))).rejects.toThrow(/directory changed|ownership changed/);
  expect(await fs.readFile(path.join(stage, 'clip.mp4'), 'utf8')).toBe('replacement');
  expect(fs.unlink).not.toHaveBeenCalled();
});
it('retains everything when the original directory identity is unknown', async () => {
  const stage = await fixture();
  await expect(removeKnownEntries(stage, undefined, new Set(['clip.mp4']), new Set(), fileIdentities.get(stage))).rejects.toThrow('directory changed');
  expect(fs.unlink).not.toHaveBeenCalled();
});

it('retains an allowed-name file replaced before cleanup starts', async () => {
  const stage = await fixture();
  await fs.rename(path.join(stage, 'clip.mp4'), path.join(path.dirname(stage), 'original.mp4'));
  await fs.writeFile(path.join(stage, 'clip.mp4'), 'replacement');
  await expect(removeKnownEntries(stage, identities.get(stage), new Set(['clip.mp4']), new Set(), fileIdentities.get(stage))).rejects.toThrow('ownership changed');
  expect(await fs.readFile(path.join(stage, 'clip.mp4'), 'utf8')).toBe('replacement');
  expect(fs.unlink).not.toHaveBeenCalled();
});
