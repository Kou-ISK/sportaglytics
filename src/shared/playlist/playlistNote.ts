import type { PlaylistItem } from '../../types/playlist/core';

/** Read legacy memo only at the document boundary; preserve distinct text. */
export const normalizePlaylistNote = (item: PlaylistItem): PlaylistItem => {
  if (!('memo' in item)) return item;
  const { memo, ...current } = item;
  if (typeof memo !== 'string' || !memo.trim()) return current;
  const note = current.note ?? '';
  return {
    ...current,
    note: !note.trim()
      ? memo
      : note.trim() === memo.trim()
        ? note
        : `${note}\n\n${memo}`,
  };
};
