import { useCallback, useEffect, useState } from 'react';
import type { TimelineData } from '../../../../../../types/TimelineData';
import {
  buildExportClips,
  normalizeVideoSource,
  resolveExportSourceItems,
  resolveMultiAngleSources,
  resolveSingleOrMultiSourcePath,
  type OverlaySettings,
  validateExportSources,
} from './timelineExportHelpers';

interface UseTimelineClipExportDialogParams {
  timeline: TimelineData[];
  selectedIds: string[];
  videoSources?: string[];
  info: (message: string) => void;
}

export const useTimelineClipExportDialog = ({
  timeline,
  selectedIds,
  videoSources,
  info,
}: UseTimelineClipExportDialogParams) => {
  const [clipDialogOpen, setClipDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>({
    enabled: true,
    showActionName: true,
    showActionIndex: true,
    showLabels: true,
    showMemo: true,
  });
  const [primarySource, setPrimarySource] = useState<string | undefined>(
    videoSources?.[0],
  );
  const [secondarySource, setSecondarySource] = useState<string | undefined>(
    videoSources?.[1],
  );
  const [exportScope, setExportScope] = useState<'selected' | 'all'>(
    selectedIds.length > 0 ? 'selected' : 'all',
  );
  const [exportMode, setExportMode] = useState<
    'single' | 'perInstance' | 'perRow'
  >('single');
  const [angleOption, setAngleOption] = useState<
    'allAngles' | 'single' | 'multi'
  >('single');
  const [selectedAngleIndex, setSelectedAngleIndex] = useState<number>(0);
  const [exportFileName, setExportFileName] = useState('');

  useEffect(() => {
    if (!videoSources || videoSources.length === 0) {
      setPrimarySource(undefined);
      setSecondarySource(undefined);
      setSelectedAngleIndex(0);
      return;
    }

    setPrimarySource((prev) =>
      prev && videoSources.includes(prev) ? prev : videoSources[0],
    );
    setSecondarySource((prev) => {
      if (prev && videoSources.includes(prev)) return prev;
      return videoSources.find((source) => source !== videoSources[0]);
    });
    setSelectedAngleIndex((prev) =>
      prev < videoSources.length ? prev : Math.max(0, videoSources.length - 1),
    );
  }, [videoSources]);

  const handleOpenClipDialog = useCallback(async () => {
    try {
      const settings =
        (await globalThis.window.electronAPI?.loadSettings?.()) as
          | { overlayClip?: OverlaySettings }
          | undefined;
      if (settings?.overlayClip) {
        setOverlaySettings((prev) => ({
          ...prev,
          ...settings.overlayClip,
        }));
      }
    } catch (error) {
      console.debug('[useTimelineClipExportDialog] loadSettings error', error);
    }
    setClipDialogOpen(true);
  }, []);

  const handleExportClips = useCallback(async () => {
    if (!globalThis.window.electronAPI?.exportClipsWithOverlay) {
      info('クリップ書き出しAPIが利用できません');
      setClipDialogOpen(false);
      return;
    }

    const resolvedMultiSources = resolveMultiAngleSources(
      videoSources,
      primarySource,
      secondarySource,
    );

    const sourceValidationError = validateExportSources({
      angleOption,
      videoSources,
      selectedAngleIndex,
      resolvedMultiSources,
    });
    if (sourceValidationError) {
      info(sourceValidationError);
      return;
    }

    const sourceItems = resolveExportSourceItems({
      timeline,
      selectedIds,
      exportScope,
    });
    if (sourceItems.length === 0) {
      info('書き出すインスタンスがありません');
      setClipDialogOpen(false);
      return;
    }

    const clips = buildExportClips({
      timeline,
      sourceItems,
    });

    setIsExporting(true);

    if (angleOption === 'allAngles') {
      let allSuccess = true;
      for (let i = 0; i < videoSources!.length; i += 1) {
        const result =
          await globalThis.window.electronAPI.exportClipsWithOverlay({
            sourcePath: videoSources![i],
            sourcePath2: undefined,
            mode: 'single',
            exportMode,
            angleOption: 'single',
            clips,
            overlay: overlaySettings,
            outputFileName: exportFileName.trim()
              ? `${exportFileName.trim()}_angle${i + 1}`
              : undefined,
          });
        if (!result?.success) {
          allSuccess = false;
          info(result?.error || `アングル${i + 1}の書き出しに失敗しました`);
          break;
        }
      }
      setIsExporting(false);
      if (allSuccess) {
        info(`全${videoSources!.length}アングルの書き出しが完了しました`);
        setClipDialogOpen(false);
      }
      return;
    }

    const sourcePathForExport = resolveSingleOrMultiSourcePath({
      angleOption,
      videoSources,
      selectedAngleIndex,
      resolvedMultiSources,
    });
    if (!sourcePathForExport) {
      info('書き出し対象の映像ソースが見つかりません');
      setIsExporting(false);
      return;
    }

    const result = await globalThis.window.electronAPI.exportClipsWithOverlay({
      sourcePath: sourcePathForExport,
      sourcePath2:
        angleOption === 'multi'
          ? normalizeVideoSource(resolvedMultiSources.sourcePath2)
          : undefined,
      mode: angleOption === 'multi' ? 'dual' : 'single',
      exportMode,
      angleOption,
      clips,
      overlay: overlaySettings,
      outputFileName: exportFileName.trim() || undefined,
    });

    setIsExporting(false);
    if (result?.success) {
      info('クリップを書き出しました');
      setClipDialogOpen(false);
      return;
    }
    info(result?.error || 'クリップ書き出しに失敗しました');
  }, [
    angleOption,
    exportFileName,
    exportMode,
    exportScope,
    info,
    overlaySettings,
    primarySource,
    secondarySource,
    selectedAngleIndex,
    selectedIds,
    timeline,
    videoSources,
  ]);

  useEffect(() => {
    const api = globalThis.window.electronAPI;
    if (!api?.onMenuExportClips) return;
    const unsubscribe = api.onMenuExportClips(() => {
      handleOpenClipDialog();
    });
    return unsubscribe;
  }, [handleOpenClipDialog]);

  return {
    clipDialogOpen,
    setClipDialogOpen,
    isExporting,
    overlaySettings,
    setOverlaySettings,
    primarySource,
    setPrimarySource,
    secondarySource,
    setSecondarySource,
    exportScope,
    setExportScope,
    exportMode,
    setExportMode,
    angleOption,
    setAngleOption,
    selectedAngleIndex,
    setSelectedAngleIndex,
    exportFileName,
    setExportFileName,
    handleExportClips,
  };
};
