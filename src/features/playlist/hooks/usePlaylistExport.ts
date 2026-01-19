import { useCallback, useState } from 'react';
import type { PlaylistItem, ItemAnnotation, DrawingObject, AnnotationTarget } from '../../../types/Playlist';
import type { OverlaySettings } from '../components/PlaylistExportDialog';

interface UsePlaylistExportParams {
  items: PlaylistItem[];
  selectedItems: PlaylistItem[];
  videoSources: string[];
  exportScope: 'all' | 'selected';
  angleOption: 'allAngles' | 'single' | 'multi';
  selectedAngleIndex: number;
  exportMode: 'single' | 'perInstance' | 'perRow';
  exportFileName: string;
  overlaySettings: OverlaySettings;
  itemAnnotations: Record<string, ItemAnnotation>;
  minFreezeDuration: number;
  primaryContentRect: { width: number; height: number; offsetX: number; offsetY: number };
  secondaryContentRect: { width: number; height: number; offsetX: number; offsetY: number };
  primarySourceSize: { width: number; height: number };
  secondarySourceSize: { width: number; height: number };
  renderAnnotationPng: (
    objects: DrawingObject[] | undefined,
    target: AnnotationTarget,
    fallbackSize: { width: number; height: number },
    targetSize?: { width: number; height: number },
  ) => string | null;
  showError: (message: string) => void;
  success: (message: string) => void;
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
  showError,
  success,
}: UsePlaylistExportParams) => {
  const [exportProgress, setExportProgress] = useState<{
    current: number;
    total: number;
    message: string;
  } | null>(null);

  const handleExportPlaylist = useCallback(async () => {
    const api = window.electronAPI?.exportClipsWithOverlay;
    if (!api) {
      showError('書き出しAPIが利用できません');
      return;
    }

    // アングルオプションに応じた検証
    if (angleOption === 'allAngles' && videoSources.length < 2) {
      showError('全アングル書き出しには2つ以上の映像ソースが必要です');
      return;
    }
    if (angleOption === 'multi' && videoSources.length < 2) {
      showError('マルチアングル書き出しには2つ以上の映像ソースが必要です');
      return;
    }
    if (angleOption === 'single' && !videoSources[selectedAngleIndex]) {
      showError('選択されたアングルの映像が取得できません');
      return;
    }

    const sourceItems = exportScope === 'selected' ? selectedItems : items;

    if (sourceItems.length === 0) {
      showError('書き出すアイテムがありません');
      return;
    }

    // 選択されたアイテムのみを使用してactionIndexを計算
    const ordered = [...sourceItems];
    const actionIndexLookup = new Map<string, number>();
    const counters: Record<string, number> = {};
    ordered.forEach((item) => {
      const count = (counters[item.actionName] || 0) + 1;
      counters[item.actionName] = count;
      actionIndexLookup.set(item.id, count);
    });

    const clips = sourceItems.map((item) => {
      const annotation = itemAnnotations[item.id] || item.annotation;
      const allTimestamps =
        annotation?.objects
          ?.map((obj) => obj.timestamp)
          .filter((time) => time !== undefined) || [];
      const freezeAtAbsolute =
        allTimestamps.length > 0 ? Math.min(...allTimestamps) : null;
      const freezeAt =
        freezeAtAbsolute !== null
          ? Math.max(0, freezeAtAbsolute - item.startTime)
          : null;
      const freezeDuration =
        annotation?.freezeDuration && annotation.freezeDuration > 0
          ? Math.max(minFreezeDuration, annotation.freezeDuration)
          : minFreezeDuration;
      const annotationPngPrimary = renderAnnotationPng(
        annotation?.objects,
        'primary',
        primaryContentRect,
        primarySourceSize,
      );
      const annotationPngSecondary = renderAnnotationPng(
        annotation?.objects,
        'secondary',
        secondaryContentRect,
        secondarySourceSize,
      );

      return {
        id: item.id,
        actionName: item.actionName,
        startTime: item.startTime,
        endTime: item.endTime,
        freezeAt,
        freezeDuration,
        labels:
          item.labels?.map((label) => ({
            group: label.group || '',
            name: label.name,
          })) || undefined,
        memo: item.memo || undefined,
        actionIndex: actionIndexLookup.get(item.id) ?? 1,
        annotationPngPrimary,
        annotationPngSecondary,
        videoSource: item.videoSource || undefined,
        videoSource2: item.videoSource2 || undefined,
      };
    });

    if (angleOption === 'allAngles') {
      let allSuccess = true;
      for (let i = 0; i < videoSources.length; i += 1) {
        setExportProgress({
          current: i,
          total: videoSources.length,
          message: `アングル${i + 1} / ${videoSources.length} を書き出し中...`,
        });

        const result = await api({
          sourcePath: videoSources[i],
          sourcePath2: undefined,
          mode: 'single',
          exportMode,
          angleOption: 'single',
          outputFileName: exportFileName.trim()
            ? `${exportFileName.trim()}_angle${i + 1}`
            : undefined,
          clips,
          overlay: overlaySettings,
        });

        if (!result?.success) {
          allSuccess = false;
          setExportProgress(null);
          showError(
            result?.error || `アングル${i + 1}の書き出しに失敗しました`,
          );
          break;
        }
      }

      setExportProgress(null);
      if (allSuccess) {
        success(`全${videoSources.length}アングルの書き出しが完了しました`);
      }
      return;
    }

    setExportProgress({
      current: 0,
      total: 1,
      message: '書き出し中...',
    });

    const result = await api({
      sourcePath:
        angleOption === 'single'
          ? videoSources[selectedAngleIndex]
          : videoSources[0],
      sourcePath2: angleOption === 'multi' ? videoSources[1] : undefined,
      mode: angleOption === 'multi' ? 'dual' : 'single',
      exportMode,
      angleOption,
      outputFileName: exportFileName.trim() || undefined,
      clips,
      overlay: overlaySettings,
    });

    setExportProgress(null);
    if (result?.success) {
      success('プレイリストを書き出しました');
    } else {
      showError(result?.error || '書き出しに失敗しました');
    }
  }, [
    angleOption,
    exportFileName,
    exportMode,
    exportScope,
    itemAnnotations,
    items,
    minFreezeDuration,
    overlaySettings,
    primaryContentRect,
    primarySourceSize,
    renderAnnotationPng,
    secondaryContentRect,
    secondarySourceSize,
    selectedAngleIndex,
    selectedItems,
    showError,
    success,
    videoSources,
  ]);

  return {
    exportProgress,
    setExportProgress,
    handleExportPlaylist,
  };
};
