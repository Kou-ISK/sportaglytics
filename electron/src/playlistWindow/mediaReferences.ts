import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  PlaylistItem,
  PlaylistMediaReference,
  PlaylistMediaResolution,
} from '../../../src/types/playlist/core';
import {
  findMediaPackageRoot,
  readPackageIdentity,
  resolvePackageMember,
} from '../mediaReferences/packageIdentity';
import {
  locateRegisteredPackage,
  registerPackageLocation,
} from '../mediaReferences/packageLocationRegistry';

const exists = async (file: string): Promise<boolean> => {
  try {
    return (await fs.stat(file)).isFile();
  } catch {
    return false;
  }
};
const portableRelative = (from: string, to: string): string =>
  path.relative(from, to).split(path.sep).join('/');

export const resolvePlaylistMediaReferences = async (
  items: PlaylistItem[],
  playlistPath?: string,
): Promise<PlaylistMediaResolution> => {
  const registrations = new Map<string, Promise<string | undefined>>();
  const locations = new Map<string, Promise<string | undefined>>();
  const register = (root: string): Promise<string | undefined> => {
    const pending = registrations.get(root) ?? registerPackageLocation(root);
    registrations.set(root, pending);
    return pending;
  };
  const locate = (
    reference: PlaylistMediaReference,
  ): Promise<string | undefined> => {
    const key = JSON.stringify([
      reference.packageId,
      reference.packagePath,
      reference.relativePackagePath,
    ]);
    const pending =
      locations.get(key) ??
      (async () => {
        const candidates = [
          playlistPath && reference.relativePackagePath
            ? path.resolve(
                playlistPath,
                ...reference.relativePackagePath.split('/'),
              )
            : undefined,
          reference.packagePath,
          playlistPath
            ? path.join(
                path.dirname(playlistPath),
                path.posix.basename(reference.packagePath.replace(/\\/g, '/')),
              )
            : undefined,
        ];
        for (const candidate of candidates) {
          if (
            candidate &&
            path.isAbsolute(candidate) &&
            (await readPackageIdentity(candidate)) === reference.packageId
          )
            return candidate;
        }
        const registered = await locateRegisteredPackage(reference.packageId);
        if (registered) return registered;
        // Search only sibling package identities. Never recursively scan private disks.
        if (playlistPath) {
          const parent = path.dirname(playlistPath);
          const siblings = await fs
            .readdir(parent, { withFileTypes: true })
            .catch(() => []);
          const matches: string[] = [];
          for (const entry of siblings
            .filter(
              (entry) => entry.isDirectory() && /\.stpkg$/i.test(entry.name),
            )
            .slice(0, 256)) {
            const candidate = path.join(parent, entry.name);
            if ((await readPackageIdentity(candidate)) === reference.packageId)
              matches.push(candidate);
          }
          if (matches.length === 1) return matches[0];
        }
        return undefined;
      })();
    locations.set(key, pending);
    return pending;
  };

  const missingItemIds: string[] = [];
  const resolvedItems: PlaylistItem[] = [];
  for (const item of items) {
    const next = { ...item };
    let missing = false;
    for (const [sourceKey, referenceKey] of [
      ['videoSource', 'mediaReference'],
      ['videoSource2', 'mediaReference2'],
    ] as const) {
      const source = item[sourceKey];
      let reference = item[referenceKey];
      if (!source && !reference) continue;
      if (source && /^https?:\/\//i.test(source)) continue;
      if (!reference && source) {
        const root = findMediaPackageRoot(source);
        if (root) {
          const id = await register(root);
          if (id)
            reference = {
              packageId: id,
              packagePath: root,
              mediaPath: portableRelative(root, source),
            };
        }
      }
      if (reference) {
        const root = await locate(reference);
        // Preserve unresolved identity/member paths for a later reconnect.
        const resolvedRoot = root ?? reference.packagePath;
        next[referenceKey] = {
          ...reference,
          packagePath: resolvedRoot,
          relativePackagePath:
            playlistPath && root
              ? portableRelative(playlistPath, root)
              : reference.relativePackagePath,
        };
        if (root) {
          await register(root);
          next[sourceKey] = resolvePackageMember(root, reference.mediaPath);
        } else next[sourceKey] = undefined;
        if (!root || !(await exists(next[sourceKey] ?? ''))) {
          missing = true;
          next[sourceKey] = undefined;
        }
      } else if (source && !(await exists(source))) {
        missing = true;
      }
    }
    if (missing) missingItemIds.push(item.id);
    resolvedItems.push(next);
  }
  return { items: resolvedItems, missingItemIds };
};

/** A user-picked package must match the identity, not merely a reusable filename. */
export const relinkPlaylistPackage = async (
  items: PlaylistItem[],
  itemId: string,
  target: 'primary' | 'secondary',
  root: string,
  playlistPath?: string,
): Promise<PlaylistMediaResolution> => {
  const selected = items.find((item) => item.id === itemId);
  const referenceKey =
    target === 'primary' ? 'mediaReference' : 'mediaReference2';
  const sourceKey = target === 'primary' ? 'videoSource' : 'videoSource2';
  const expected = selected?.[referenceKey];
  const oldRoot =
    expected?.packagePath ?? findMediaPackageRoot(selected?.[sourceKey] ?? '');
  if (!selected || !oldRoot)
    throw new Error('元パッケージの参照がありません。');
  const id = expected
    ? await readPackageIdentity(root)
    : await registerPackageLocation(root);
  if (!id || (expected && expected.packageId !== id))
    throw new Error(
      '異なるパッケージです。元のパッケージの移動先を選択してください。',
    );
  const next = items.map((item) => {
    const updated = { ...item };
    for (const [source, ref] of [
      ['videoSource', 'mediaReference'],
      ['videoSource2', 'mediaReference2'],
    ] as const) {
      const previous = item[ref];
      if (
        expected
          ? previous?.packageId !== expected.packageId
          : findMediaPackageRoot(item[source] ?? '') !== oldRoot
      )
        continue;
      const mediaPath =
        previous?.mediaPath ??
        path.posix.relative(
          oldRoot.replace(/\\/g, '/'),
          (item[source] ?? '').replace(/\\/g, '/'),
        );
      updated[source] = resolvePackageMember(root, mediaPath);
      updated[ref] = { packageId: id, packagePath: root, mediaPath };
    }
    return updated;
  });
  // Do not commit partial relinks or silently replace originals with unrelated videos.
  for (const item of next) {
    for (const [source, ref] of [
      ['videoSource', 'mediaReference'],
      ['videoSource2', 'mediaReference2'],
    ] as const) {
      if (
        item[ref]?.packagePath === root &&
        !(await exists(item[source] ?? ''))
      )
        throw new Error('選択したパッケージに必要な映像がありません。');
    }
  }
  return resolvePlaylistMediaReferences(next, playlistPath);
};
