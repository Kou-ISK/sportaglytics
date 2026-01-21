import { useCallback } from 'react';
import type {
  ItemAnnotation,
  Playlist,
  PlaylistItem,
  PlaylistType,
} from '../../../../types/Playlist';

interface UsePlaylistSaveFlowParams {
  items: PlaylistItem[];
  videoSources: string[];
  packagePath: string | null;
  itemAnnotations: Record<string, ItemAnnotation>;
  playlistName: string;
  playlistType: PlaylistType;
  setPlaylistName: React.Dispatch<React.SetStateAction<string>>;
  setPlaylistType: React.Dispatch<React.SetStateAction<PlaylistType>>;
  setLoadedFilePath: React.Dispatch<React.SetStateAction<string | null>>;
  setIsDirty: React.Dispatch<React.SetStateAction<boolean>>;
  setHasUnsavedChanges: React.Dispatch<React.SetStateAction<boolean>>;
  setSaveDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setSaveProgress: React.Dispatch<
    React.SetStateAction<{ current: number; total: number } | null>
  >;
}

interface UsePlaylistSaveFlowResult {
  handleSavePlaylist: (shouldCloseAfterSave?: boolean) => Promise<void>;
  handleSavePlaylistAs: (
    type: PlaylistType,
    name: string,
    shouldCloseAfterSave?: boolean,
  ) => Promise<void>;
}

export const usePlaylistSaveFlow = ({
  items,
  videoSources,
  packagePath,
  itemAnnotations,
  playlistName,
  playlistType,
  setPlaylistName,
  setPlaylistType,
  setLoadedFilePath,
  setIsDirty,
  setHasUnsavedChanges,
  setSaveDialogOpen,
  setSaveProgress,
}: UsePlaylistSaveFlowParams): UsePlaylistSaveFlowResult => {
  const buildPlaylistPayload = useCallback(
    (name: string, type: PlaylistType): Playlist => {
      const itemsWithAnnotations = items.map((item) => ({
        ...item,
        videoSource: item.videoSource ?? videoSources[0] ?? undefined,
        videoSource2: item.videoSource2 ?? videoSources[1] ?? undefined,
        annotation: itemAnnotations[item.id] || item.annotation,
      }));

      return {
        id: crypto.randomUUID(),
        name,
        type,
        items: itemsWithAnnotations,
        sourcePackagePath: packagePath || undefined,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
    },
    [itemAnnotations, items, packagePath, videoSources],
  );

  const handleSavePlaylist = useCallback(
    async (shouldCloseAfterSave = false) => {
      const playlistAPI = window.electronAPI?.playlist;
      if (!playlistAPI) {
        console.debug('[PlaylistWindow] playlist API unavailable for save');
        return;
      }

      const playlist = buildPlaylistPayload(playlistName, playlistType);

      setSaveProgress(null);
      const savedPath = await playlistAPI.savePlaylistFile(playlist);
      setSaveProgress(null);

      if (!savedPath) return;
      console.log('[PlaylistWindow] Playlist saved to:', savedPath);

      if (shouldCloseAfterSave) {
        window.electronAPI?.send?.('playlist:saved-and-close');
        return;
      }

      setLoadedFilePath(savedPath);
      setIsDirty(false);
      setHasUnsavedChanges(false);
      playlistAPI.sendCommand({ type: 'set-dirty', isDirty: false });
    },
    [
      buildPlaylistPayload,
      playlistName,
      playlistType,
      setHasUnsavedChanges,
      setIsDirty,
      setLoadedFilePath,
      setSaveProgress,
    ],
  );

  const handleSavePlaylistAs = useCallback(
    async (type: PlaylistType, name: string, shouldCloseAfterSave = false) => {
      setSaveDialogOpen(false);
      const playlistAPI = window.electronAPI?.playlist;
      if (!playlistAPI) {
        console.debug('[PlaylistWindow] playlist API unavailable for save as');
        return;
      }

      const playlist = buildPlaylistPayload(name, type);

      setSaveProgress(null);
      const savedPath = await playlistAPI.savePlaylistFileAs(playlist);
      setSaveProgress(null);

      if (!savedPath) return;
      console.log('[PlaylistWindow] Playlist saved to:', savedPath);

      if (shouldCloseAfterSave) {
        window.electronAPI?.send?.('playlist:saved-and-close');
        return;
      }

      setPlaylistName(name);
      setPlaylistType(type);
      setLoadedFilePath(savedPath);
      setIsDirty(false);
      playlistAPI.sendCommand({ type: 'set-dirty', isDirty: false });
    },
    [
      buildPlaylistPayload,
      setIsDirty,
      setLoadedFilePath,
      setPlaylistName,
      setPlaylistType,
      setSaveDialogOpen,
      setSaveProgress,
    ],
  );

  return { handleSavePlaylist, handleSavePlaylistAs };
};
