import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadPlaylistFromPath, savePlaylistToPath } from './storage';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true })),
  );
});

const createTemporaryDirectory = async (): Promise<string> => {
  const directory = await fs.mkdtemp(
    path.join(os.tmpdir(), 'sportaglytics-playlist-'),
  );
  temporaryDirectories.push(directory);
  return directory;
};

describe('playlist package storage', () => {
  it('migrates legacy flat documents on load and preserves the order on save/load', async () => {
    const directory = await createTemporaryDirectory();
    await fs.writeFile(
      path.join(directory, 'playlist.json'),
      JSON.stringify({
        id: 'playlist-1',
        name: 'Legacy',
        type: 'reference',
        items: [
          {
            id: 'first',
            timelineItemId: null,
            actionName: 'A',
            memo: 'Source note',
            note: 'Playlist note',
            startTime: 0,
            endTime: 1,
            addedAt: 1,
          },
          {
            id: 'second',
            timelineItemId: null,
            actionName: 'B',
            startTime: 1,
            endTime: 2,
            addedAt: 1,
          },
        ],
        createdAt: 1,
        updatedAt: 1,
      }),
      'utf8',
    );

    const loaded = await loadPlaylistFromPath(directory);
    expect(loaded.schemaVersion).toBe(5);
    expect(loaded.items.map((item) => item.id)).toEqual(['first', 'second']);
    expect(loaded.rows).toHaveLength(1);
    expect(loaded.items[0].note).toBe('Playlist note\n\nSource note');
    expect(loaded.items[0]).not.toHaveProperty('memo');

    const event = {
      sender: { isDestroyed: () => true },
    } as unknown as Electron.IpcMainInvokeEvent;
    await savePlaylistToPath(directory, loaded, event, 'ffmpeg');
    const saved = await loadPlaylistFromPath(directory);
    expect(saved.items.map((item) => item.id)).toEqual(['first', 'second']);
    expect(saved.rows).toEqual(loaded.rows);
    expect(saved.items[0].note).toBe(loaded.items[0].note);
    expect(saved.items[0]).not.toHaveProperty('memo');
  });
});
