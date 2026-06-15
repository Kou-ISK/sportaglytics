import type { Playlist, PlaylistItem } from '../../../types/playlist/core';
import type { TimelineData } from '../../../types/timeline/core';

export type SeekCallback = (time: number) => void;
export type PlayItemCallback = (item: PlaylistItem) => void;

export interface PlaylistStateActions {
  createPlaylist: (name: string, description?: string) => Playlist;
  deletePlaylist: (playlistId: string) => void;
  updatePlaylistName: (playlistId: string, name: string) => void;
  setActivePlaylist: (playlistId: string | null) => void;
  addItemsFromTimeline: (
    playlistId: string,
    items: TimelineData[],
    videoPath?: string | null,
    videoPath2?: string | null,
  ) => void;
  addItems: (playlistId: string, items: PlaylistItem[]) => void;
  removeItem: (playlistId: string, itemId: string) => void;
  reorderItems: (
    playlistId: string,
    fromIndex: number,
    toIndex: number,
  ) => void;
  updateItemNote: (playlistId: string, itemId: string, note: string) => void;
  setLoopMode: (mode: 'none' | 'single' | 'all') => void;
  setPlayingItem: (itemId: string | null) => void;
}
