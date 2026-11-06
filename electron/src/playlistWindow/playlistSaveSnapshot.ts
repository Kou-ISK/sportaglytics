import type { Playlist } from '../../../src/types/playlist/core';
import type { PlaylistWindowInfo } from './state';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  acceptedEmbeddedDocument,
  playlistDocumentRevision,
} from './documentLoad';
import {
  capturePlaylistSourceGuard,
  reusableEmbeddedAssets,
} from './acceptedEmbeddedAssets';

const targetFingerprint = (file: string): string | null => {
  try {
    const stat = fs.lstatSync(file, { bigint: true });
    if (!stat.isFile() || stat.isSymbolicLink())
      throw Error('PLAYLIST_SAVE_TARGET_INVALID');
    return `${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeNs}:${stat.ctimeNs}`;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
      return null;
    throw error;
  }
};

/** Main-owned document generation and source identities must still match in
 * the same event-loop turn in which the completed manifest is published. */
export const capturePlaylistSaveSnapshot = (
  info: PlaylistWindowInfo,
  playlist: Playlist,
  revision: number,
  basePath: string,
  targetPath: string = basePath,
): { reusableAssets: Map<string, string>; assertCurrent: () => void } => {
  const accepted = acceptedEmbeddedDocument(info);
  const target = path.join(targetPath, 'playlist.json');
  const targetAtStart = targetFingerprint(target);
  const assertSources =
    playlist.type === 'embedded'
      ? capturePlaylistSourceGuard(playlist, basePath)
      : (): void => undefined;
  const reusableAssets = reusableEmbeddedAssets(accepted, playlist, basePath);
  const assertCurrent = (): void => {
    if (
      info.window.isDestroyed() ||
      playlistDocumentRevision(info) !== revision ||
      acceptedEmbeddedDocument(info) !== accepted
    )
      throw Error('PLAYLIST_SAVE_SNAPSHOT_CHANGED');
    if (targetFingerprint(target) !== targetAtStart)
      throw Error('PLAYLIST_SAVE_TARGET_CHANGED');
    assertSources();
  };
  assertCurrent();
  return { reusableAssets, assertCurrent };
};
