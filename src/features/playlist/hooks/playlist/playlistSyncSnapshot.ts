import type {
  ItemAnnotation,
  PlaylistItem,
  PlaylistType,
} from '../../../../types/playlist/core';
import type { PlaylistSyncData } from '../../../../types/playlist/window';
import {
  resolveViewModeForItems,
  resolveViewModeForSources,
} from '../../utils/viewMode';

export interface PlaylistSyncSnapshot {
  items: PlaylistItem[];
  playlistName: string;
  hasUnsavedChanges: boolean;
  itemAnnotations: Record<string, ItemAnnotation>;
  playlistType: PlaylistType;
  packagePath: string | null;
  videoSources: string[];
  viewMode: 'dual' | 'angle1';
}

export const extractItemAnnotations = (
  items: PlaylistItem[],
): Record<string, ItemAnnotation> => {
  const annotations: Record<string, ItemAnnotation> = {};
  for (const item of items) {
    if (item.annotation) {
      annotations[item.id] = item.annotation;
    }
  }
  return annotations;
};

export const buildPlaylistSyncSnapshot = (
  data: PlaylistSyncData,
): PlaylistSyncSnapshot | null => {
  const activePlaylist = data.state.playlists.find(
    (playlist) => playlist.id === data.state.activePlaylistId,
  );

  if (!activePlaylist) {
    return null;
  }

  const videoSources = data.videoSources ?? [];
  const viewMode =
    videoSources.length > 0
      ? resolveViewModeForSources(videoSources)
      : resolveViewModeForItems(activePlaylist.items, data.state.playingItemId);

  return {
    items: activePlaylist.items,
    playlistName: activePlaylist.name,
    hasUnsavedChanges: false,
    itemAnnotations: extractItemAnnotations(activePlaylist.items),
    playlistType: activePlaylist.type,
    packagePath: data.packagePath ?? activePlaylist.sourcePackagePath ?? null,
    videoSources,
    viewMode,
  };
};
