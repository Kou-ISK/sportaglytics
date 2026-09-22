import {
  angleIndexForHotkey,
  angleIndexForView,
} from '../../../shared/media/angleView';
import type { VideoViewMode } from '../../../shared/media/angleView';
import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
} from 'react';
import { Box } from '@mui/material';
import {
  AnalysisPanel,
  CodingPanelRuntime,
  type EnhancedCodePanelHandle,
} from '..';
import { useVideoPlayerScreenController } from './hooks/useVideoPlayerScreenController';
import { useLiveCapturePlayback } from './hooks/useLiveCapturePlayback';
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
import { useAngleSyncSession } from './hooks/sync/useAngleSyncSession';
import { useClipSyncCommands } from './hooks/sync/useClipSyncCommands';
import { usePlaylistIntegration } from './hooks/usePlaylistIntegration';
import { VideoPlayerLayout } from './components/VideoPlayerLayout';
import { useAnalysisIntegration } from './hooks/useAnalysisIntegration';
import { useMetadataTeamNames } from './hooks/useMetadataTeamNames';
import { buildSelectionLabelUpdates } from './utils/applyLabelsToTimelineSelection';
import type { CodeWindowLayout } from '../../../types/settings/coreTypes';
import type { SCLabel } from '../../../types/timeline/sportscode';
import { subscribeCreateVideoPackageMenu } from './gateways/menuEventGateway';
import { useTimelineWindowIntegration } from './hooks/useTimelineWindowIntegration';
import { useTimelineActionPresentationSync } from './hooks/useTimelineActionPresentationSync';
import { useContinuousReversePlayback } from '../../../hooks/useContinuousReversePlayback';
import { getMinAllowedGlobalTime } from './hooks/useVideoTimeController';
import { useEventDetectionWindowHost } from '../eventDetection/hooks/useEventDetectionWindowHost';
import { useEventDetectionController } from '../eventDetection/hooks/useEventDetectionController';
import { useNotification } from '../../../contexts/NotificationContext';
import {
  loadPackageDirectory,
  releasePackageSessionReservation,
  subscribeToPackageDirectoryOpen,
  toPackageLoadErrorMessage,
} from '../components/Setup/VideoPathSelector/gateway/packageGateway';

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
    packagePath,
    addTimelineData,
    addTimelineDatas,
    addTimelineRow,
    updateTimelineRow,
    moveTimelineRow,
    deleteTimelineRows,
    pasteTimelineItemsToRow,
    synchronizeTimelineActionColors,
    deleteTimelineDatas,
    updateMemo,
    updateTimelineRange,
    updateTimelineItem,
    bulkUpdateTimelineItems,
    duplicateTimelineItem,
    splitTimelineItem,
    mergeTimelineItems,
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
  const { notify } = useNotification();
  const liveCapture = useLiveCapturePlayback({
    packagePath,
    currentTime,
    isPlaying: isVideoPlaying,
    maxSec,
    setMediaAngles,
    setVideoList,
    onSeek: handleCurrentTime,
    setPlaying: setisVideoPlaying,
    setRate: setVideoPlayBackRate,
  });

  const [viewMode, setViewMode] = useState<VideoViewMode>('dual');
  const [openWizardRequestKey, setOpenWizardRequestKey] = useState(0);

  // This listener belongs to the screen lifecycle, not the setup selector.
  // The selector is intentionally unmounted after a package is loaded, while
  // Finder/Explorer opens must continue to route to this package session.
  const handleExternalPackageOpen = useCallback(
    async (packagePath: string): Promise<void> => {
      try {
        const loadedPackage = await loadPackageDirectory(packagePath);
        setVideoList(loadedPackage.result.videoList);
        setSyncData(loadedPackage.result.syncData);
        setTimelineFilePath(loadedPackage.result.timelinePath);
        setMetaDataConfigFilePath(loadedPackage.result.metaDataConfigFilePath);
        setMediaAngles(loadedPackage.result.mediaAngles ?? []);
        setPackagePath(loadedPackage.result.packagePath ?? packagePath);
        setIsFileSelected(true);
        notify({ message: 'パッケージを開きました', severity: 'success' });
      } catch (error) {
        await releasePackageSessionReservation(packagePath);
        console.error('Failed to open external package:', error);
        notify({
          message: toPackageLoadErrorMessage(error),
          severity: 'error',
        });
      }
    },
    [
      notify,
      setIsFileSelected,
      setMediaAngles,
      setMetaDataConfigFilePath,
      setPackagePath,
      setSyncData,
      setTimelineFilePath,
      setVideoList,
    ],
  );

  useEffect(() => {
    if (!isFileSelected) return undefined;
    return subscribeToPackageDirectoryOpen((packagePath) => {
      void handleExternalPackageOpen(packagePath);
    });
  }, [handleExternalPackageOpen, isFileSelected]);

  useEffect(() => {
    return subscribeCreateVideoPackageMenu(() => {
      setOpenWizardRequestKey((current) => current + 1);
      setIsFileSelected(false);
    });
  }, [setIsFileSelected]);

  useMetadataTeamNames({ metaDataConfigFilePath, setTeamNames });

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

  useTimelineActionPresentationSync({
    activeCodeWindow,
    timeline,
    rows: timelineRows,
    onSynchronize: synchronizeTimelineActionColors,
  });

  const { viewProps: eventDetectionViewProps } = useEventDetectionController({
    mediaAngles,
    timeline,
    maxTime: maxSec,
    activeCodeWindow,
    addTimelineDatas,
  });
  useEventDetectionWindowHost(eventDetectionViewProps);

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

  const { requestClipSync, changeSyncMode } = useClipSyncCommands({
    captureActive: Boolean(liveCapture.timelineState),
    mediaAngles,
    syncMode,
    setSyncMode,
    setIsVideoPlaying: setisVideoPlaying,
    manualSyncFromPlayers,
  });

  // 手動同期適用ハンドラ
  const handleApplyManualSync = useCallback(async () => {
    await cancelManualSync();
  }, [cancelManualSync]);

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
      onGoLive: liveCapture.goLive,
      teamNames,
      settingsHotkeys: settings.hotkeys,
      activeActions,
      codeWindowButtons: activeCodeWindow?.buttons,
      timelineActionRef: codingPanelRuntimeRef,
      isVideoPlaying,
      videoPlayBackRate,
      setVideoPlayBackRate,
      setIsVideoPlaying: setisVideoPlaying,
      setViewMode,
      startReversePlayback,
      stopReversePlayback,
      performUndo,
      performRedo,
      resyncAudio,
      resetSync,
      manualSyncFromPlayers: requestClipSync,
      setSyncMode: changeSyncMode,
      onAnalyze: () => {
        void openAnalysisWindow();
      },
      selectedTimelineIdList,
      deleteTimelineDatas,
      clearSelection: () => setSelectedTimelineIdList([]),
    });

  // グローバルホットキーを登録（ウィンドウフォーカス時のみ有効）
  const workspaceHotkeys = useMemo(
    () =>
      syncMode === 'manual'
        ? combinedHotkeys.filter(
            (hotkey) =>
              ['manual-sync', 'toggle-manual-mode'].includes(hotkey.id) ||
              angleIndexForHotkey(hotkey.id) !== null,
          )
        : combinedHotkeys,
    [combinedHotkeys, syncMode],
  );
  useGlobalHotkeys(workspaceHotkeys, combinedHandlers, keyUpHandlers);

  useSyncMenuHandlers({
    onResyncAudio: resyncAudio,
    onResetSync: resetSync,
    onManualSync: requestClipSync,
    onSetSyncMode: changeSyncMode,
  });

  useTimelineExportImport({ timeline, setTimeline });
  useRawTimelineCsvExport({ timeline });

  const { handleAddToPlaylist } = usePlaylistIntegration({
    currentTime,
    videoList,
    handleCurrentTime,
    setIsVideoPlaying: setisVideoPlaying,
  });

  const angleSync = useAngleSyncSession(
    {
      mediaAngles,
      syncData,
      initialTime: currentTime,
      metaDataConfigFilePath,
      setMediaAngles,
      setVideoList,
      setSyncData,
      onApplySync: handleApplyManualSync,
      onCancel: () => {
        void cancelManualSync();
      },
    },
    syncMode === 'manual',
    settings.hotkeys,
    angleIndexForView(viewMode),
  );

  useTimelineWindowIntegration({
    liveCapture: liveCapture.timelineState,
    onGoLive: liveCapture.goLive,
    isFileSelected,
    timeline,
    rows: timelineRows,
    angleSync: angleSync.snapshot,
    onAngleSyncCommand: angleSync.command,
    maxSec: angleSync.snapshot ? angleSync.maxSec : maxSec,
    currentTime: angleSync.snapshot ? angleSync.currentTime : currentTime,
    isPlaying: angleSync.snapshot
      ? angleSync.transport.playing
      : isVideoPlaying,
    playbackRate: videoPlayBackRate,
    selectedIds: selectedTimelineIdList,
    teamNames,
    videoSources: videoList,
    hotkeys: workspaceHotkeys,
    hotkeyHandlers: combinedHandlers,
    hotkeyKeyUpHandlers: keyUpHandlers,
    onSeek: (time) =>
      angleSync.snapshot
        ? angleSync.transport.seek(time)
        : handleCurrentTime(new Event('timeline-window-seek'), time),
    onSelectionChange: setSelectedTimelineIdList,
    onDeleteItems: deleteTimelineDatas,
    onUpdateMemo: updateMemo,
    onUpdateRange: updateTimelineRange,
    onUpdateItem: updateTimelineItem,
    onBulkUpdateItems: bulkUpdateTimelineItems,
    onDuplicateItem: duplicateTimelineItem,
    onSplitItem: splitTimelineItem,
    onMergeItems: mergeTimelineItems,
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
        livePlaybackEnd={liveCapture.timelineState?.availableEndSeconds}
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
        setMetaDataConfigFilePath={setMetaDataConfigFilePath}
        setSyncData={setSyncData}
        mediaAngles={mediaAngles}
        setMediaAngles={setMediaAngles}
        angleSync={angleSync}
      />
      <CodingPanelRuntime
        ref={codingPanelRuntimeRef}
        codingTime={isFileSelected && !angleSync.snapshot ? currentTime : null}
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
