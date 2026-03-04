import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimelineData } from '../../../../../../types/TimelineData';

type OverlaySettings = {
  enabled: boolean;
  showActionName: boolean;
  showActionIndex: boolean;
  showLabels: boolean;
  showMemo: boolean;
};

const normalizeVideoSource = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const resolveMultiAngleSources = (
  videoSources: string[] | undefined,
  primarySource: string | undefined,
  secondarySource: string | undefined,
): { sourcePath?: string; sourcePath2?: string } => {
  const available = (videoSources ?? []).map(normalizeVideoSource).filter(Boolean) as string[];
  const sourcePath = normalizeVideoSource(primarySource) ?? available[0];
  const sourcePath2 = normalizeVideoSource(secondarySource);
  if (sourcePath2) {
    return { sourcePath, sourcePath2 };
  }
  return {
    sourcePath,
    sourcePath2: available.find((source) => source !== sourcePath),
  };
};

interface UseTimelineExportDialogsParams {
  timeline: TimelineData[];
  selectedIds: string[];
  videoSources?: string[];
  onUpdateTimelineItem?: (
    id: string,
    updates: Partial<Omit<TimelineData, 'id'>>,
  ) => void;
  info: (message: string) => void;
}

export const useTimelineExportDialogs = ({
  timeline,
  selectedIds,
  videoSources,
  onUpdateTimelineItem,
  info,
}: UseTimelineExportDialogsParams) => {
  const [labelDialogOpen, setLabelDialogOpen] = useState(false);
  const [labelGroup, setLabelGroup] = useState('');
  const [labelName, setLabelName] = useState('');
  const [clipDialogOpen, setClipDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [overlaySettings, setOverlaySettings] = useState<OverlaySettings>({
    enabled: true,
    showActionName: true,
    showActionIndex: true,
    showLabels: true,
    showMemo: true,
  });
  const timelineRef = useRef(timeline);
  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);
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

  const handleApplyLabel = useCallback(
    (override?: { group: string; name: string }) => {
      if (!onUpdateTimelineItem) return;
      const group = (override?.group ?? labelGroup).trim();
      const name = (override?.name ?? labelName).trim();
      if (!group || !name) return;

      let applied = 0;
      const uniqueIds = Array.from(new Set(selectedIds));
      const current = timelineRef.current;

      // 事前に全アイテムのラベル配列を計算してから一括適用
      uniqueIds.forEach((id) => {
        const item = current.find((t) => t.id === id);
        if (!item) return;
        const existing = item.labels ? [...item.labels] : [];
        const exists = existing.some(
          (label) => label.group === group && label.name === name,
        );
        const updatedLabels = exists
          ? existing
          : [...existing, { group, name }];
        onUpdateTimelineItem(id, { labels: updatedLabels });
        applied += 1;
      });

      if (applied > 0) {
        info(`${applied}件にラベル '${group}: ${name}' を付与しました`);
      }
      setLabelGroup(group);
      setLabelName(name);
      setLabelDialogOpen(false);
    },
    [info, labelGroup, labelName, onUpdateTimelineItem, selectedIds],
  );

  const handleOpenClipDialog = useCallback(async () => {
    // 設定からオーバーレイのデフォルトを読み込む
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
      console.debug('[useTimelineExportDialogs] loadSettings error', error);
    }
    setClipDialogOpen(true);
  }, []);

  const handleExportClips = useCallback(async () => {
    if (!globalThis.window.electronAPI?.exportClipsWithOverlay) {
      info('クリップ書き出しAPIが利用できません');
      setClipDialogOpen(false);
      return;
    }

    // アングルオプションに応じた検証
    if (
      angleOption === 'allAngles' &&
      (!videoSources || videoSources.length < 2)
    ) {
      info('全アングル書き出しには2つ以上の映像ソースが必要です');
      return;
    }
    if (angleOption === 'multi' && (!videoSources || videoSources.length < 2)) {
      info('マルチアングル書き出しには2つ以上の映像ソースが必要です');
      return;
    }
    if (
      angleOption === 'single' &&
      (!videoSources || !videoSources[selectedAngleIndex])
    ) {
      info('選択されたアングルの映像が取得できません');
      return;
    }

    const resolvedMultiSources = resolveMultiAngleSources(
      videoSources,
      primarySource,
      secondarySource,
    );
    if (angleOption === 'multi') {
      const sourcePath = normalizeVideoSource(resolvedMultiSources.sourcePath);
      const sourcePath2 = normalizeVideoSource(resolvedMultiSources.sourcePath2);
      if (!sourcePath || !sourcePath2) {
        info('マルチアングル書き出しにはメイン・サブ映像の両方が必要です');
        return;
      }
      if (sourcePath === sourcePath2) {
        info('マルチアングル書き出しでは異なる映像ソースを選択してください');
        return;
      }
    }
    const ordered = [...timeline].sort((a, b) => a.startTime - b.startTime);
    const actionIndexLookup = new Map<string, number>();
    const counters: Record<string, number> = {};
    ordered.forEach((item) => {
      const count = (counters[item.actionName] || 0) + 1;
      counters[item.actionName] = count;
      actionIndexLookup.set(item.id, count);
    });

    const sourceItems =
      exportScope === 'selected'
        ? timeline.filter((t) => selectedIds.includes(t.id))
        : timeline;
    if (sourceItems.length === 0) {
      info('書き出すインスタンスがありません');
      setClipDialogOpen(false);
      return;
    }
    // 同一アクション内での番号を付与
    const clips = sourceItems
      .sort((a, b) => a.startTime - b.startTime)
      .map((item) => {
        const count = actionIndexLookup.get(item.id) ?? 1;
        return {
          id: item.id,
          actionName: item.actionName,
          startTime: item.startTime,
          endTime: item.endTime,
          labels:
            item.labels?.map((label) => ({
              group: label.group || '',
              name: label.name,
            })) || undefined,
          memo: item.memo || undefined,
          actionIndex: count,
        };
      });

    setIsExporting(true);

    // 全アングルの場合は各アングルごとに書き出し
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
    } else {
      // 単一アングルまたはマルチアングルの場合
      const sourcePathForExport =
        angleOption === 'single'
          ? videoSources![selectedAngleIndex]
          : normalizeVideoSource(resolvedMultiSources.sourcePath);
      if (!sourcePathForExport) {
        info('書き出し対象の映像ソースが見つかりません');
        setIsExporting(false);
        return;
      }

      const result = await globalThis.window.electronAPI.exportClipsWithOverlay(
        {
          sourcePath: sourcePathForExport,
          sourcePath2:
            angleOption === 'multi'
              ? resolvedMultiSources.sourcePath2
              : undefined,
          mode: angleOption === 'multi' ? 'dual' : 'single',
          exportMode,
          angleOption,
          clips,
          overlay: overlaySettings,
          outputFileName: exportFileName.trim() || undefined,
        },
      );
      setIsExporting(false);
      if (result?.success) {
        info('クリップを書き出しました');
        setClipDialogOpen(false);
      } else {
        info(result?.error || 'クリップ書き出しに失敗しました');
      }
    }
  }, [
    angleOption,
    exportFileName,
    exportMode,
    exportScope,
    info,
    overlaySettings,
    selectedAngleIndex,
    selectedIds,
    secondarySource,
    timeline,
    videoSources,
    primarySource,
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
    labelDialogOpen,
    setLabelDialogOpen,
    labelGroup,
    setLabelGroup,
    labelName,
    setLabelName,
    handleApplyLabel,
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
