import { useCallback, useRef } from 'react';
import type {
  ItemAnnotation,
  PlaylistItem,
  PlaylistRow,
  PlaylistType,
} from '../../../../types/playlist/core';
import {
  notifyPlaylistSavedAndClose,
  savePlaylistFile,
  savePlaylistFileAs,
  syncPlaylistDirtyState,
} from '../../gateway/playlistWindowGateway';
import { buildPlaylistPayload } from '../../utils/playlistFileState';

interface UsePlaylistSaveFlowParams {
  getChangeToken: () => string;
  getDocumentGeneration: () => number;
  items: PlaylistItem[];
  videoSources: string[];
  packagePath: string | null;
  itemAnnotations: Record<string, ItemAnnotation>;
  playlistName: string;
  playlistType: PlaylistType;
  playlistRows: PlaylistRow[];
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
  getChangeToken,
  getDocumentGeneration,
  items,
  videoSources,
  packagePath,
  itemAnnotations,
  playlistName,
  playlistType,
  playlistRows,
  setPlaylistName,
  setPlaylistType,
  setLoadedFilePath,
  setIsDirty,
  setHasUnsavedChanges,
  setSaveDialogOpen,
  setSaveProgress,
}: UsePlaylistSaveFlowParams): UsePlaylistSaveFlowResult => {
  const saving = useRef(false);
  const renderedToken = getChangeToken();
  const createPlaylistPayload = useCallback(
    (name: string, type: PlaylistType) =>
      buildPlaylistPayload({
        items,
        videoSources,
        packagePath,
        itemAnnotations,
        name,
        type,
        rows: playlistRows,
        normalizeDocument: true,
      }),
    [itemAnnotations, items, packagePath, playlistRows, videoSources],
  );

  const handleSavePlaylist = useCallback(
    async (shouldCloseAfterSave = false): Promise<void> => {
      if (saving.current || renderedToken !== getChangeToken()) return;
      const token = renderedToken;
      const document = getDocumentGeneration();
      saving.current = true;
      try {
      const playlist = createPlaylistPayload(playlistName, playlistType);

      setSaveProgress(null);
      const savedPath = await savePlaylistFile(playlist);
      setSaveProgress(null);

      if (!savedPath) return;
      if (document !== getDocumentGeneration()) return;
      setLoadedFilePath(savedPath);
      if (token !== getChangeToken()) return;

      if (shouldCloseAfterSave) {
        notifyPlaylistSavedAndClose();
        return;
      }

      setIsDirty(false);
      setHasUnsavedChanges(false);
      syncPlaylistDirtyState(false);
      } finally { saving.current = false; }
    },
    [
      createPlaylistPayload,
      getChangeToken,
      getDocumentGeneration,
      renderedToken,
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
      if (saving.current || renderedToken !== getChangeToken()) return;
      const token = renderedToken;
      const document = getDocumentGeneration();
      saving.current = true;
      try {
      setSaveDialogOpen(false);
      const playlist = createPlaylistPayload(name, type);

      setSaveProgress(null);
      const savedPath = await savePlaylistFileAs(playlist);
      setSaveProgress(null);

      if (!savedPath) return;
      if (document !== getDocumentGeneration()) return;
      setLoadedFilePath(savedPath);
      if (token !== getChangeToken()) return;

      if (shouldCloseAfterSave) {
        notifyPlaylistSavedAndClose();
        return;
      }

      setPlaylistName(name);
      setPlaylistType(type);
      setIsDirty(false);
      setHasUnsavedChanges(false);
      syncPlaylistDirtyState(false);
      } finally { saving.current = false; }
    },
    [
      createPlaylistPayload,
      getChangeToken,
      getDocumentGeneration,
      renderedToken,
      setIsDirty,
      setHasUnsavedChanges,
      setLoadedFilePath,
      setPlaylistName,
      setPlaylistType,
      setSaveDialogOpen,
      setSaveProgress,
    ],
  );

  return { handleSavePlaylist, handleSavePlaylistAs };
};
