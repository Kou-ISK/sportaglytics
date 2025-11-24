import React, { useState, useMemo, useRef } from 'react';
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
import type { HotkeyConfig } from '../types/Settings';
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
  const { activeActions } = useActionPreset();

  // TimelineActionSectionへのrefを作成
  const timelineActionRef = useRef<TimelineActionSectionHandle>(null);

  // ホットキーハンドラーを定義（keydown時）
  const hotkeyHandlers = useMemo(
    () => ({
      'skip-forward-small': () => {
        console.log('[HOTKEY] 0.5倍速再生開始');
        setVideoPlayBackRate(0.5);
        setisVideoPlaying(true);
      },
      'skip-forward-medium': () => {
        console.log('[HOTKEY] 2倍速再生開始');
        setVideoPlayBackRate(2);
        setisVideoPlaying(true);
      },
      'skip-forward-large': () => {
        console.log('[HOTKEY] 4倍速再生開始');
        setVideoPlayBackRate(4);
        setisVideoPlaying(true);
      },
      'skip-forward-xlarge': () => {
        console.log('[HOTKEY] 6倍速再生開始');
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

  // keyupハンドラーを定義（キーを放した時に1倍速に戻す）
  const keyUpHandlers = useMemo(
    () => ({
      'skip-forward-small': () => {
        console.log('[HOTKEY] 0.5倍速再生終了 → 1倍速に戻す');
        setVideoPlayBackRate(1);
      },
      'skip-forward-medium': () => {
        console.log('[HOTKEY] 2倍速再生終了 → 1倍速に戻す');
        setVideoPlayBackRate(1);
      },
      'skip-forward-large': () => {
        console.log('[HOTKEY] 4倍速再生終了 → 1倍速に戻す');
        setVideoPlayBackRate(1);
      },
      'skip-forward-xlarge': () => {
        console.log('[HOTKEY] 6倍速再生終了 → 1倍速に戻す');
        setVideoPlayBackRate(1);
      },
    }),
    [setVideoPlayBackRate],
  );

  // アクションボタン用ホットキーを生成
  // 修飾キーなし → 最初のチーム、Shift → 2番目のチーム
  const actionHotkeys = useMemo(() => {
    const hotkeys: HotkeyConfig[] = [];

    for (const action of activeActions) {
      if (action.hotkey) {
        // 最初のチーム用（修飾キーなし）
        if (teamNames[0]) {
          hotkeys.push({
            id: `action-${teamNames[0]}-${action.action}`,
            label: `${teamNames[0]} - ${action.action}`,
            key: action.hotkey,
          });
        }

        // 2番目のチーム用（Shift修飾キー）
        if (teamNames[1]) {
          hotkeys.push({
            id: `action-${teamNames[1]}-${action.action}`,
            label: `${teamNames[1]} - ${action.action}`,
            key: `Shift+${action.hotkey}`,
          });
        }
      }
    }

    return hotkeys;
  }, [teamNames, activeActions]);

  // アクションボタン用ハンドラー
  // 修飾キーなし → 最初のチーム、Shift → 2番目のチーム
  const actionHandlers = useMemo(() => {
    const handlers: Record<string, () => void> = {};

    for (const action of activeActions) {
      if (action.hotkey) {
        const actionName = action.action; // クロージャ用に変数を保存

        // 最初のチーム用（修飾キーなし）
        if (teamNames[0]) {
          const id = `action-${teamNames[0]}-${actionName}`;
          const teamName = teamNames[0];
          handlers[id] = () => {
            console.log(`[HOTKEY] Action: ${teamName} - ${actionName}`);
            timelineActionRef.current?.triggerAction(teamName, actionName);
          };
        }

        // 2番目のチーム用（Shift修飾キー）
        if (teamNames[1]) {
          const id = `action-${teamNames[1]}-${actionName}`;
          const teamName = teamNames[1];
          handlers[id] = () => {
            console.log(`[HOTKEY] Action: ${teamName} - ${actionName}`);
            timelineActionRef.current?.triggerAction(teamName, actionName);
          };
        }
      }
    }

    return handlers;
  }, [teamNames, activeActions]);

  // システムホットキーとアクションホットキーを統合
  const combinedHotkeys = useMemo(
    () => [...settings.hotkeys, ...actionHotkeys],
    [settings.hotkeys, actionHotkeys],
  );

  const combinedHandlers = useMemo(
    () => ({ ...hotkeyHandlers, ...actionHandlers }),
    [hotkeyHandlers, actionHandlers],
  );

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
            setTimeline={setTimeline}
            setTeamNames={setTeamNames}
            addTimelineData={addTimelineData}
            deleteTimelineDatas={deleteTimelineDatas}
            updateQualifier={updateQualifier}
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
