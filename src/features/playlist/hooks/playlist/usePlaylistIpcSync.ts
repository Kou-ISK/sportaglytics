import { useEffect } from 'react';
import type {
  ItemAnnotation,
  PlaylistItem,
  PlaylistSyncData,
  PlaylistType,
} from '../../../../types/Playlist';
import {
  resolveViewModeForItems,
  resolveViewModeForSources,
} from '../../utils/viewMode';

interface UsePlaylistIpcSyncParams {
  setItemsWithHistory: React.Dispatch<React.SetStateAction<PlaylistItem[]>>;
  setPlaylistName: React.Dispatch<React.SetStateAction<string>>;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  setItemAnnotations: React.Dispatch<
    React.SetStateAction<Record<string, ItemAnnotation>>
  >;
  setPlaylistType: React.Dispatch<React.SetStateAction<PlaylistType>>;
  setPackagePath: React.Dispatch<React.SetStateAction<string | null>>;
  setVideoSources: React.Dispatch<React.SetStateAction<string[]>>;
  setViewMode: React.Dispatch<
    React.SetStateAction<'dual' | 'angle1' | 'angle2'>
  >;
  setSaveProgress: React.Dispatch<
    React.SetStateAction<{ current: number; total: number } | null>
  >;
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>;
}

export const usePlaylistIpcSync = ({
  setItemsWithHistory,
  setPlaylistName,
  setHasUnsavedChanges,
  setItemAnnotations,
  setPlaylistType,
  setPackagePath,
  setVideoSources,
  setViewMode,
  setSaveProgress,
  setIsDirty,
}: UsePlaylistIpcSyncParams) => {
  useEffect(() => {
    const playlistAPI = window.electronAPI?.playlist;
    if (!playlistAPI) {
      console.debug('[PlaylistWindow] playlist API unavailable for IPC sync');
      return;
    }

    const handlePlaylistSync = (data: PlaylistSyncData) => {
      console.log('[PlaylistWindow] Received sync data:', data);
      const activePlaylist = data.state.playlists.find(
        (p) => p.id === data.state.activePlaylistId,
      );
      if (activePlaylist) {
        // ファイル読み込み時は履歴に追加しない（usePlaylistHistoryが自動処理）
        setItemsWithHistory(activePlaylist.items);
        setPlaylistName(activePlaylist.name);
        setHasUnsavedChanges(false);
        // Load annotations from items
        const annotations: Record<string, ItemAnnotation> = {};
        for (const item of activePlaylist.items) {
          if (item.annotation) {
            annotations[item.id] = item.annotation;
          }
        }
        setItemAnnotations(annotations);
        setPlaylistType(activePlaylist.type);
        setPackagePath(activePlaylist.packagePath || null);
        setVideoSources(activePlaylist.videoSources || []);

        const hasEmbeddedSources = (data.videoSources || []).length > 0;
        if (hasEmbeddedSources) {
          setViewMode(resolveViewModeForSources(data.videoSources));
        } else {
          setViewMode(
            resolveViewModeForItems(
              activePlaylist.items,
              data.state.playingItemId,
            ),
          );
        }
      }
    };

    const handleSaveProgress = (data: { current: number; total: number }) => {
      setSaveProgress(data);
    };

    const handleAddItem = (item: PlaylistItem) => {
      setItemsWithHistory((prev: PlaylistItem[]) => [...prev, item]);
      setHasUnsavedChanges(true);
      setIsDirty(true);
    };

    let unsubscribeSaveProgress: (() => void) | undefined;
    try {
      playlistAPI.onSync(handlePlaylistSync);
      unsubscribeSaveProgress = playlistAPI.onSaveProgress(handleSaveProgress);
      playlistAPI.onAddItem(handleAddItem);
      playlistAPI.sendCommand({ type: 'request-sync' });
    } catch (error: unknown) {
      console.debug(
        '[PlaylistWindow] Failed to register playlist IPC handlers',
        error,
      );
    }

    return () => {
      try {
        playlistAPI.offSync(handlePlaylistSync);
        playlistAPI.offAddItem(handleAddItem);
        unsubscribeSaveProgress?.();
      } catch (error: unknown) {
        console.debug(
          '[PlaylistWindow] Failed to cleanup playlist IPC handlers',
          error,
        );
      }
    };
  }, [
    setHasUnsavedChanges,
    setIsDirty,
    setItemAnnotations,
    setItemsWithHistory,
    setPackagePath,
    setPlaylistName,
    setPlaylistType,
    setSaveProgress,
    setVideoSources,
    setViewMode,
  ]);
};
