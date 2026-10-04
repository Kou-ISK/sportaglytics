import { useCallback, useEffect, useRef } from 'react';
import type {
  ItemAnnotation,
  PlaylistItem,
  PlaylistRow,
  PlaylistType,
} from '../../../../types/playlist/core';
import {
  acceptLoadedPlaylistDocument,
  loadPlaylistFile,
  subscribePlaylistExternalOpen,
} from '../../gateway/playlistWindowGateway';
import { buildLoadedPlaylistSnapshot } from '../../utils/playlistFileState';
import type { PlaylistLoadQueue, PlaylistLoadToken } from './PlaylistLoadQueue';

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
  const inFlight = useRef<{
    filePath?: string;
    token: PlaylistLoadToken;
    promise: Promise<void>;
  } | null>(null);
  const loadPlaylistFromPath = useCallback(
    (filePath?: string): Promise<void> => {
      const current = inFlight.current;
      if (
        current &&
        current.filePath === filePath &&
        loadQueue.isCurrent(current.token)
      )
        return current.promise;
      const token = loadQueue.begin();
      const request = { filePath, token, promise: Promise.resolve() };
      inFlight.current = request;
      request.promise = (async (): Promise<void> => {
        try {
          const loaded = await loadPlaylistFile(filePath);
          if (!loaded) return;

          const snapshot = buildLoadedPlaylistSnapshot(
            loaded.playlist,
            loaded.filePath,
          );

          loadQueue.complete(token, () => {
            if (!acceptLoadedPlaylistDocument(loaded.loadId)) return;
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
          if (inFlight.current === request) inFlight.current = null;
        }
      })();
      return request.promise;
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
      inFlight.current = null;
    };
  }, [loadPlaylistFromPath, loadQueue]);

  return { loadPlaylistFromPath };
};
