// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type { PlaylistItem } from '../../../src/types/playlist/core';
import {
  resolvePlaylistMediaReferences,
  relinkPlaylistPackage,
} from './mediaReferences';
import { registerPackageLocation } from '../mediaReferences/packageLocationRegistry';
import {
  createMacFileBookmark,
  resolveMacFileBookmark,
} from '../mediaReferences/macFileBookmark';
const state = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({ app: { getPath: () => state.userData } }));
let root = '';
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'playlist-references-'));
  state.userData = path.join(root, 'profile');
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});
const fixture = async (): Promise<{
  pkg: string;
  playlist: string;
  items: PlaylistItem[];
}> => {
  const pkg = path.join(root, 'original', 'sample.stpkg');
  const playlist = path.join(root, 'original', 'review.stpl');
  await fs.mkdir(path.join(pkg, '.metadata'), { recursive: true });
  await fs.mkdir(playlist);
  await fs.writeFile(
    path.join(pkg, '.metadata/config.json'),
    JSON.stringify({ angles: [] }),
  );
  await fs.writeFile(path.join(pkg, 'one.mp4'), 'one');
  await fs.writeFile(path.join(pkg, 'two.mp4'), 'two');
  return {
    pkg,
    playlist,
    items: ['first', 'second'].map((id) => ({
      id,
      timelineItemId: null,
      actionName: 'Review',
      startTime: 1,
      endTime: 2,
      addedAt: 1,
      videoSource: path.join(pkg, 'one.mp4'),
      videoSource2: path.join(pkg, 'two.mp4'),
    })),
  };
};

it('follows a portable folder copy even while the original package still exists', async () => {
  const { items, playlist } = await fixture();
  const saved = await resolvePlaylistMediaReferences(items, playlist);
  await fs.cp(path.dirname(playlist), path.join(root, 'copied'), {
    recursive: true,
  });
  const reopened = await resolvePlaylistMediaReferences(
    saved.items,
    path.join(root, 'copied/review.stpl'),
  );
  expect(reopened.missingItemIds).toEqual([]);
  expect(reopened.items[0].videoSource).toBe(
    path.join(root, 'copied/sample.stpkg/one.mp4'),
  );
  expect(reopened.items[0].mediaReference?.packageId).toBe(
    saved.items[0].mediaReference?.packageId,
  );
  const onDisk = JSON.stringify(reopened.items);
  expect(onDisk).not.toContain('bookmark');
});

it('recovers a renamed sibling package by identity with no machine registry', async () => {
  const { items, playlist, pkg } = await fixture();
  const saved = await resolvePlaylistMediaReferences(items, playlist);
  await fs.rename(pkg, path.join(path.dirname(pkg), 'renamed.stpkg'));
  await fs.rm(state.userData, { recursive: true });
  const reopened = await resolvePlaylistMediaReferences(saved.items, playlist);
  expect(reopened.missingItemIds).toEqual([]);
  expect(reopened.items[1].videoSource2).toContain(
    `renamed.stpkg${path.sep}two.mp4`,
  );
});

it('reconnects every item and angle using the same moved package, and rejects another identity', async () => {
  const { items, playlist, pkg } = await fixture();
  const saved = await resolvePlaylistMediaReferences(items, playlist);
  const moved = path.join(root, 'moved.stpkg');
  await fs.rename(pkg, moved);
  const result = await relinkPlaylistPackage(
    saved.items,
    'first',
    'primary',
    moved,
    playlist,
  );
  expect(
    result.items.every(
      (item) => item.videoSource2 === path.join(moved, 'two.mp4'),
    ),
  ).toBe(true);
  const wrong = path.join(root, 'unrelated.stpkg');
  await fs.cp(moved, wrong, { recursive: true });
  await fs.rm(path.join(wrong, '.metadata/package-id.json'));
  await expect(
    relinkPlaylistPackage(saved.items, 'first', 'primary', wrong),
  ).rejects.toThrow('異なるパッケージ');
});

it('preserves missing sources and identities rather than substituting a same-named package', async () => {
  const { items, playlist, pkg } = await fixture();
  const saved = await resolvePlaylistMediaReferences(items, playlist);
  await fs.rm(pkg, { recursive: true });
  // A different package reuses the old name; its footage must never substitute.
  await fs.mkdir(path.join(pkg, '.metadata'), { recursive: true });
  await fs.writeFile(path.join(pkg, '.metadata/config.json'), '{}');
  await fs.writeFile(path.join(pkg, 'one.mp4'), 'unrelated');
  await registerPackageLocation(pkg);
  const missing = await resolvePlaylistMediaReferences(saved.items, playlist);
  expect(missing.missingItemIds).toEqual(['first', 'second']);
  expect(missing.items[0].videoSource).toBeUndefined();
  expect(missing.items[0].mediaReference).toEqual(
    saved.items[0].mediaReference,
  );
  const repeated = await resolvePlaylistMediaReferences(
    missing.items,
    playlist,
  );
  expect(repeated.items).toEqual(missing.items);
});

it('recovers on any platform once the moved package is opened and registered', async () => {
  const { items, playlist, pkg } = await fixture();
  const saved = await resolvePlaylistMediaReferences(items, playlist);
  const moved = path.join(root, 'elsewhere.stpkg');
  await fs.rename(pkg, moved);
  await registerPackageLocation(moved);
  const resolved = await resolvePlaylistMediaReferences(saved.items, playlist);
  expect(resolved.missingItemIds).toEqual([]);
  expect(await fs.realpath(path.dirname(resolved.items[0].videoSource!))).toBe(
    await fs.realpath(moved),
  );
});

it('rejects traversal in package members', async () => {
  const { items, playlist } = await fixture();
  const saved = await resolvePlaylistMediaReferences(items, playlist);
  saved.items[0].mediaReference!.mediaPath = '../outside.mp4';
  await expect(
    resolvePlaylistMediaReferences(saved.items, playlist),
  ).rejects.toThrow('INVALID_PACKAGE_MEDIA_PATH');
});

it.skipIf(process.platform !== 'darwin')(
  'tracks a moved and renamed package through a real native bookmark',
  async () => {
    const { pkg } = await fixture();
    const bookmark = await createMacFileBookmark(pkg);
    expect(bookmark).toBeTruthy();
    const folder = path.join(root, 'unrelated-folder');
    await fs.mkdir(folder);
    const moved = path.join(folder, 'renamed.stpkg');
    await fs.rename(pkg, moved);
    const resolved = await resolveMacFileBookmark(bookmark!);
    expect(resolved).toBe(await fs.realpath(moved));
  },
);
