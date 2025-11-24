import React, { useState, useMemo } from 'react';
import { Box } from '@mui/material';
import {
  StatsModal,
  StatsView,
} from '../features/videoPlayer/components/Analytics/StatsModal/StatsModal';
import { useVideoPlayerApp } from '../hooks/useVideoPlayerApp';
import { useSettings } from '../hooks/useSettings';
import { useGlobalHotkeys } from '../hooks/useGlobalHotkeys';
import { TimelineData } from '../types/TimelineData';
import { PlayerSurface } from './videoPlayer/components/PlayerSurface';
import { TimelineActionSection } from './videoPlayer/components/TimelineActionSection';
import { NoSelectionPlaceholder } from './videoPlayer/components/NoSelectionPlaceholder';
import { ErrorSnackbar } from './videoPlayer/components/ErrorSnackbar';
import { SyncAnalysisBackdrop } from './videoPlayer/components/SyncAnalysisBackdrop';
import { useSyncMenuHandlers } from './videoPlayer/hooks/useSyncMenuHandlers';
import { useStatsMenuHandlers } from './videoPlayer/hooks/useStatsMenuHandlers';
import { useTimelineExportImport } from './videoPlayer/hooks/useTimelineExportImport';
import { OnboardingTutorial } from '../components/OnboardingTutorial';

export const VideoPlayerApp = () => {
  const {
    timeline,
    setTimeline,
    selectedTimelineIdList,
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
    updateActionResult,
    updateActionType,
    updateTimelineRange,
    updateTimelineItem,
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

  // ホットキーハンドラーを定義
  const hotkeyHandlers = useMemo(
    () => ({
      'skip-forward-small': () => {
        console.log('[HOTKEY] 0.5倍速再生');
        setVideoPlayBackRate(0.5);
        setisVideoPlaying(true);
      },
      'skip-forward-medium': () => {
        console.log('[HOTKEY] 2倍速再生');
        setVideoPlayBackRate(2);
        setisVideoPlaying(true);
      },
      'skip-forward-large': () => {
        console.log('[HOTKEY] 4倍速再生');
        setVideoPlayBackRate(4);
        setisVideoPlaying(true);
      },
      'skip-forward-xlarge': () => {
        console.log('[HOTKEY] 6倍速再生');
        setVideoPlayBackRate(6);
        setisVideoPlaying(true);
      },
      'play-pause': () => {
        console.log('[HOTKEY] 再生/停止');
        setisVideoPlaying(!isVideoPlaying);
      },
      'skip-backward-medium': () => {
        console.log('[HOTKEY] 5秒戻し');
        handleCurrentTime(new Event('hotkey'), currentTime - 5);
      },
      'skip-backward-large': () => {
        console.log('[HOTKEY] 10秒戻し');
        handleCurrentTime(new Event('hotkey'), currentTime - 10);
      },
      analyze: () => setStatsOpen(true),
      undo: performUndo,
      redo: performRedo,
      'resync-audio': () => void resyncAudio(),
      'reset-sync': resetSync,
      'manual-sync': () => void manualSyncFromPlayers(),
      'toggle-manual-mode': () =>
        setSyncMode((prev) => (prev === 'auto' ? 'manual' : 'auto')),
    }),
    [
      currentTime,
      handleCurrentTime,
      isVideoPlaying,
      setisVideoPlaying,
      setVideoPlayBackRate,
      setStatsOpen,
      performUndo,
      performRedo,
      resyncAudio,
      resetSync,
      manualSyncFromPlayers,
      setSyncMode,
    ],
  );

  // グローバルホットキーを登録（ウィンドウフォーカス時のみ有効）
  useGlobalHotkeys(settings.hotkeys, hotkeyHandlers);

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
            timeline={timeline}
            maxSec={maxSec}
            currentTime={currentTime}
            selectedTimelineIdList={selectedTimelineIdList}
            metaDataConfigFilePath={metaDataConfigFilePath}
            teamNames={teamNames}
            setTimeline={setTimeline}
            setTeamNames={setTeamNames}
            addTimelineData={addTimelineData}
            deleteTimelineDatas={deleteTimelineDatas}
            updateQualifier={updateQualifier}
            updateActionType={updateActionType}
            updateActionResult={updateActionResult}
            updateTimelineRange={updateTimelineRange}
            updateTimelineItem={updateTimelineItem}
            handleCurrentTime={handleCurrentTime}
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
