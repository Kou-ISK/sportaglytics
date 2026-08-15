import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Box } from '@mui/material';
import {
  AnalysisPanel,
  CodingPanelRuntime,
  type EnhancedCodePanelHandle,
} from '..';
import { useVideoPlayerScreenController } from './hooks/useVideoPlayerScreenController';
import { useSettings } from '../../../hooks/useSettings';
import { useGlobalHotkeys } from '../../../hooks/useGlobalHotkeys';
import { useActionPreset } from '../../../contexts/ActionPresetContext';
import { ErrorSnackbar } from './components/ErrorSnackbar';
import { SyncAnalysisBackdrop } from './components/SyncAnalysisBackdrop';
import { useSyncMenuHandlers } from './hooks/useSyncMenuHandlers';
import { useTimelineExportImport } from './hooks/useTimelineExportImport';
import { useRawTimelineCsvExport } from '../analysis/hooks/useRawTimelineCsvExport';
import { OnboardingTutorial } from '../../../components/OnboardingTutorial';
import { useHotkeyBindings } from './hooks/useHotkeyBindings';
import { useManualSyncSeek } from './hooks/useManualSyncSeek';
import { usePlaylistIntegration } from './hooks/usePlaylistIntegration';
import { VideoPlayerLayout } from './components/VideoPlayerLayout';
import { useAnalysisIntegration } from './hooks/useAnalysisIntegration';
import { useMetadataTeamNames } from './hooks/useMetadataTeamNames';
import { buildSelectionLabelUpdates } from './utils/applyLabelsToTimelineSelection';
import type { CodeWindowLayout } from '../../../types/settings/coreTypes';
import type { SCLabel } from '../../../types/timeline/sportscode';
import { subscribeCreateVideoPackageMenu } from './gateways/menuEventGateway';
import { useTimelineWindowIntegration } from './hooks/useTimelineWindowIntegration';
import { useContinuousReversePlayback } from '../../../hooks/useContinuousReversePlayback';
import { getMinAllowedGlobalTime } from './hooks/useVideoTimeController';

