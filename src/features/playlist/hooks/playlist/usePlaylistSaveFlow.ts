import { useCallback } from 'react';
import type {
  ItemAnnotation,
  PlaylistItem,
  PlaylistType,
} from '../../../../types/Playlist';
import {
  notifyPlaylistSavedAndClose,
  savePlaylistFile,
  savePlaylistFileAs,
  syncPlaylistDirtyState,
} from '../../gateway/playlistWindowGateway';
import { buildPlaylistPayload } from '../../utils/playlistFileState';

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
  const createPlaylistPayload = useCallback(
    (name: string, type: PlaylistType) =>
      buildPlaylistPayload({
        items,
        videoSources,
        packagePath,
        itemAnnotations,
        name,
        type,
      }),
    [itemAnnotations, items, packagePath, videoSources],
  );

  const handleSavePlaylist = useCallback(
    async (shouldCloseAfterSave = false): Promise<void> => {
      const playlist = createPlaylistPayload(playlistName, playlistType);

      setSaveProgress(null);
      const savedPath = await savePlaylistFile(playlist);
      setSaveProgress(null);

      if (!savedPath) return;

      if (shouldCloseAfterSave) {
        notifyPlaylistSavedAndClose();
        return;
      }

      setLoadedFilePath(savedPath);
      setIsDirty(false);
      setHasUnsavedChanges(false);
      syncPlaylistDirtyState(false);
    },
    [
      createPlaylistPayload,
      playlistName,
      playlistType,
      setHasUnsavedChanges,
      setIsDirty,
      setLoadedFilePath,
      setSaveProgress,
    ],
  );

  const handleSavePlaylistAs = useCallback(
    async (
      type: PlaylistType,
      name: string,
      shouldCloseAfterSave = false,
    ): Promise<void> => {
      setSaveDialogOpen(false);
      const playlist = createPlaylistPayload(name, type);

      setSaveProgress(null);
      const savedPath = await savePlaylistFileAs(playlist);
      setSaveProgress(null);

      if (!savedPath) return;

      if (shouldCloseAfterSave) {
        notifyPlaylistSavedAndClose();
        return;
      }

      setPlaylistName(name);
      setPlaylistType(type);
      setLoadedFilePath(savedPath);
      setIsDirty(false);
      syncPlaylistDirtyState(false);
    },
    [
      createPlaylistPayload,
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
