import { getPlaylistExportSelection, type PlaylistExportContent } from '../../domain/playlistExportContent';
import { useCallback } from 'react';
import type {
  AnnotationTarget,
  DrawingObject,
  ItemAnnotation,
  PlaylistItem,
  PlaylistRow,
} from '../../../../types/playlist/core';
import type {
  ClipExportAngleOption,
  ClipExportMode,
  ClipExportOverlaySettings,
  ClipExportScope,
} from '../../../../shared/clipExport/clipExportTypes';
import { usePlaylistExport } from './usePlaylistExport';

interface UsePlaylistWindowExportFlowParams {
  items: PlaylistItem[];
  selectedItems: PlaylistItem[];
  rows?: PlaylistRow[];
  videoSources: string[];
  exportScope: ClipExportScope;
  angleOption: ClipExportAngleOption;
  selectedAngleIndex: number;
  exportMode: ClipExportMode;
  exportFileName: string;
  overlayChoice: boolean | null;
  content: PlaylistExportContent;
  overlaySettings: ClipExportOverlaySettings;
  itemAnnotations: Record<string, ItemAnnotation>;
  minFreezeDuration: number;
  primaryContentRect: {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  };
  secondaryContentRect: {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  };
  primarySourceSize: {
    width: number;
    height: number;
  };
  secondarySourceSize: {
    width: number;
    height: number;
  };
  renderAnnotationPng: (
    objects: DrawingObject[] | undefined,
    target: AnnotationTarget,
    fallbackSize: { width: number; height: number },
    targetSize?: { width: number; height: number },
  ) => string | null;
  onMissingApi: (message: string) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
  setExportDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const usePlaylistWindowExportFlow = ({
  items,
  selectedItems,
  rows,
  videoSources,
  exportScope,
  angleOption,
  selectedAngleIndex,
  exportMode,
  exportFileName,
  overlayChoice,
  content,
  overlaySettings,
  itemAnnotations,
  minFreezeDuration,
  primaryContentRect,
  secondaryContentRect,
  primarySourceSize,
  secondarySourceSize,
  renderAnnotationPng,
  onMissingApi,
  onSuccess,
  onError,
  setExportDialogOpen,
}: UsePlaylistWindowExportFlowParams) => {
  const {
    exportProgress,
    handleExportPlaylist: exportPlaylist,
    clearExportProgress,
  } = usePlaylistExport({
    items,
    selectedItems,
    rows,
    videoSources,
    exportScope,
    angleOption,
    selectedAngleIndex,
    exportMode,
    exportFileName,
    content,
    overlaySettings: { ...overlaySettings, enabled: overlayChoice === true },
    itemAnnotations,
    minFreezeDuration,
    primaryContentRect,
    secondaryContentRect,
    primarySourceSize,
    secondarySourceSize,
    renderAnnotationPng,
    onMissingApi,
  });

  const { hasVideo } = getPlaylistExportSelection(items, selectedItems, exportScope, content.includeSlides);
  const handleExportPlaylist = useCallback(() => {
    if (hasVideo && overlayChoice === null) {
      onError('オーバーレイテキストを含めるか選択してください');
      return;
    }
    setExportDialogOpen(false);
    void exportPlaylist().then((result) => {
      if (!result) return;
      if (result.success) {
        onSuccess(result.message);
      } else {
        onError(result.message);
      }
    });
  }, [exportPlaylist, hasVideo, onError, onSuccess, overlayChoice, setExportDialogOpen]);

  return {
    exportProgress,
    clearExportProgress,
    handleExportPlaylist,
  };
};