export const VideoPlayerScreen = () => {
  const {
    timeline,
    timelineRows,
    setTimeline,
    selectedTimelineIdList,
    setSelectedTimelineIdList,
    videoList,
    setVideoList,
    currentTime,
    setCurrentTime,
    setTimelineFilePath,
    metaDataConfigFilePath,
    setMetaDataConfigFilePath,
    teamNames,
    setTeamNames,
    isFileSelected,
    setIsFileSelected,
    maxSec,
    setMaxSec,
    isVideoPlaying,
    setisVideoPlaying,
    videoPlayBackRate,
    setVideoPlayBackRate,
    syncData,
    setSyncData,
    mediaAngles,
    setMediaAngles,
    syncMode,
    setSyncMode,
    handleCurrentTime,
    setPackagePath,
    addTimelineData,
    addTimelineRow,
    updateTimelineRow,
    moveTimelineRow,
    deleteTimelineRows,
    pasteTimelineItemsToRow,
    deleteTimelineDatas,
    updateMemo,
    updateTimelineRange,
    updateTimelineItem,
    bulkUpdateTimelineItems,
    duplicateTimelineItem,
    resyncAudio,
    resetSync,
    manualSyncFromPlayers,
    cancelManualSync,
    playerForceUpdateKey,
    error,
    setError,
    isAnalyzing,
    syncProgress,
    syncStage,
    performUndo,
    performRedo,
  } = useVideoPlayerScreenController();

  const [viewMode, setViewMode] = useState<'dual' | 'angle1' | 'angle2'>(
    'dual',
  );
  const [openWizardRequestKey, setOpenWizardRequestKey] = useState(0);

  useEffect(() => {
    return subscribeCreateVideoPackageMenu(() => {
      setOpenWizardRequestKey((current) => current + 1);
      setIsFileSelected(false);
    });
  }, [setIsFileSelected]);

  useMetadataTeamNames({ metaDataConfigFilePath, setTeamNames });
  useManualSyncSeek({ syncMode, syncData, videoList });

  // ホットキー設定を読み込み
  const { settings } = useSettings();
  const { activeActions } = useActionPreset();
  const [activeRuntimeCodeWindow, setActiveRuntimeCodeWindow] =
    useState<CodeWindowLayout | null>(null);
  const activeCodeWindow =
    (activeRuntimeCodeWindow ??
      settings.codingPanel?.codeWindows?.find(
        (l) => l.id === settings.codingPanel?.activeCodeWindowId,
      )) ||
    settings.codingPanel?.codeWindows?.[0];

  const codingPanelRuntimeRef = useRef<EnhancedCodePanelHandle | null>(null);

  const { startReversePlayback, stopReversePlayback } =
    useContinuousReversePlayback({
      currentTime,
      minimumTime: getMinAllowedGlobalTime(syncData),
      onPause: () => {
        setVideoPlayBackRate(1);
        setisVideoPlaying(false);
      },
      onSeek: (time) => handleCurrentTime(new Event('reverse-playback'), time),
    });

  // 手動同期適用ハンドラ
  const handleApplyManualSync = useCallback(async () => {
    await manualSyncFromPlayers();
  }, [manualSyncFromPlayers]);

  const {
    analysisOpen,
    setAnalysisOpen,
    analysisView,
    setAnalysisView,
    openAnalysisWindow,
    handleJumpToSegment,
    handleCreateAiPlaylist,
  } = useAnalysisIntegration({
    timeline,
    teamNames,
    videoList,
    handleCurrentTime,
    setIsVideoPlaying: setisVideoPlaying,
  });

  const { combinedHotkeys, combinedHandlers, keyUpHandlers } =
    useHotkeyBindings({
      teamNames,
      settingsHotkeys: settings.hotkeys,
      activeActions,
      codeWindowButtons: activeCodeWindow?.buttons,
      timelineActionRef: codingPanelRuntimeRef,
      setVideoPlayBackRate,
      setIsVideoPlaying: setisVideoPlaying,
      setViewMode,
      startReversePlayback,
      stopReversePlayback,
      performUndo,
      performRedo,
      resyncAudio,
      resetSync,
      manualSyncFromPlayers,
      setSyncMode,
      onAnalyze: () => {
        void openAnalysisWindow();
      },
      selectedTimelineIdList,
      deleteTimelineDatas,
      clearSelection: () => setSelectedTimelineIdList([]),
    });

  // グローバルホットキーを登録（ウィンドウフォーカス時のみ有効）
  useGlobalHotkeys(combinedHotkeys, combinedHandlers, keyUpHandlers);

  useSyncMenuHandlers({
    onResyncAudio: resyncAudio,
    onResetSync: resetSync,
    onManualSync: manualSyncFromPlayers,
    onSetSyncMode: setSyncMode,
  });

  useTimelineExportImport({ timeline, setTimeline });
  useRawTimelineCsvExport({ timeline });

  const { handleAddToPlaylist } = usePlaylistIntegration({
    currentTime,
    videoList,
    handleCurrentTime,
    setIsVideoPlaying: setisVideoPlaying,
  });

  useTimelineWindowIntegration({
    isFileSelected,
    timeline,
    rows: timelineRows,
    maxSec,
    currentTime,
    isPlaying: isVideoPlaying,
    playbackRate: videoPlayBackRate,
    selectedIds: selectedTimelineIdList,
    teamNames,
    videoSources: videoList,
    hotkeys: combinedHotkeys,
    hotkeyHandlers: combinedHandlers,
    hotkeyKeyUpHandlers: keyUpHandlers,
    onSeek: (time) =>
      handleCurrentTime(new Event('timeline-window-seek'), time),
    onSelectionChange: setSelectedTimelineIdList,
    onDeleteItems: deleteTimelineDatas,
    onUpdateMemo: updateMemo,
    onUpdateRange: updateTimelineRange,
    onUpdateItem: updateTimelineItem,
    onBulkUpdateItems: bulkUpdateTimelineItems,
    onDuplicateItem: duplicateTimelineItem,
    onCreateItem: (actionName, startTime, endTime, color) =>
      addTimelineData(
        actionName,
        startTime,
        endTime,
        '',
        undefined,
        undefined,
        undefined,
        color,
      ),
    onAddRow: addTimelineRow,
    onUpdateRow: updateTimelineRow,
    onMoveRow: moveTimelineRow,
    onDeleteRows: deleteTimelineRows,
    onPasteItems: pasteTimelineItemsToRow,
    onUndo: performUndo,
    onRedo: performRedo,
    onAddToPlaylist: (items) => void handleAddToPlaylist(items),
  });

  const firstTeamName = React.useMemo(() => {
    if (timeline.length === 0) return teamNames[0];
    const sortedActionNames = [
      ...new Set(timeline.map((item) => item.actionName)),
    ].sort((left, right) => left.localeCompare(right));
    return sortedActionNames[0]?.split(' ')[0] || teamNames[0];
  }, [teamNames, timeline]);

  const handleApplyLabelsToTimeline = useCallback(
    (ids: string[], labels: { name: string; group: string }[]): void => {
      for (const update of buildSelectionLabelUpdates(timeline, ids, labels)) {
        bulkUpdateTimelineItems([update.id], { labels: update.labels });
      }
    },
    [bulkUpdateTimelineItems, timeline],
  );

  const selectedTimelineLabels = React.useMemo<SCLabel[]>(() => {
    if (selectedTimelineIdList.length === 0) return [];

    const selectedItems = selectedTimelineIdList
      .map((id) => timeline.find((item) => item.id === id))
      .filter((item) => item !== undefined);
    if (selectedItems.length !== selectedTimelineIdList.length) return [];

    const [firstItem, ...restItems] = selectedItems;
    return (firstItem.labels ?? []).filter((label) =>
      restItems.every((item) =>
        (item.labels ?? []).some(
          (entry) => entry.name === label.name && entry.group === label.group,
        ),
      ),
    );
  }, [selectedTimelineIdList, timeline]);

  const handleCodingWindowHotkeyKeyDown = useCallback(
    (hotkeyId: string): void => {
      combinedHandlers[hotkeyId]?.();
    },
    [combinedHandlers],
  );

  const handleCodingWindowHotkeyKeyUp = useCallback(
    (hotkeyId: string): void => {
      keyUpHandlers[hotkeyId as keyof typeof keyUpHandlers]?.();
    },
    [keyUpHandlers],
  );

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        minWidth: 0,
        overflow: 'hidden',
      }}
    >
      <VideoPlayerLayout
        openWizardRequestKey={openWizardRequestKey}
        isFileSelected={isFileSelected}
        videoList={videoList}
        isVideoPlaying={isVideoPlaying}
        videoPlayBackRate={videoPlayBackRate}
        currentTime={currentTime}
        setCurrentTime={setCurrentTime}
        setisVideoPlaying={setisVideoPlaying}
        setVideoPlayBackRate={setVideoPlayBackRate}
        setMaxSec={setMaxSec}
        handleCurrentTime={handleCurrentTime}
        maxSec={maxSec}
        syncData={syncData}
        syncMode={syncMode}
        playerForceUpdateKey={playerForceUpdateKey}
        viewMode={viewMode}
        setVideoList={setVideoList}
        setIsFileSelected={setIsFileSelected}
        setTimelineFilePath={setTimelineFilePath}
        setPackagePath={setPackagePath}
        metaDataConfigFilePath={metaDataConfigFilePath}
        setMetaDataConfigFilePath={setMetaDataConfigFilePath}
        setSyncData={setSyncData}
        mediaAngles={mediaAngles}
        setMediaAngles={setMediaAngles}
        onApplyManualSync={handleApplyManualSync}
        onCancelManualSync={() => {
          void cancelManualSync();
        }}
      />
      <CodingPanelRuntime
        ref={codingPanelRuntimeRef}
        addTimelineData={addTimelineData}
        teamNames={teamNames}
        firstTeamName={firstTeamName}
        selectedIds={selectedTimelineIdList}
        selectedTimelineLabels={selectedTimelineLabels}
        onApplyLabels={handleApplyLabelsToTimeline}
        windowHotkeys={combinedHotkeys}
        onHotkeyKeyDown={handleCodingWindowHotkeyKeyDown}
        onHotkeyKeyUp={handleCodingWindowHotkeyKeyUp}
        onActiveLayoutChange={setActiveRuntimeCodeWindow}
      />
      <AnalysisPanel
        open={analysisOpen}
        onClose={() => setAnalysisOpen(false)}
        view={analysisView}
        onViewChange={setAnalysisView}
        timeline={timeline}
        teamNames={teamNames}
        onJumpToSegment={handleJumpToSegment}
        onCreateAiPlaylist={handleCreateAiPlaylist}
      />

      <ErrorSnackbar error={error} onClose={() => setError(null)} />
      <SyncAnalysisBackdrop
        open={isAnalyzing}
        progress={syncProgress}
        stage={syncStage}
      />
      <OnboardingTutorial />
    </Box>
  );
};
