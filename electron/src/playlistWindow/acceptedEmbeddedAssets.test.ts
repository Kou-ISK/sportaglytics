import {
  mkdtemp,
  mkdir,
  writeFile,
  rm,
  readFile,
  link,
  symlink,
} from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import type { Playlist } from '../../../src/types/playlist/core';
import {
  captureAcceptedEmbeddedDocument,
  capturePlaylistSourceGuard,
  reusableEmbeddedAssets,
} from './acceptedEmbeddedAssets';
import { loadPlaylistFromPath, savePlaylistToPath } from './storage';
import {
  acceptedEmbeddedDocument,
  acceptPlaylistDocumentLoad,
  beginPlaylistDocumentLoad,
  resolvePlaylistDocumentLoad,
} from './documentLoad';
import type { PlaylistWindowInfo } from './state';

it('reuses only both unchanged Main-accepted angles and rejects source replacement', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'playlist-snapshot-'));
  try {
    const videos = path.join(root, 'videos');
    await mkdir(videos);
    const first = path.join(videos, 'one.mp4');
    const second = path.join(videos, 'two.mp4');
    await writeFile(first, 'first');
    await writeFile(second, 'second');
    const hardlink = path.join(root, 'hardlink.mp4');
    await link(second, hardlink);
    const playlist: Playlist = {
      id: 'synthetic',
      name: 'Synthetic',
      type: 'embedded',
      createdAt: 0,
      updatedAt: 0,
      items: [
        {
          id: 'item',
          timelineItemId: null,
          actionName: 'Synthetic',
          startTime: 1,
          endTime: 4,
          addedAt: 0,
          videoSource: first,
          videoSource2: second,
        },
      ],
    };
    const snapshot = await captureAcceptedEmbeddedDocument(root, playlist);
    const guard = capturePlaylistSourceGuard(playlist, root);
    expect(reusableEmbeddedAssets(snapshot, playlist).size).toBe(2);
    expect(
      reusableEmbeddedAssets(snapshot, {
        ...playlist,
        items: [{ ...playlist.items[0], startTime: 2 }],
      }).size,
    ).toBe(0);
    expect(
      reusableEmbeddedAssets(snapshot, {
        ...playlist,
        items: [{ ...playlist.items[0], videoSource2: undefined }],
      }).size,
    ).toBe(0);
    await writeFile(second, 'replacement bytes');
    expect(() => reusableEmbeddedAssets(snapshot, playlist)).toThrow(
      'PLAYLIST_MEDIA_SOURCE_CHANGED',
    );
    expect(() =>
      reusableEmbeddedAssets(snapshot, {
        ...playlist,
        items: [{ ...playlist.items[0], startTime: 2 }],
      }),
    ).toThrow('PLAYLIST_MEDIA_SOURCE_CHANGED');
    expect(() =>
      reusableEmbeddedAssets(snapshot, {
        ...playlist,
        items: [{ ...playlist.items[0], id: 'renamed' }],
      }),
    ).toThrow('PLAYLIST_MEDIA_SOURCE_CHANGED');
    expect(() =>
      reusableEmbeddedAssets(
        snapshot,
        {
          ...playlist,
          items: [
            {
              ...playlist.items[0],
              id: 'renamed',
              videoSource: './videos/two.mp4',
              videoSource2: undefined,
            },
          ],
        },
        root,
      ),
    ).toThrow('PLAYLIST_MEDIA_SOURCE_CHANGED');
    expect(() =>
      reusableEmbeddedAssets(
        snapshot,
        {
          ...playlist,
          items: [
            {
              ...playlist.items[0],
              id: 'renamed',
              videoSource: hardlink,
              videoSource2: undefined,
            },
          ],
        },
        root,
      ),
    ).toThrow('PLAYLIST_MEDIA_SOURCE_CHANGED');
    if (process.platform !== 'win32') {
      const alias = path.join(root, 'alias.mp4');
      await symlink(second, alias);
      expect(() =>
        reusableEmbeddedAssets(
          snapshot,
          {
            ...playlist,
            items: [
              {
                ...playlist.items[0],
                id: 'renamed',
                videoSource: alias,
                videoSource2: undefined,
              },
            ],
          },
          root,
        ),
      ).toThrow('PLAYLIST_MEDIA_SOURCE_CHANGED');
    }
    expect(guard).toThrow('PLAYLIST_MEDIA_SOURCE_CHANGED');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('retains accepted media and annotation on save and copies unchanged bytes on save as', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'playlist-reuse-'));
  try {
    const sourcePackage = path.join(root, 'source.stpl');
    const videos = path.join(sourcePackage, 'videos');
    await mkdir(videos, { recursive: true });
    const file = path.join(videos, 'original.mp4');
    await writeFile(file, 'synthetic already accepted bytes');
    const playlist: Playlist = {
      id: 'synthetic',
      name: 'Synthetic',
      type: 'embedded',
      createdAt: 0,
      updatedAt: 0,
      items: [
        {
          id: 'item',
          timelineItemId: null,
          actionName: 'Synthetic',
          startTime: 1,
          endTime: 4,
          addedAt: 0,
          videoSource: file,
          annotation: {
            freezeAt: 0,
            freezeDuration: 1,
            objects: [
              {
                id: 'mark',
                type: 'pen',
                color: '#fff',
                strokeWidth: 1,
                startX: 1,
                startY: 1,
                timestamp: 2,
              },
            ],
          },
        },
      ],
    };
    const snapshot = await captureAcceptedEmbeddedDocument(
      sourcePackage,
      playlist,
    );
    const info = {
      window: { isDestroyed: () => false },
      filePath: null,
    } as unknown as PlaylistWindowInfo;
    const first = beginPlaylistDocumentLoad(info);
    const second = beginPlaylistDocumentLoad(info);
    expect(
      resolvePlaylistDocumentLoad(info, first, sourcePackage, snapshot),
    ).toBe(false);
    expect(
      resolvePlaylistDocumentLoad(info, second, sourcePackage, snapshot),
    ).toBe(true);
    expect(acceptPlaylistDocumentLoad(info, second)).toBe(true);
    expect(acceptedEmbeddedDocument(info)).toBe(snapshot);
    const assets = reusableEmbeddedAssets(snapshot, playlist);
    const event = {
      sender: { isDestroyed: () => true },
    } as unknown as Electron.IpcMainInvokeEvent;
    await savePlaylistToPath(
      sourcePackage,
      playlist,
      event,
      '/unused',
      undefined,
      undefined,
      assets,
    );
    const saved = await loadPlaylistFromPath(sourcePackage);
    expect(saved.items[0].startTime).toBe(1);
    expect(saved.items[0].annotation?.objects[0].timestamp).toBe(2);
    expect(await readFile(file, 'utf8')).toBe(
      'synthetic already accepted bytes',
    );
    const other = path.join(root, 'copy.stpl');
    await savePlaylistToPath(
      other,
      playlist,
      event,
      '/unused',
      undefined,
      undefined,
      assets,
    );
    const copied = await loadPlaylistFromPath(other);
    expect(copied.items[0].videoSource).not.toBe(file);
    expect(await readFile(copied.items[0].videoSource ?? '', 'utf8')).toBe(
      'synthetic already accepted bytes',
    );
    expect(copied.items[0].annotation?.objects[0].timestamp).toBe(2);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
