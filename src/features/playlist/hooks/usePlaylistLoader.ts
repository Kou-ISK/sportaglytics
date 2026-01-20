import { useCallback, useEffect } from 'react';
import type {
  ItemAnnotation,
  Playlist,
  PlaylistItem,
  PlaylistType,
} from '../../../types/Playlist';
import { resolveViewModeForSources } from '../utils/viewMode';

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
    async (filePath?: string) => {
      const playlistAPI = window.electronAPI?.playlist;
      if (!playlistAPI) {
        console.debug('[PlaylistWindow] playlist API unavailable for load');
        return;
      }

      try {
        const loaded = await playlistAPI.loadPlaylistFile(filePath);
        if (!loaded) return;

        const { playlist, filePath: loadedPath } = loaded;
        console.log('[PlaylistWindow] Playlist loaded from:', loadedPath);
        setItemsWithHistory(playlist.items);
        setHasUnsavedChanges(false);
        setPlaylistName(playlist.name);
        setPlaylistType(playlist.type || 'embedded');
        setPackagePath(playlist.sourcePackagePath || null);
        setLoadedFilePath(loadedPath);
        console.log('[PlaylistWindow] loadedFilePath set to:', loadedPath);
        setIsDirty(false); // 読み込み直後はクリーン状態

        const annotations: Record<string, ItemAnnotation> = {};
        for (const item of playlist.items) {
          if (item.annotation) {
            annotations[item.id] = item.annotation;
          }
        }
        setItemAnnotations(annotations);

        const sources: string[] = [];
        if (playlist.items[0]?.videoSource) {
          sources.push(playlist.items[0].videoSource as string);
        }
        if (playlist.items[0]?.videoSource2) {
          sources.push(playlist.items[0].videoSource2 as string);
        }
        if (sources.length > 0) {
          setVideoSources(sources);
        }
        setViewMode(resolveViewModeForSources(sources));

        if (playlist.items.length > 0) {
          setCurrentIndex(0);
        }
      } catch (error: unknown) {
        console.debug('[PlaylistWindow] Failed to load playlist file', error);
      }
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
    const playlistAPI = window.electronAPI?.playlist;
    if (!playlistAPI?.onExternalOpen) {
      console.debug(
        '[PlaylistWindow] playlist API unavailable for external open',
      );
      return;
    }

    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = playlistAPI.onExternalOpen((filePath: string) => {
        void loadPlaylistFromPath(filePath);
      });
    } catch (error: unknown) {
      console.debug(
        '[PlaylistWindow] Failed to register external open handler',
        error,
      );
    }

    return () => {
      try {
        unsubscribe?.();
      } catch (error: unknown) {
        console.debug(
          '[PlaylistWindow] Failed to cleanup external open handler',
          error,
        );
      }
    };
  }, [loadPlaylistFromPath]);

  return { loadPlaylistFromPath };
};
