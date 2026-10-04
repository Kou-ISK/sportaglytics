import { useCallback, useEffect } from 'react';
import type {
  ItemAnnotation,
  PlaylistItem,
  PlaylistRow,
  PlaylistType,
} from '../../../../types/playlist/core';
import {
  loadPlaylistFile,
  subscribePlaylistExternalOpen,
} from '../../gateway/playlistWindowGateway';
import { buildLoadedPlaylistSnapshot } from '../../utils/playlistFileState';
import type { PlaylistLoadQueue } from './PlaylistLoadQueue';

interface UsePlaylistLoaderParams {
  loadQueue: PlaylistLoadQueue;
  setItemsWithHistory: React.Dispatch<React.SetStateAction<PlaylistItem[]>>;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  setPlaylistName: React.Dispatch<React.SetStateAction<string>>;
  setPlaylistType: React.Dispatch<React.SetStateAction<PlaylistType>>;
  setPlaylistRows: React.Dispatch<React.SetStateAction<PlaylistRow[]>>;
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
  loadQueue,
  setItemsWithHistory,
  setHasUnsavedChanges,
  setPlaylistName,
  setPlaylistType,
  setPlaylistRows,
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
      const token = loadQueue.begin();
      try {
        const loaded = await loadPlaylistFile(filePath);
        if (!loaded) return;

        const snapshot = buildLoadedPlaylistSnapshot(
          loaded.playlist,
          loaded.filePath,
        );

        loadQueue.complete(token, () => {
          setItemsWithHistory(snapshot.items);
          setHasUnsavedChanges(snapshot.hasUnsavedChanges);
          setPlaylistName(snapshot.playlistName);
          setPlaylistType(snapshot.playlistType);
          setPlaylistRows(snapshot.rows ?? []);
          setPackagePath(snapshot.packagePath);
          setLoadedFilePath(snapshot.loadedFilePath);
          setIsDirty(snapshot.isDirty);
          setItemAnnotations(snapshot.itemAnnotations);
          setVideoSources(snapshot.videoSources);
          setViewMode(snapshot.viewMode);
          setCurrentIndex(snapshot.currentIndex);
        });
      } finally {
        loadQueue.finish(token);
      }
    },
    [
      loadQueue,
      setCurrentIndex,
      setHasUnsavedChanges,
      setIsDirty,
      setItemAnnotations,
      setItemsWithHistory,
      setLoadedFilePath,
      setPackagePath,
      setPlaylistName,
      setPlaylistType,
      setPlaylistRows,
      setVideoSources,
      setViewMode,
    ],
  );

  useEffect(() => {
    const unsubscribe = subscribePlaylistExternalOpen((filePath: string) => {
      void loadPlaylistFromPath(filePath);
    });
    return () => {
      unsubscribe();
      loadQueue.cancel();
    };
  }, [loadPlaylistFromPath, loadQueue]);

  return { loadPlaylistFromPath };
};
