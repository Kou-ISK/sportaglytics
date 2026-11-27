import { getPlaylistExportSelection, type PlaylistExportContent } from '../../domain/playlistExportContent';
import { renderSlideFrame } from '../../utils/slideCanvas';
import { organizerGroups } from '../../domain/organizerRows';
import { useCallback, useState } from 'react';
import type {
  AnnotationTarget,
  DrawingObject,
  ItemAnnotation,
  PlaylistItem,
  PlaylistRow,
} from '../../../../types/playlist/core';
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
  rows?: PlaylistRow[];
  videoSources: string[];
  exportScope: ClipExportScope;
  angleOption: ClipExportAngleOption;
  selectedAngleIndex: number;
  exportMode: ClipExportMode;
  exportFileName: string;
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
  rows,
  videoSources,
  exportScope,
  angleOption,
  selectedAngleIndex,
  exportMode,
  exportFileName,
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
}: UsePlaylistExportParams): UsePlaylistExportResult => {
  const [exportProgress, setExportProgress] =
    useState<ClipExportProgressState | null>(null);

  const clearExportProgress = useCallback(() => {
    setExportProgress(null);
  }, []);

  const handleExportPlaylist = useCallback(async () => {
    if (!canExportClipsWithOverlay()) {
      onMissingApi?.('書き出しAPIが利用できません');
      return { success: false, message: '書き出しAPIが利用できません' };
    }

    const { items: sourceItems, hasVideo } = getPlaylistExportSelection(items, selectedItems, exportScope, content.includeSlides);
    if (sourceItems.length === 0) {
      return { success: false, message: '書き出すアイテムがありません' };
    }
    const effectiveAngle = hasVideo ? angleOption : 'defaultAngles';
    const resolvedSources = resolveClipExportSourceSelection(videoSources);
    const sourceValidationError = validateClipExportSources({
      angleOption: effectiveAngle,
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

    try {
      const slideFrames = new Map<string, string>();
      let imageBytes = 0;
      for (const item of sourceItems) {
        if (!item.slide) continue;
        const frame = await renderSlideFrame(item.slide);
        imageBytes += frame.length;
        if (imageBytes > 32 * 1024 * 1024) throw new Error('スライド画像が多すぎます。行または選択範囲を分けてください。');
        slideFrames.set(item.id, frame);
      }
      const clips = buildPlaylistExportClips({
        slideFrames,
        sourceItems,
        includeEffects: content.includeEffects,
        itemAnnotations,
        minFreezeDuration,
        primaryContentRect,
        secondaryContentRect,
        primarySourceSize,
        secondarySourceSize,
        renderAnnotationPng,
      });
      if (exportMode === 'organizerRows') {
        const groups = organizerGroups(sourceItems, rows ?? []);
        const memberships = new Map(groups.flatMap(({ id, name, itemIds }) =>
          itemIds.map((itemId) => [itemId, { id, name }] as const),
        ));
        for (const clip of clips) clip.organizerRow = memberships.get(clip.id);
      }
      const progressId =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `export-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const initialProgress = {
        current: 0,
        total: Math.max(1, clips.length),
        message: '書き出し準備中...',
      };

      setExportProgress(initialProgress);

      return await executeClipExport({
        progressId,
        executeExport: exportClipsWithOverlay,
        clips,
        videoSources,
        angleOption: effectiveAngle,
        selectedAngleIndex,
        resolvedSources,
        exportMode,
        exportFileName,
        overlay: hasVideo ? overlaySettings : { ...overlaySettings, enabled: false },
        successMessage: 'プレイリストを書き出しました',
        onProgress: setExportProgress,
      });
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : '書き出しの準備に失敗しました',
      };
    } finally {
      setExportProgress(null);
    }
  }, [
    angleOption,
    content,
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
    rows,
    videoSources,
  ]);

  return {
    exportProgress,
    handleExportPlaylist,
    clearExportProgress,
  };
};
