import * as fs from 'node:fs/promises';
import * as fsSync from 'node:fs';
import * as path from 'node:path';
import type { Playlist, PlaylistItem } from '../../../src/types/playlist/core';

interface Asset {
  source: string;
  realPath: string;
  fingerprint: string;
}

export interface AcceptedEmbeddedDocument {
  readonly packagePath: string;
  readonly items: readonly PlaylistItem[];
  readonly assets: ReadonlyMap<string, Asset>;
}

const fingerprint = (file: string): string => {
  const stat = fsSync.statSync(file, { bigint: true });
  if (!stat.isFile()) throw Error('PLAYLIST_MEDIA_SOURCE_CHANGED');
  return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
};
const itemCounts = (items: readonly PlaylistItem[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  return counts;
};

/** Snapshot only media within the package actually read by Main. Missing or
 * external media is never promoted to a reusable package asset. */
export const captureAcceptedEmbeddedDocument = async (
  packagePath: string,
  playlist: Playlist,
): Promise<AcceptedEmbeddedDocument | null> => {
  if (playlist.type !== 'embedded') return null;
  const items = structuredClone(playlist.items);
  const assets = new Map<string, Asset>();
  let root: string;
  try {
    const videos = path.join(packagePath, 'videos');
    const stat = await fs.lstat(videos);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      return { packagePath, items, assets };
    root = await fs.realpath(videos);
    if (root !== path.join(await fs.realpath(packagePath), 'videos'))
      return { packagePath, items, assets };
  } catch {
    return { packagePath, items, assets };
  }
  const counts = itemCounts(items);
  for (const item of items) {
    if (counts.get(item.id) !== 1) continue;
    for (const [angle, source] of [
      ['angle1', item.videoSource],
      ['angle2', item.videoSource2],
    ] as const) {
      if (!source || !path.isAbsolute(source)) continue;
      try {
        const lst = await fs.lstat(source);
        if (!lst.isFile() || lst.isSymbolicLink()) continue;
        const realPath = await fs.realpath(source);
        const relative = path.relative(root, realPath);
        if (
          !relative ||
          relative === '..' ||
          relative.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relative)
        )
          continue;
        assets.set(`${item.id}:${angle}`, {
          source,
          realPath,
          fingerprint: fingerprint(realPath),
        });
      } catch {
        /* Missing media remains unavailable, not trusted for reuse. */
      }
    }
  }
  return { packagePath, items, assets };
};

/** Both angles and their range must still match the Main-accepted snapshot. */
export const reusableEmbeddedAssets = (
  accepted: AcceptedEmbeddedDocument | null,
  playlist: Playlist,
  basePath: string = accepted?.packagePath ?? '.',
): Map<string, string> => {
  const result = new Map<string, string>();
  if (!accepted || playlist.type !== 'embedded') return result;
  const currentCounts = itemCounts(playlist.items);
  const priorCounts = itemCounts(accepted.items);
  const previous = new Map(accepted.items.map((item) => [item.id, item]));
  const acceptedBySource = new Map<string, Asset[]>();
  const acceptedByIdentity = new Map<string, Asset[]>();
  for (const asset of accepted.assets.values()) {
    for (const key of new Set([path.resolve(asset.source), asset.realPath])) {
      const known = acceptedBySource.get(key) ?? [];
      known.push(asset);
      acceptedBySource.set(key, known);
    }
    const identity = asset.fingerprint.split(':', 2).join(':');
    const known = acceptedByIdentity.get(identity) ?? [];
    known.push(asset);
    acceptedByIdentity.set(identity, known);
  }
  for (const item of playlist.items) {
    // A changed item ID or range must not make replacement of a previously
    // accepted physical source appear to be a new, trustworthy source.
    for (const source of [item.videoSource, item.videoSource2]) {
      if (!source) continue;
      const file = path.isAbsolute(source)
        ? path.resolve(source)
        : path.resolve(basePath, source);
      let realPath: string | null = null;
      let observedFingerprint: string | null = null;
      try {
        realPath = fsSync.realpathSync(file);
        observedFingerprint = fingerprint(realPath);
      } catch {
        /* checked below if previously accepted */
      }
      const known = new Set([
        ...(acceptedBySource.get(file) ?? []),
        ...(realPath ? (acceptedBySource.get(realPath) ?? []) : []),
        ...(observedFingerprint
          ? (acceptedByIdentity.get(
              observedFingerprint.split(':', 2).join(':'),
            ) ?? [])
          : []),
      ]);
      for (const asset of known) {
        try {
          if (
            observedFingerprint === asset.fingerprint &&
            fingerprint(asset.realPath) === asset.fingerprint
          )
            continue;
        } catch {
          /* missing or replaced accepted source */
        }
        throw Error('PLAYLIST_MEDIA_SOURCE_CHANGED');
      }
    }
    if (currentCounts.get(item.id) !== 1 || priorCounts.get(item.id) !== 1)
      continue;
    const prior = previous.get(item.id);
    if (
      !prior ||
      prior.startTime !== item.startTime ||
      prior.endTime !== item.endTime
    )
      continue;
    const selected = new Map<string, string>();
    let valid = true;
    for (const [angle, source, previous] of [
      ['angle1', item.videoSource, prior.videoSource],
      ['angle2', item.videoSource2, prior.videoSource2],
    ] as const) {
      if (!source && !previous) continue;
      const asset = accepted.assets.get(`${item.id}:${angle}`);
      if (!source || source !== previous || !asset || asset.source !== source) {
        valid = false;
        break;
      }
      selected.set(`${item.id}:${angle}`, asset.realPath);
    }
    if (valid && selected.has(`${item.id}:angle1`))
      for (const [key, file] of selected) result.set(key, file);
  }
  return result;
};

/** Capture all actual sources before processing and reject replacement before
 * the manifest rename. No media bytes are copied into diagnostic logs. */
export const capturePlaylistSourceGuard = (
  playlist: Playlist,
  base: string,
): (() => void) => {
  const sources = new Map<string, { realPath: string; fingerprint: string }>();
  for (const item of playlist.items) {
    for (const source of [item.videoSource, item.videoSource2]) {
      if (!source) continue;
      const file = path.isAbsolute(source)
        ? source
        : path.resolve(base, source);
      const realPath = fsSync.realpathSync(file);
      sources.set(file, { realPath, fingerprint: fingerprint(realPath) });
    }
  }
  return () => {
    for (const [file, value] of sources) {
      if (
        fsSync.realpathSync(file) !== value.realPath ||
        fingerprint(value.realPath) !== value.fingerprint
      )
        throw Error('PLAYLIST_MEDIA_SOURCE_CHANGED');
    }
  };
};
