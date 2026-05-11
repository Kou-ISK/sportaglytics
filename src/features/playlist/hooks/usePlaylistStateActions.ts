import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  Playlist,
  PlaylistItem,
  PlaylistState,
} from '../../../types/playlist/core';
import type { TimelineData } from '../../../types/timeline/core';
import type { PlaylistStateActions } from './playlistCallbacks';

interface UsePlaylistStateActionsParams {
  setState: Dispatch<SetStateAction<PlaylistState>>;
}

export const usePlaylistStateActions = ({
  setState,
}: UsePlaylistStateActionsParams): PlaylistStateActions => {
  const createPlaylist = useCallback(
    (name: string, description?: string): Playlist => {
      const now = Date.now();
      const newPlaylist: Playlist = {
        id: uuidv4(),
        name,
        description,
        type: 'reference',
        items: [],
        createdAt: now,
        updatedAt: now,
      };
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
        memo: item.memo,
        addedAt: now,
        videoSource: videoPath || undefined,
        videoSource2: videoPath2 || undefined,
      }));

      setState((prev) => ({
        ...prev,
        playlists: prev.playlists.map((p) =>
          p.id === playlistId
            ? { ...p, items: [...p.items, ...newItems], updatedAt: now }
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
            ? { ...p, items: [...p.items, ...items], updatedAt: now }
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
            ? {
                ...p,
                items: p.items.filter((item) => item.id !== itemId),
                updatedAt: Date.now(),
              }
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
          const newItems = [...p.items];
          const [removed] = newItems.splice(fromIndex, 1);
          newItems.splice(toIndex, 0, removed);
          return { ...p, items: newItems, updatedAt: Date.now() };
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
  };
};
