import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Box } from '@mui/material';
import {
  AnalysisPanel,
  AnalysisView,
} from '../features/videoPlayer/components/Analytics/AnalysisPanel/AnalysisPanel';
import { useVideoPlayerApp } from '../hooks/useVideoPlayerApp';
import { useSettings } from '../hooks/useSettings';
import { useGlobalHotkeys } from '../hooks/useGlobalHotkeys';
import { useActionPreset } from '../contexts/ActionPresetContext';
import { PlaylistProvider } from '../contexts/PlaylistContext';
import { TimelineData } from '../types/TimelineData';
import type { TimelineActionSectionHandle } from './videoPlayer/components/TimelineActionSection';
import { ErrorSnackbar } from './videoPlayer/components/ErrorSnackbar';
import { SyncAnalysisBackdrop } from './videoPlayer/components/SyncAnalysisBackdrop';
import { useSyncMenuHandlers } from './videoPlayer/hooks/useSyncMenuHandlers';
import { useAnalysisMenuHandlers } from './videoPlayer/hooks/useAnalysisMenuHandlers';
import { useTimelineExportImport } from './videoPlayer/hooks/useTimelineExportImport';
import { OnboardingTutorial } from '../components/OnboardingTutorial';
import { useHotkeyBindings } from './videoPlayer/hooks/useHotkeyBindings';
import { useManualSyncSeek } from './videoPlayer/hooks/useManualSyncSeek';
import { useTimelineKeyboardShortcuts } from './videoPlayer/hooks/useTimelineKeyboardShortcuts';
import { usePlaylistIntegration } from './videoPlayer/hooks/usePlaylistIntegration';
import { VideoPlayerLayout } from './videoPlayer/components/VideoPlayerLayout';

const VideoPlayerAppContent = () => {
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
  } = useVideoPlayerApp();

  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisView, setAnalysisView] = useState<AnalysisView>('dashboard');
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

  const openAnalysisWindow = useCallback(
    async (nextView?: AnalysisView) => {
      const resolvedView = nextView ?? analysisView;
      setAnalysisView(resolvedView);
      const analysisApi = window.electronAPI?.analysis;
      if (analysisApi?.openWindow) {
        await analysisApi.openWindow();
        analysisApi.syncToWindow({
          timeline,
          teamNames,
          view: resolvedView,
        });
        setAnalysisOpen(false);
        return;
      }
      setAnalysisOpen(true);
    },
    [analysisView, timeline, teamNames],
  );

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

  useAnalysisMenuHandlers({
    onOpenAnalysis: (view) => {
      void openAnalysisWindow(view);
    },
  });

  useTimelineExportImport({ timeline, setTimeline });

  const handleJumpToSegment = useCallback(
    (segment: TimelineData) => {
      const targetTime = Math.max(0, segment.startTime);
      handleCurrentTime(new Event('matrix-jump'), targetTime);
      setisVideoPlaying(true);
      setAnalysisOpen(false);
    },
    [handleCurrentTime, setisVideoPlaying],
  );

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.on) return;
    const handler = (_event: unknown, segment: TimelineData) => {
      handleJumpToSegment(segment);
    };
    api.on('analysis:jump-to-segment', handler);
    return () => api.off?.('analysis:jump-to-segment', handler);
  }, [handleJumpToSegment]);

  useEffect(() => {
    const analysisApi = window.electronAPI?.analysis;
    if (!analysisApi?.syncToWindow) return;
    analysisApi.syncToWindow({ timeline, teamNames });
  }, [timeline, teamNames]);

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

/**
 * VideoPlayerApp - PlaylistProviderでラップされたメインコンポーネント
 */
export const VideoPlayerApp = () => {
  return (
    <PlaylistProvider>
      <VideoPlayerAppContent />
    </PlaylistProvider>
  );
};
