import { editPlaylistSlide } from '../../../../shared/playlist/editPlaylistSlide';
import { useMemo } from 'react';
import type { Playlist } from '../../../../types/playlist/core';
import {
  createPlaylistRow, moveItemsToRow, removePlaylistRow, renamePlaylistRow, reorderPlaylistRows,
} from '../../../../shared/playlist/playlistDocument';
import { organizerDocument } from '../../domain/organizerRows';
import type { OrganizerActions } from '../../components/OrganizerRowControls';
import type { PlaylistWindowDataRuntime } from './usePlaylistWindowDataRuntime';

export const useOrganizerRows = (
  { core, history, selection, exportState }: Pick<PlaylistWindowDataRuntime, 'core' | 'history' | 'selection' | 'exportState'>,
  play: (ids: readonly string[]) => void,
): { document: Playlist; actions: OrganizerActions } => {
  const document = useMemo(() => organizerDocument(history.items, core.playlistRows), [history.items, core.playlistRows]);
  const edit = (next: Playlist): void => {
    if (document === next || !next.rows) return;
    history.setDocument(next.items, next.rows);
    core.setHasUnsavedChanges(true);
  };
  return { document, actions: {
    saveSlide: (placement, slide, seconds) => {
      const next = editPlaylistSlide(document, placement, slide, seconds);
      const playingId = history.items[core.currentIndex]?.id;
      edit(next);
      if (playingId && next !== document) core.setCurrentIndex(next.items.findIndex((item) => item.id === playingId));
    },
    add: (name) => {
      const value = name.trim();
      if (value) edit({ ...document, rows: [...(document.rows ?? []), createPlaylistRow(document, value)] });
    },
    rename: (id, name) => edit(renamePlaylistRow(document, id, name)),
    remove: (id) => edit(removePlaylistRow(document, id)),
    reposition: (id, delta) => {
      const index = document.rows?.findIndex((row) => row.id === id) ?? -1;
      edit(reorderPlaylistRows(document, index, index + delta));
    },
    moveClips: (ids, rowId) => edit(moveItemsToRow(document, ids, rowId)),
    play,
    export: (ids) => {
      selection.setSelectedItemIds(new Set(ids));
      exportState.setExportMode('organizerRows');
      exportState.setExportScope('selected');
      exportState.setExportDialogOpen(true);
    },
  } };
};
