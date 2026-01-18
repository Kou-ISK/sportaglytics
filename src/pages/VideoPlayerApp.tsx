import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';
import videojs from 'video.js';
import {
  StatsModal,
  StatsView,
} from '../features/videoPlayer/components/Analytics/StatsModal/StatsModal';
import { useVideoPlayerApp } from '../hooks/useVideoPlayerApp';
import { useSettings } from '../hooks/useSettings';
import { useGlobalHotkeys } from '../hooks/useGlobalHotkeys';
import { useActionPreset } from '../contexts/ActionPresetContext';
import { PlaylistProvider, usePlaylist } from '../contexts/PlaylistContext';
import { TimelineData } from '../types/TimelineData';
import type { PlaylistItem } from '../types/Playlist';
import { PlayerSurface } from './videoPlayer/components/PlayerSurface';
import { ManualSyncControls } from './videoPlayer/components/ManualSyncControls';
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

  const [statsOpen, setStatsOpen] = useState(false);
  const [statsView, setStatsView] = useState<StatsView>('possession');

  // 手動モード開始時にoffsetを考慮した位置へシーク
  useEffect(() => {
    if (
      syncMode === 'manual' &&
      syncData?.isAnalyzed &&
      videoList.length >= 2
    ) {
      const offset = syncData.syncOffset || 0;

      try {
        const vjs = videojs as unknown as {
          getPlayer?: (
            id: string,
          ) => { currentTime?: (time?: number) => number } | undefined;
        };

        const p0 = vjs.getPlayer?.('video_0');
        const p1 = vjs.getPlayer?.('video_1');

        if (p0 && p1) {
          const t0 = p0.currentTime?.() ?? 0;
          // video_1はoffsetを考慮した位置にシーク
          // t1 = t0 + offset (offset = video_0の時刻に加算してvideo_1の時刻を得る値)
          const t1 = Math.max(0, t0 + offset);
          p1.currentTime?.(t1);

          console.log(
            `[手動モード] offsetを考慮したシーク: video_0=${t0.toFixed(3)}s, video_1=${t1.toFixed(3)}s (offset=${offset.toFixed(3)}s)`,
          );
        }
      } catch (error) {
        console.error('手動モード開始時のシークエラー:', error);
      }
    }
  }, [syncMode, syncData, videoList]);

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
    if (window.electronAPI?.setManualModeChecked) {
      window.electronAPI.setManualModeChecked(false).catch(() => {});
    }
  }, [setSyncMode]);

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
      handleCurrentTime,
      performUndo,
      performRedo,
      resyncAudio,
      resetSync,
      manualSyncFromPlayers,
      setSyncMode,
      onAnalyze: () => setStatsOpen(true),
      selectedTimelineIdList,
      deleteTimelineDatas,
      clearSelection: () => setSelectedTimelineIdList([]),
    });

  // グローバルホットキーを登録（ウィンドウフォーカス時のみ有効）
  useGlobalHotkeys(combinedHotkeys, combinedHandlers, keyUpHandlers);

  // Delete/Backspace、Undo/Redoのキーボードイベント処理
  const handleKeydown = useCallback(
    (e: KeyboardEvent) => {
      // 入力フィールドにフォーカスがある場合は何もしない
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      // Delete/Backspace: 選択中のタイムラインを削除
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedTimelineIdList.length > 0) {
          e.preventDefault();
          deleteTimelineDatas(selectedTimelineIdList);
          setSelectedTimelineIdList([]);
        }
        return;
      }

      // Cmd+Z: Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
        return;
      }

      // Cmd+Shift+Z: Redo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        performRedo();
        return;
      }

      // Cmd+Y: Redo（Windows用）
      if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        performRedo();
        return;
      }
    },
    [
      selectedTimelineIdList,
      deleteTimelineDatas,
      setSelectedTimelineIdList,
      performUndo,
      performRedo,
    ],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [handleKeydown]);

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

  // プレイリストからのコマンド処理用コールバックを登録
  const {
    registerSeekCallback,
    registerPlayItemCallback,
    syncToWindow,
    isWindowOpen,
    state: playlistState,
  } = usePlaylist();

  // シークコールバック
  const handlePlaylistSeek = useCallback(
    (time: number) => {
      handleCurrentTime(new Event('playlist-seek'), time);
    },
    [handleCurrentTime],
  );

  // アイテム再生コールバック
  const handlePlaylistPlayItem = useCallback(
    (item: PlaylistItem) => {
      // アイテムの開始時間へジャンプして再生開始
      handleCurrentTime(new Event('playlist-play'), item.startTime);
      setisVideoPlaying(true);
    },
    [handleCurrentTime, setisVideoPlaying],
  );

  // コールバックを登録
  useEffect(() => {
    registerSeekCallback(handlePlaylistSeek);
    registerPlayItemCallback(handlePlaylistPlayItem);
  }, [
    registerSeekCallback,
    registerPlayItemCallback,
    handlePlaylistSeek,
    handlePlaylistPlayItem,
  ]);

  // プレイリストウィンドウが開いている場合、状態を同期
  useEffect(() => {
    if (!isWindowOpen) return;

    // 状態が変更されたら同期（即座に）
    const videoPath = videoList.length > 0 ? videoList[0] : null;
    const videoPath2 = videoList.length > 1 ? videoList[1] : null;
    // packagePathはvideoPathの親ディレクトリから推測
    const packagePath = videoPath
      ? videoPath.substring(0, videoPath.lastIndexOf('/'))
      : undefined;
    syncToWindow(currentTime, videoPath, videoPath2, packagePath);
  }, [isWindowOpen, playlistState, currentTime, videoList, syncToWindow]);

  // プレイリストに追加（右クリックメニューから呼ばれる）
  const handleAddToPlaylist = useCallback(
    async (items: TimelineData[]) => {
      const list = videoList || [];

      // 開いているプレイリストウィンドウ数を取得
      const count = await window.electronAPI?.playlist.getOpenWindowCount();

      if (count === 0) {
        // ウィンドウが開いていない場合は新規ウィンドウを作成
        await window.electronAPI?.playlist.openWindow();
        // ウィンドウが完全に準備されるまで待機
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      // 全てのウィンドウにアイテムを追加
      for (const item of items) {
        const playlistItem = {
          id: crypto.randomUUID(),
          timelineItemId: item.id,
          actionName: item.actionName,
          startTime: item.startTime,
          endTime: item.endTime,
          labels: item.labels,
          memo: item.memo,
          addedAt: Date.now(),
          videoSource: list[0] || undefined,
          videoSource2: list[1] || undefined,
        };
        await window.electronAPI?.playlist.addItemToAllWindows(playlistItem);
      }
    },
    [videoList],
  );

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

          {/* 手動モードでは手動同期コントロールをタイムライン領域に表示 */}
          {syncMode === 'manual' && (
            <Box
              sx={{
                gridColumn: '1',
                gridRow: '2',
                position: 'relative',
                zIndex: 1100,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'flex-start',
                pt: 2,
                pointerEvents: 'none',
                '& > *': {
                  pointerEvents: 'auto',
                },
              }}
            >
              <ManualSyncControls
                onApplySync={handleApplyManualSync}
                onCancel={handleCancelManualSync}
              />
            </Box>
          )}

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
            updateMemo={updateMemo}
            updateTimelineRange={updateTimelineRange}
            updateTimelineItem={updateTimelineItem}
            bulkUpdateTimelineItems={bulkUpdateTimelineItems}
            videoList={videoList}
            handleCurrentTime={handleCurrentTime}
            performUndo={performUndo}
            performRedo={performRedo}
            applyLabelsToTimeline={(ids, labels) => {
              if (!ids || ids.length === 0) return;
              ids.forEach((id) => {
                const target = timeline.find((t) => t.id === id);
                const current = target?.labels || [];
                const merged = [...current];
                labels.forEach((l) => {
                  if (
                    !merged.find(
                      (m) => m.group === l.group && m.name === l.name,
                    )
                  ) {
                    merged.push(l);
                  }
                });
                if (bulkUpdateTimelineItems) {
                  bulkUpdateTimelineItems([id], { labels: merged });
                } else {
                  updateTimelineItem(id, { labels: merged });
                }
              });
            }}
            onAddToPlaylist={handleAddToPlaylist}
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
