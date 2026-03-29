import { useCallback, useEffect } from 'react';
import type {
  ItemAnnotation,
  PlaylistItem,
  PlaylistType,
} from '../../../../types/Playlist';
import {
  loadPlaylistFile,
  subscribePlaylistExternalOpen,
} from '../../gateway/playlistWindowGateway';
import { buildLoadedPlaylistSnapshot } from '../../utils/playlistFileState';

interface UsePlaylistLoaderParams {
  setItemsWithHistory: React.Dispatch<React.SetStateAction<PlaylistItem[]>>;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  setPlaylistName: React.Dispatch<React.SetStateAction<string>>;
  setPlaylistType: React.Dispatch<React.SetStateAction<PlaylistType>>;
  setPackagePath: React.Dispatch<React.SetStateAction<string | null>>;
  setLoadedFilePath: React.Dispatch<React.SetStateAction<string | null>>;
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>;
  setItemAnnotations: React.Dispatch<
    React.SetStateAction<Record<string, ItemAnnotation>>
  >;
  setVideoSources: React.Dispatch<React.SetStateAction<string[]>>;
  setViewMode: React.Dispatch<
    React.SetStateAction<'dual' | 'angle1' | 'angle2'>
  >;
  setCurrentIndex: React.Dispatch<React.SetStateAction<number>>;
}

interface UsePlaylistLoaderResult {
  loadPlaylistFromPath: (filePath?: string) => Promise<void>;
}

export const usePlaylistLoader = ({
  setItemsWithHistory,
  setHasUnsavedChanges,
  setPlaylistName,
  setPlaylistType,
  setPackagePath,
  setLoadedFilePath,
  setIsDirty,
  setItemAnnotations,
  setVideoSources,
  setViewMode,
  setCurrentIndex,
}: UsePlaylistLoaderParams): UsePlaylistLoaderResult => {
  const loadPlaylistFromPath = useCallback(
    async (filePath?: string): Promise<void> => {
      const loaded = await loadPlaylistFile(filePath);
      if (!loaded) return;

      const snapshot = buildLoadedPlaylistSnapshot(
        loaded.playlist,
        loaded.filePath,
      );

      setItemsWithHistory(snapshot.items);
      setHasUnsavedChanges(snapshot.hasUnsavedChanges);
      setPlaylistName(snapshot.playlistName);
      setPlaylistType(snapshot.playlistType);
      setPackagePath(snapshot.packagePath);
      setLoadedFilePath(snapshot.loadedFilePath);
      setIsDirty(snapshot.isDirty);
      setItemAnnotations(snapshot.itemAnnotations);
      setVideoSources(snapshot.videoSources);
      setViewMode(snapshot.viewMode);
      setCurrentIndex(snapshot.currentIndex);
    },
    [
      setCurrentIndex,
      setHasUnsavedChanges,
      setIsDirty,
      setItemAnnotations,
      setItemsWithHistory,
      setLoadedFilePath,
      setPackagePath,
      setPlaylistName,
      setPlaylistType,
      setVideoSources,
      setViewMode,
    ],
  );

  useEffect(() => {
    return subscribePlaylistExternalOpen((filePath: string) => {
      void loadPlaylistFromPath(filePath);
    });
  }, [loadPlaylistFromPath]);

  return { loadPlaylistFromPath };
};
