import { useCallback, useState } from 'react';
import type {
  AnnotationTarget,
  DrawingObject,
  ItemAnnotation,
  PlaylistItem,
} from '../../../../types/Playlist';
import {
  canExportClipsWithOverlay,
  exportClipsWithOverlay,
} from '../../../../shared/clipExport/clipExportGateway';
import {
  executeClipExport,
  resolveClipExportSourceSelection,
  validateClipExportSources,
} from '../../../../shared/clipExport/clipExportService';
import type {
  ClipExportAngleOption,
  ClipExportMode,
  ClipExportOverlaySettings,
  ClipExportProgressState,
  ClipExportScope,
} from '../../../../shared/clipExport/clipExportTypes';
import { buildPlaylistExportClips } from '../../utils/playlistClipExportBuilder';

interface UsePlaylistExportParams {
  items: PlaylistItem[];
  selectedItems: PlaylistItem[];
  videoSources: string[];
  exportScope: ClipExportScope;
  angleOption: ClipExportAngleOption;
  selectedAngleIndex: number;
  exportMode: ClipExportMode;
  exportFileName: string;
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
  primarySourceSize: { width: number; height: number };
  secondarySourceSize: { width: number; height: number };
  renderAnnotationPng: (
    objects: DrawingObject[] | undefined,
    target: AnnotationTarget,
    fallbackSize: { width: number; height: number },
    targetSize?: { width: number; height: number },
  ) => string | null;
  onMissingApi?: (message: string) => void;
}

interface UsePlaylistExportResult {
  exportProgress: ClipExportProgressState | null;
  handleExportPlaylist: () => Promise<{
    success: boolean;
    message: string;
  }>;
  clearExportProgress: () => void;
}

export const usePlaylistExport = ({
  items,
  selectedItems,
  videoSources,
  exportScope,
  angleOption,
  selectedAngleIndex,
  exportMode,
  exportFileName,
  overlaySettings,
  itemAnnotations,
  minFreezeDuration,
  primaryContentRect,
  secondaryContentRect,
  primarySourceSize,
  secondarySourceSize,
  renderAnnotationPng,
  onMissingApi,
}: UsePlaylistExportParams): UsePlaylistExportResult => {
  const [exportProgress, setExportProgress] = useState<ClipExportProgressState | null>(
    null,
  );

  const clearExportProgress = useCallback(() => {
    setExportProgress(null);
  }, []);

  const handleExportPlaylist = useCallback(async () => {
    if (!canExportClipsWithOverlay()) {
      onMissingApi?.('書き出しAPIが利用できません');
      return { success: false, message: '書き出しAPIが利用できません' };
    }

    const resolvedSources = resolveClipExportSourceSelection(videoSources);
    const sourceValidationError = validateClipExportSources({
      angleOption,
      videoSources,
      selectedAngleIndex,
      resolvedSources,
    });
    if (sourceValidationError) {
      return {
        success: false,
        message: sourceValidationError,
      };
    }

    const sourceItems = exportScope === 'selected' ? selectedItems : items;
    if (sourceItems.length === 0) {
      return { success: false, message: '書き出すアイテムがありません' };
    }

    const clips = buildPlaylistExportClips({
      sourceItems,
      itemAnnotations,
      minFreezeDuration,
      primaryContentRect,
      secondaryContentRect,
      primarySourceSize,
      secondarySourceSize,
      renderAnnotationPng,
    });

    return await executeClipExport({
      executeExport: exportClipsWithOverlay,
      clips,
      videoSources,
      angleOption,
      selectedAngleIndex,
      resolvedSources,
      exportMode,
      exportFileName,
      overlay: overlaySettings,
      successMessage: 'プレイリストを書き出しました',
      onProgress: setExportProgress,
    });
  }, [
    angleOption,
    exportFileName,
    exportMode,
    exportScope,
    itemAnnotations,
    items,
    minFreezeDuration,
    onMissingApi,
    overlaySettings,
    primaryContentRect,
    primarySourceSize,
    renderAnnotationPng,
    secondaryContentRect,
    secondarySourceSize,
    selectedAngleIndex,
    selectedItems,
    videoSources,
  ]);

  return {
    exportProgress,
    handleExportPlaylist,
    clearExportProgress,
  };
};
