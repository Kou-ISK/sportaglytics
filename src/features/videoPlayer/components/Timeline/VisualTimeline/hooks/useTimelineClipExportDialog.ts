import {
  useClipExportTextPreview,
  type ClipExportTextPreviewState,
} from '../../../../../../shared/clipExport/useClipExportTextPreview';
import { useClipExportDialogState } from '../../../../../../shared/clipExport/useClipExportDialogState';
import { useCallback, useEffect, useState } from 'react';
import { sendTimelineWindowCommand } from '../../../../app/gateways/timelineWindowGateway';
import type { TimelineData } from '../../../../../../types/timeline/core';
import {
  canExportClipsWithOverlay,
  exportClipsWithOverlay,
  subscribeClipExportMenuRequest,
} from '../../../../../../shared/clipExport/clipExportGateway';
import {
  executeClipExport,
  resolveClipExportSourceSelection,
  validateClipExportSources,
} from '../../../../../../shared/clipExport/clipExportService';
import {
  type ClipExportAngleOption,
  type ClipExportMode,
  type ClipExportOverlaySettings,
  type ClipExportScope,
} from '../../../../../../shared/clipExport/clipExportTypes';
import {
  buildExportClips,
  resolveExportSourceItems,
} from './timelineExportHelpers';

interface UseTimelineClipExportDialogParams {
  timeline: TimelineData[];
  selectedIds: string[];
  videoSources?: string[];
  info: (message: string) => void;
}

interface UseTimelineClipExportDialogResult {
  clipDialogOpen: boolean;
  textPreview: ClipExportTextPreviewState;
  overlayChoice: boolean | null;
  chooseOverlay: (enabled: boolean) => void;
  setClipDialogOpen: React.Dispatch<React.SetStateAction<boolean>>;
  overlaySettings: ClipExportOverlaySettings;
  setOverlaySettings: React.Dispatch<
    React.SetStateAction<ClipExportOverlaySettings>
  >;
  primarySource: string | undefined;
  setPrimarySource: React.Dispatch<React.SetStateAction<string | undefined>>;
  secondarySource: string | undefined;
  setSecondarySource: React.Dispatch<React.SetStateAction<string | undefined>>;
  exportScope: ClipExportScope;
  setExportScope: React.Dispatch<React.SetStateAction<ClipExportScope>>;
  exportMode: ClipExportMode;
  setExportMode: React.Dispatch<React.SetStateAction<ClipExportMode>>;
  angleOption: ClipExportAngleOption;
  setAngleOption: React.Dispatch<React.SetStateAction<ClipExportAngleOption>>;
  selectedAngleIndex: number;
  setSelectedAngleIndex: React.Dispatch<React.SetStateAction<number>>;
  exportFileName: string;
  setExportFileName: React.Dispatch<React.SetStateAction<string>>;
  handleExportClips: () => Promise<void>;
}

export const useTimelineClipExportDialog = ({
  timeline,
  selectedIds,
  videoSources,
  info,
}: UseTimelineClipExportDialogParams): UseTimelineClipExportDialogResult => {
  const {
    open: clipDialogOpen,
    setOpen: setClipDialogOpen,
    overlaySettings,
    setOverlaySettings,
    overlayChoice,
    chooseOverlay,
  } = useClipExportDialogState();
  const [primarySource, setPrimarySource] = useState<string | undefined>(
    videoSources?.[0],
  );
  const [secondarySource, setSecondarySource] = useState<string | undefined>(
    videoSources?.[1],
  );
  const [exportScope, setExportScope] = useState<ClipExportScope>(
    selectedIds.length > 0 ? 'selected' : 'all',
  );
  const [exportMode, setExportMode] = useState<ClipExportMode>('single');
  const [angleOption, setAngleOption] =
    useState<ClipExportAngleOption>('single');
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

  const handleOpenClipDialog = useCallback(() => {
    setClipDialogOpen(true);
  }, [setClipDialogOpen]);

  const textPreview = useClipExportTextPreview({
    open: clipDialogOpen,
    overlayChoice,
    overlaySettings,
    angleOption,
    selectedAngleIndex,
    videoSources,
    primarySource,
    secondarySource,
    clips: buildExportClips({
      timeline,
      sourceItems: resolveExportSourceItems({
        timeline,
        selectedIds,
        exportScope,
      }),
    }),
  });

  const handleExportClips = useCallback(async () => {
    if (textPreview.blocked) {
      info('テキストのプレビューと高さ超過の表示を確認してください');
      return;
    }
    if (overlayChoice === null) {
      info('オーバーレイテキストを含めるか選択してください');
      return;
    }
    if (!canExportClipsWithOverlay()) {
      info('クリップ書き出しAPIが利用できません');
      setClipDialogOpen(false);
      return;
    }

    const resolvedSources = resolveClipExportSourceSelection(
      videoSources,
      primarySource,
      secondarySource,
    );

    const sourceValidationError = validateClipExportSources({
      angleOption,
      videoSources,
      selectedAngleIndex,
      resolvedSources,
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
    const progressId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `export-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setClipDialogOpen(false);
    const result = await executeClipExport({
      progressId,
      executeExport: exportClipsWithOverlay,
      clips,
      videoSources,
      angleOption,
      selectedAngleIndex,
      resolvedSources,
      exportMode,
      exportFileName,
      overlay: overlaySettings,
      successMessage: 'クリップを書き出しました',
    });
    if (result.success) {
      info(result.message);
      return;
    }

    info(result.message);
  }, [
    textPreview.blocked,
    angleOption,
    exportFileName,
    exportMode,
    exportScope,
    info,
    overlaySettings,
    overlayChoice,
    setClipDialogOpen,
    primarySource,
    secondarySource,
    selectedAngleIndex,
    selectedIds,
    timeline,
    videoSources,
  ]);

  useEffect(() => {
    const unsubscribe = subscribeClipExportMenuRequest(() => {
      void handleOpenClipDialog();
    });
    // did-finish-load precedes React/data readiness; announce only after subscribing.
    sendTimelineWindowCommand({ type: 'clip-export-ready', ready: true });
    return () => {
      sendTimelineWindowCommand({ type: 'clip-export-ready', ready: false });
      unsubscribe();
    };
  }, [handleOpenClipDialog]);

  return {
    clipDialogOpen,
    textPreview,
    overlayChoice,
    chooseOverlay,
    setClipDialogOpen,
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
