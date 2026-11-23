import { describe, expect, it } from 'vitest';
import type { Playlist } from '../../../src/types/playlist/core';
import { isPlaylist } from '../../../src/types/ipc/playlistWindow';
import { decodePlaylistFile, encodePlaylistFile } from './playlistDiskFormat';

const media: Playlist = {
  id: 'meeting', name: 'Meeting', type: 'reference', schemaVersion: 5,
  createdAt: 1, updatedAt: 1, items: [],
};
const meeting: Playlist = { ...media, items: [{
  id: 's', timelineItemId: null, actionName: 'Slide', startTime: 0,
  endTime: 3, addedAt: 1, slide: { title: 'Title', body: 'Body' },
}] };

describe('playlist disk format', () => {
  it('keeps the established flat format until a slide exists', () => {
    expect(encodePlaylistFile(media)).toBe(media);
    expect(decodePlaylistFile(media)).toBe(media);
    const file = encodePlaylistFile(meeting);
    expect(isPlaylist(file)).toBe(false);
    expect(decodePlaylistFile(file)).toBe(meeting);
    expect(encodePlaylistFile({ ...meeting, items: [] })).not.toHaveProperty('document');
  });

  it('rejects unknown versions and ambiguous or incomplete files', () => {
    const file = encodePlaylistFile(meeting);
    for (const invalid of [
      { ...file, schemaVersion: 7 }, { ...file, format: 'unknown' },
      { ...file, items: [] }, { ...file, document: null },
      { ...file, document: { ...meeting, schemaVersion: 99 } },
      { ...media, schemaVersion: 99 },
    ]) expect(() => decodePlaylistFile(invalid)).toThrow();
  });
});
