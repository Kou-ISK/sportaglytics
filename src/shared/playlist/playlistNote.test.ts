import { describe, expect, it } from 'vitest';
import { normalizePlaylistNote } from './playlistNote';
import type { PlaylistItem } from '../../types/playlist/core';

const base: PlaylistItem = {
  id: 'a',
  timelineItemId: null,
  actionName: 'Scrum',
  startTime: 0,
  endTime: 2,
  addedAt: 0,
};
describe('legacy playlist notes', () => {
  it.each([
    { memo: 'source', expected: 'source' },
    { note: 'edited', memo: 'source', expected: 'edited\n\nsource' },
    { note: 'same', memo: 'same', expected: 'same' },
    { note: '', memo: 'source', expected: 'source' },
    { note: 'edited', memo: '', expected: 'edited' },
  ])(
    'preserves distinct text and removes the legacy field: $expected',
    ({ expected, ...fields }) => {
      const original = { ...base, ...fields };
      const result = normalizePlaylistNote(original);
      expect(result.note).toBe(expected);
      expect(result).not.toHaveProperty('memo');
      expect(normalizePlaylistNote(result)).toEqual(result);
      expect(original).toHaveProperty('memo');
    },
  );
  it('keeps an intentionally cleared canonical note empty', () => {
    expect(normalizePlaylistNote({ ...base, note: '' }).note).toBe('');
  });
});
