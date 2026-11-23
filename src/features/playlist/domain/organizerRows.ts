import type { Playlist, PlaylistItem, PlaylistRow } from '../../../types/playlist/core';
import { normalizePlaylistDocument } from '../../../shared/playlist/playlistDocument';

export const organizerDocument = (items: PlaylistItem[], rows: PlaylistRow[]): Playlist =>
  normalizePlaylistDocument({
    id: 'playlist-window', name: '', type: 'reference', createdAt: 0, updatedAt: 0,
    items, rows,
  });

export interface OrganizerGroup {
  id: string;
  name: string;
  itemIds: string[];
}

/** Uses the supplied presentation sequence, including a selected subset. */
export const organizerGroups = (items: PlaylistItem[], rows: PlaylistRow[]): OrganizerGroup[] => {
  const document = organizerDocument(items, rows);
  const groups = (document.rows ?? []).map((row): OrganizerGroup => ({
    id: row.id, name: row.name, itemIds: [],
  }));
  const byId = new Map(groups.map((group) => [group.id, group]));
  for (const item of document.items) {
    if (item.rowId) byId.get(item.rowId)?.itemIds.push(item.id);
  }
  return groups;
};
