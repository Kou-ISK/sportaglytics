import React, { useState, useRef, useCallback } from 'react';
import { Box } from '@mui/material';
import { AnalysisPanel } from '..';
import { useVideoPlayerScreenController } from './hooks/useVideoPlayerScreenController';
import { useSettings } from '../../../hooks/useSettings';
import { useGlobalHotkeys } from '../../../hooks/useGlobalHotkeys';
import { useActionPreset } from '../../../contexts/ActionPresetContext';
import type { TimelineActionSectionHandle } from './components/TimelineActionSection';
import { ErrorSnackbar } from './components/ErrorSnackbar';
import { SyncAnalysisBackdrop } from './components/SyncAnalysisBackdrop';
import { useSyncMenuHandlers } from './hooks/useSyncMenuHandlers';
import { useTimelineExportImport } from './hooks/useTimelineExportImport';
import { useRawTimelineCsvExport } from '../../../hooks/useRawTimelineCsvExport';
import { OnboardingTutorial } from '../../../components/OnboardingTutorial';
import { useHotkeyBindings } from './hooks/useHotkeyBindings';
import { useManualSyncSeek } from './hooks/useManualSyncSeek';
import { useTimelineKeyboardShortcuts } from './hooks/useTimelineKeyboardShortcuts';
import { usePlaylistIntegration } from './hooks/usePlaylistIntegration';
import { VideoPlayerLayout } from './components/VideoPlayerLayout';
import { useAnalysisIntegration } from './hooks/useAnalysisIntegration';

export const VideoPlayerScreen = () => {
  const {
    timeline,
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
    syncMode,
    setSyncMode,
    handleCurrentTime,
    setPackagePath,
    addTimelineData,
    deleteTimelineDatas,
    updateMemo,
    updateTimelineRange,
    updateTimelineItem,
    bulkUpdateTimelineItems,
    resyncAudio,
    resetSync,
    manualSyncFromPlayers,
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

  useManualSyncSeek({ syncMode, syncData, videoList });

  // ホットキー設定を読み込み
  const { settings } = useSettings();
  const { activeActions } = useActionPreset();
  const activeCodeWindow =
    settings.codingPanel?.codeWindows?.find(
      (l) => l.id === settings.codingPanel?.activeCodeWindowId,
    ) || settings.codingPanel?.codeWindows?.[0];

  // TimelineActionSectionへのrefを作成
  const timelineActionRef = useRef<TimelineActionSectionHandle | null>(null);

  // 手動同期適用ハンドラ
  const handleApplyManualSync = useCallback(async () => {
    await manualSyncFromPlayers();
  }, [manualSyncFromPlayers]);

  // 手動同期キャンセルハンドラ
  const handleCancelManualSync = useCallback(() => {
    setSyncMode('auto');
    if (!window.electronAPI?.setManualModeChecked) return;
    window.electronAPI.setManualModeChecked(false).catch((error) => {
      console.debug('手動同期モード解除の更新に失敗しました。', error);
    });
  }, [setSyncMode]);

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
      currentTime,
      isVideoPlaying,
      teamNames,
      settingsHotkeys: settings.hotkeys,
      activeActions,
      codeWindowButtons: activeCodeWindow?.buttons,
      timelineActionRef,
      setVideoPlayBackRate,
      setIsVideoPlaying: setisVideoPlaying,
      setViewMode,
      handleCurrentTime,
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

  useTimelineKeyboardShortcuts({
    selectedTimelineIdList,
    deleteTimelineDatas,
    setSelectedTimelineIdList,
    performUndo,
    performRedo,
  });

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

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <VideoPlayerLayout
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
        timelineActionRef={timelineActionRef}
        timeline={timeline}
        selectedTimelineIdList={selectedTimelineIdList}
        metaDataConfigFilePath={metaDataConfigFilePath}
        teamNames={teamNames}
        setSelectedTimelineIdList={setSelectedTimelineIdList}
        setTeamNames={setTeamNames}
        addTimelineData={addTimelineData}
        deleteTimelineDatas={deleteTimelineDatas}
        updateMemo={updateMemo}
        updateTimelineRange={updateTimelineRange}
        updateTimelineItem={updateTimelineItem}
        bulkUpdateTimelineItems={bulkUpdateTimelineItems}
        setVideoList={setVideoList}
        setIsFileSelected={setIsFileSelected}
        setTimelineFilePath={setTimelineFilePath}
        setPackagePath={setPackagePath}
        setMetaDataConfigFilePath={setMetaDataConfigFilePath}
        setSyncData={setSyncData}
        performUndo={performUndo}
        performRedo={performRedo}
        onApplyManualSync={handleApplyManualSync}
        onCancelManualSync={handleCancelManualSync}
        onAddToPlaylist={handleAddToPlaylist}
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

export default VideoPlayerScreen;
