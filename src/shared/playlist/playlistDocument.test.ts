import { describe, expect, it } from 'vitest';
import type { Playlist } from '../../types/playlist/core';
import {
  getPresentationItems,
  moveItemsToRow,
  normalizePlaylistDocument,
  reorderItemsWithinRow,
} from './playlistDocument';

const legacyPlaylist = (): Playlist => ({
  id: 'playlist-1',
  name: 'Legacy',
  type: 'reference',
  items: [
    {
      id: 'a',
      timelineItemId: null,
      actionName: 'A',
      startTime: 0,
      endTime: 1,
      addedAt: 1,
    },
    {
      id: 'b',
      timelineItemId: null,
      actionName: 'B',
      startTime: 1,
      endTime: 2,
      addedAt: 1,
    },
  ],
  createdAt: 1,
  updatedAt: 1,
});

describe('playlist document model', () => {
  it('migrates a flat legacy playlist without changing item order', () => {
    const migrated = normalizePlaylistDocument(legacyPlaylist());

    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.rows).toHaveLength(1);
    expect(migrated.items.map((item) => item.id)).toEqual(['a', 'b']);
    expect(migrated.items.map((item) => item.rowOrder)).toEqual([0, 1]);
  });

  it('is idempotent and keeps row presentation order separate from source order', () => {
    const playlist = normalizePlaylistDocument({
      ...legacyPlaylist(),
      rows: [
        { id: 'second', name: 'Second', enabled: true, order: 1 },
        { id: 'first', name: 'First', enabled: true, order: 0 },
      ],
      items: [
        { ...legacyPlaylist().items[0], rowId: 'second', rowOrder: 0 },
        { ...legacyPlaylist().items[1], rowId: 'first', rowOrder: 0 },
      ],
    });

    expect(normalizePlaylistDocument(playlist)).toEqual(playlist);
    expect(getPresentationItems(playlist).map((item) => item.id)).toEqual([
      'b',
      'a',
    ]);
  });

  it('moves and reorders items without changing sorter/source metadata', () => {
    const playlist = normalizePlaylistDocument(legacyPlaylist());
    const secondRow = { id: 'second', name: 'Second', enabled: true, order: 1 };
    const withRow = normalizePlaylistDocument({
      ...playlist,
      rows: [...(playlist.rows ?? []), secondRow],
    });
    const moved = moveItemsToRow(withRow, ['a'], 'second');
    const reordered = reorderItemsWithinRow(moved, 'second', 0, 0);

    expect(reordered.items.find((item) => item.id === 'a')?.rowId).toBe(
      'second',
    );
    expect(getPresentationItems(reordered).map((item) => item.id)).toEqual([
      'b',
      'a',
    ]);
  });
});
