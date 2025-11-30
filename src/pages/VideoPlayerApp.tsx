import React, { useState, useRef } from 'react';
import { Box } from '@mui/material';
import {
  StatsModal,
  StatsView,
} from '../features/videoPlayer/components/Analytics/StatsModal/StatsModal';
import { useVideoPlayerApp } from '../hooks/useVideoPlayerApp';
import { useSettings } from '../hooks/useSettings';
import { useGlobalHotkeys } from '../hooks/useGlobalHotkeys';
import { useActionPreset } from '../contexts/ActionPresetContext';
import { TimelineData } from '../types/TimelineData';
import { PlayerSurface } from './videoPlayer/components/PlayerSurface';
import {
  TimelineActionSection,
  type TimelineActionSectionHandle,
} from './videoPlayer/components/TimelineActionSection';
import { NoSelectionPlaceholder } from './videoPlayer/components/NoSelectionPlaceholder';
import { ErrorSnackbar } from './videoPlayer/components/ErrorSnackbar';
import { SyncAnalysisBackdrop } from './videoPlayer/components/SyncAnalysisBackdrop';
import { useSyncMenuHandlers } from './videoPlayer/hooks/useSyncMenuHandlers';
import { useStatsMenuHandlers } from './videoPlayer/hooks/useStatsMenuHandlers';
import { useTimelineExportImport } from './videoPlayer/hooks/useTimelineExportImport';
import { OnboardingTutorial } from '../components/OnboardingTutorial';
import { useHotkeyBindings } from './videoPlayer/hooks/useHotkeyBindings';

export const VideoPlayerApp = () => {
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
    updateQualifier,
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

  const [statsOpen, setStatsOpen] = useState(false);
  const [statsView, setStatsView] = useState<StatsView>('possession');

  // ホットキー設定を読み込み
  const { settings } = useSettings();
  const { activeActions } = useActionPreset();

  // TimelineActionSectionへのrefを作成
  const timelineActionRef = useRef<TimelineActionSectionHandle>(null);

  const { combinedHotkeys, combinedHandlers, keyUpHandlers } =
    useHotkeyBindings({
      currentTime,
      isVideoPlaying,
      teamNames,
      settingsHotkeys: settings.hotkeys,
      activeActions,
      timelineActionRef,
      setVideoPlayBackRate,
      setIsVideoPlaying: setisVideoPlaying,
      handleCurrentTime,
      performUndo,
      performRedo,
      resyncAudio,
      resetSync,
      manualSyncFromPlayers,
      setSyncMode,
      onAnalyze: () => setStatsOpen(true),
    });

  // グローバルホットキーを登録（ウィンドウフォーカス時のみ有効）
  useGlobalHotkeys(combinedHotkeys, combinedHandlers, keyUpHandlers);

  useSyncMenuHandlers({
    onResyncAudio: resyncAudio,
    onResetSync: resetSync,
    onManualSync: manualSyncFromPlayers,
    onSetSyncMode: setSyncMode,
  });

  useStatsMenuHandlers({ setStatsOpen, setStatsView });

  useTimelineExportImport({ timeline, setTimeline });

  const handleJumpToSegment = (segment: TimelineData) => {
    const targetTime = Math.max(0, segment.startTime);
    handleCurrentTime(new Event('matrix-jump'), targetTime);
    setisVideoPlaying(true);
    setStatsOpen(false);
  };

  return (
    <Box
      sx={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      {isFileSelected ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr', // 1列
            gridTemplateRows: 'auto minmax(250px, 1fr)', // 上: 映像（比率に応じて可変）、下: タイムライン+アクション（250px以上で可変）
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* 上: 映像プレイヤー */}
          <PlayerSurface
            videoList={videoList}
            isVideoPlaying={isVideoPlaying}
            videoPlayBackRate={videoPlayBackRate}
            currentTime={currentTime}
            setCurrentTime={setCurrentTime}
            setIsVideoPlaying={setisVideoPlaying}
            setVideoPlayBackRate={setVideoPlayBackRate}
            setMaxSec={setMaxSec}
            handleCurrentTime={handleCurrentTime}
            maxSec={maxSec}
            syncData={syncData}
            syncMode={syncMode}
            playerForceUpdateKey={playerForceUpdateKey}
          />

          <TimelineActionSection
            ref={timelineActionRef}
            timeline={timeline}
            maxSec={maxSec}
            currentTime={currentTime}
            selectedTimelineIdList={selectedTimelineIdList}
            metaDataConfigFilePath={metaDataConfigFilePath}
            teamNames={teamNames}
            setSelectedTimelineIdList={setSelectedTimelineIdList}
            setTeamNames={setTeamNames}
            addTimelineData={addTimelineData}
            deleteTimelineDatas={deleteTimelineDatas}
            updateQualifier={updateQualifier}
            updateTimelineRange={updateTimelineRange}
            updateTimelineItem={updateTimelineItem}
            bulkUpdateTimelineItems={bulkUpdateTimelineItems}
            handleCurrentTime={handleCurrentTime}
            performUndo={performUndo}
            performRedo={performRedo}
          />
        </Box>
      ) : (
        <NoSelectionPlaceholder
          setVideoList={setVideoList}
          setIsFileSelected={setIsFileSelected}
          setTimelineFilePath={setTimelineFilePath}
          setPackagePath={setPackagePath}
          setMetaDataConfigFilePath={setMetaDataConfigFilePath}
          setSyncData={setSyncData}
        />
      )}
      <StatsModal
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
        view={statsView}
        onViewChange={setStatsView}
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
