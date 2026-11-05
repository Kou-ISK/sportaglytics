import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import type { Playlist } from '../../../src/types/playlist/core';
import type { PlaylistWindowInfo } from './state';
import {
  beginPlaylistDocumentLoad,
  playlistDocumentRevision,
} from './documentLoad';
import { capturePlaylistSaveSnapshot } from './playlistSaveSnapshot';
import { writeTextFileAtomically } from '../ipc/atomicTextFile';

it('rejects a document change or source replacement before manifest publication', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'playlist-save-guard-'));
  try {
    const source = path.join(root, 'source.mp4');
    await writeFile(source, 'synthetic original');
    const info = {
      window: { isDestroyed: () => false },
      filePath: null,
    } as unknown as PlaylistWindowInfo;
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
          startTime: 0,
          endTime: 2,
          addedAt: 0,
          videoSource: source,
        },
      ],
    };
    const revision = playlistDocumentRevision(info);
    const first = capturePlaylistSaveSnapshot(info, playlist, revision, root);
    beginPlaylistDocumentLoad(info);
    expect(first.assertCurrent).toThrow('PLAYLIST_SAVE_SNAPSHOT_CHANGED');
    const second = capturePlaylistSaveSnapshot(
      info,
      playlist,
      playlistDocumentRevision(info),
      root,
    );
    await writeFile(source, 'synthetic replaced content');
    expect(second.assertCurrent).toThrow('PLAYLIST_MEDIA_SOURCE_CHANGED');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it.each(['existing', 'absent'])(
  'prevents two windows from replacing the same %s target',
  async (initial) => {
    const root = await mkdtemp(path.join(tmpdir(), 'playlist-save-cas-'));
    try {
      const file = path.join(root, 'playlist.json');
      if (initial === 'existing') await writeFile(file, 'original');
      const info = (): PlaylistWindowInfo =>
        ({
          window: { isDestroyed: () => false },
          filePath: null,
        }) as unknown as PlaylistWindowInfo;
      const firstWindow = info(),
        secondWindow = info();
      const playlist: Playlist = {
        id: 'synthetic',
        name: 'Synthetic',
        type: 'reference',
        items: [],
        createdAt: 0,
        updatedAt: 0,
      };
      const first = capturePlaylistSaveSnapshot(firstWindow, playlist, 0, root);
      const second = capturePlaylistSaveSnapshot(
        secondWindow,
        playlist,
        0,
        root,
      );
      const write = (contents: string, snapshot: typeof first): Promise<void> =>
        writeTextFileAtomically(
          file,
          contents,
          async () => snapshot.assertCurrent(),
          snapshot.assertCurrent,
        );
      const results = await Promise.allSettled([
        write('first', first),
        write('second', second),
      ]);
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      if (results[1].status === 'rejected')
        expect(String(results[1].reason)).toContain(
          'PLAYLIST_SAVE_TARGET_CHANGED',
        );
      expect(await readFile(file, 'utf8')).toBe('first');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);
