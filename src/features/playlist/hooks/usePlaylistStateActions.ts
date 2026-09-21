import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  Playlist,
  PlaylistItem,
  PlaylistState,
} from '../../../types/playlist/core';
import type { TimelineData } from '../../../types/timeline/core';
import type { PlaylistStateActions } from './playlistCallbacks';
import {
  createPlaylistRow,
  moveItemsToRow as moveItemsToRowDomain,
  normalizePlaylistDocument,
  renamePlaylistRow,
  reorderItemsWithinRow as reorderItemsWithinRowDomain,
  reorderPlaylistRows,
} from '../../../shared/playlist/playlistDocument';

interface UsePlaylistStateActionsParams {
  setState: Dispatch<SetStateAction<PlaylistState>>;
}

export const usePlaylistStateActions = ({
  setState,
}: UsePlaylistStateActionsParams): PlaylistStateActions => {
  const createPlaylist = useCallback(
    (name: string, description?: string): Playlist => {
      const now = Date.now();
      const newPlaylist: Playlist = normalizePlaylistDocument({
        id: uuidv4(),
        name,
        description,
        type: 'reference',
        items: [],
        createdAt: now,
        updatedAt: now,
      });
      setState((prev) => ({
        ...prev,
        playlists: [...prev.playlists, newPlaylist],
        activePlaylistId: newPlaylist.id,
      }));
      return newPlaylist;
    },
    [setState],
  );

  const deletePlaylist = useCallback(
    (playlistId: string) => {
      setState((prev) => ({
        ...prev,
        playlists: prev.playlists.filter((p) => p.id !== playlistId),
        activePlaylistId:
          prev.activePlaylistId === playlistId ? null : prev.activePlaylistId,
      }));
    },
    [setState],
  );

  const updatePlaylistName = useCallback(
    (playlistId: string, name: string) => {
      setState((prev) => ({
        ...prev,
        playlists: prev.playlists.map((p) =>
          p.id === playlistId ? { ...p, name, updatedAt: Date.now() } : p,
        ),
      }));
    },
    [setState],
  );

  const setActivePlaylist = useCallback(
    (playlistId: string | null) => {
      setState((prev) => ({ ...prev, activePlaylistId: playlistId }));
    },
    [setState],
  );

  const addItemsFromTimeline = useCallback(
    (
      playlistId: string,
      items: TimelineData[],
      videoPath?: string | null,
      videoPath2?: string | null,
    ) => {
      const now = Date.now();
      const newItems: PlaylistItem[] = items.map((item) => ({
        id: uuidv4(),
        timelineItemId: item.id,
        actionName: item.actionName,
        startTime: item.startTime,
        endTime: item.endTime,
        labels: item.labels,
        note: item.memo,
        addedAt: now,
        videoSource: videoPath || undefined,
        videoSource2: videoPath2 || undefined,
      }));

      setState((prev) => ({
        ...prev,
        playlists: prev.playlists.map((p) =>
          p.id === playlistId
            ? normalizePlaylistDocument({
                ...p,
                items: [...p.items, ...newItems],
                updatedAt: now,
              })
            : p,
        ),
      }));
    },
    [setState],
  );

  const addItems = useCallback(
    (playlistId: string, items: PlaylistItem[]) => {
      if (items.length === 0) return;
      const now = Date.now();
      setState((prev) => ({
        ...prev,
        playlists: prev.playlists.map((p) =>
          p.id === playlistId
            ? normalizePlaylistDocument({
                ...p,
                items: [...p.items, ...items],
                updatedAt: now,
              })
            : p,
        ),
      }));
    },
    [setState],
  );

  const removeItem = useCallback(
    (playlistId: string, itemId: string) => {
      setState((prev) => ({
        ...prev,
        playlists: prev.playlists.map((p) =>
          p.id === playlistId
            ? normalizePlaylistDocument({
                ...p,
                items: p.items.filter((item) => item.id !== itemId),
                updatedAt: Date.now(),
              })
            : p,
        ),
        playingItemId:
          prev.playingItemId === itemId ? null : prev.playingItemId,
      }));
    },
    [setState],
  );

  const reorderItems = useCallback(
    (playlistId: string, fromIndex: number, toIndex: number) => {
      setState((prev) => ({
        ...prev,
        playlists: prev.playlists.map((p) => {
          if (p.id !== playlistId) return p;
          const normalized = normalizePlaylistDocument(p);
          const rowId = normalized.rows?.[0]?.id;
          if (!rowId) return normalized;
          return {
            ...reorderItemsWithinRowDomain(normalized, rowId, fromIndex, toIndex),
            updatedAt: Date.now(),
          };
        }),
      }));
    },
    [setState],
  );

  const updateItemNote = useCallback(
    (playlistId: string, itemId: string, note: string) => {
      setState((prev) => ({
        ...prev,
        playlists: prev.playlists.map((p) =>
          p.id === playlistId
            ? {
                ...p,
                items: p.items.map((item) =>
                  item.id === itemId ? { ...item, note } : item,
                ),
                updatedAt: Date.now(),
              }
            : p,
        ),
      }));
    },
    [setState],
  );

  const createRow = useCallback(
    (playlistId: string, name: string, color?: string): void => {
      setState((prev) => ({
        ...prev,
        playlists: prev.playlists.map((playlist) => {
          if (playlist.id !== playlistId) return playlist;
          const normalized = normalizePlaylistDocument(playlist);
          const row = createPlaylistRow(normalized, name, {
            enabled: true,
            ...(color ? { color } : {}),
          });
          return { ...normalized, rows: [...(normalized.rows ?? []), row], updatedAt: Date.now() };
        }),
      }));
    },
    [setState],
  );

  const renameRow = useCallback(
    (playlistId: string, rowId: string, name: string): void => {
      setState((prev) => ({
        ...prev,
        playlists: prev.playlists.map((playlist) =>
          playlist.id === playlistId
            ? { ...renamePlaylistRow(playlist, rowId, name), updatedAt: Date.now() }
            : playlist,
        ),
      }));
    },
    [setState],
  );

  const reorderRow = useCallback(
    (playlistId: string, fromIndex: number, toIndex: number): void => {
      setState((prev) => ({
        ...prev,
        playlists: prev.playlists.map((playlist) =>
          playlist.id === playlistId
            ? { ...reorderPlaylistRows(playlist, fromIndex, toIndex), updatedAt: Date.now() }
            : playlist,
        ),
      }));
    },
    [setState],
  );

  const moveItemsToRow = useCallback(
    (playlistId: string, itemIds: string[], rowId: string): void => {
      setState((prev) => ({
        ...prev,
        playlists: prev.playlists.map((playlist) =>
          playlist.id === playlistId
            ? { ...moveItemsToRowDomain(playlist, itemIds, rowId), updatedAt: Date.now() }
            : playlist,
        ),
      }));
    },
    [setState],
  );

  const reorderItemsWithinRow = useCallback(
    (playlistId: string, rowId: string, fromIndex: number, toIndex: number): void => {
      setState((prev) => ({
        ...prev,
        playlists: prev.playlists.map((playlist) =>
          playlist.id === playlistId
            ? { ...reorderItemsWithinRowDomain(playlist, rowId, fromIndex, toIndex), updatedAt: Date.now() }
            : playlist,
        ),
      }));
    },
    [setState],
  );

  const setLoopMode = useCallback(
    (mode: 'none' | 'single' | 'all') => {
      setState((prev) => ({ ...prev, loopMode: mode }));
    },
    [setState],
  );

  const setPlayingItem = useCallback(
    (itemId: string | null) => {
      setState((prev) => ({ ...prev, playingItemId: itemId }));
    },
    [setState],
  );

  return {
    createPlaylist,
    deletePlaylist,
    updatePlaylistName,
    setActivePlaylist,
    addItemsFromTimeline,
    addItems,
    removeItem,
    reorderItems,
    updateItemNote,
    setLoopMode,
    setPlayingItem,
    createRow,
    renameRow,
    reorderRow,
    moveItemsToRow,
    reorderItemsWithinRow,
  };
};
