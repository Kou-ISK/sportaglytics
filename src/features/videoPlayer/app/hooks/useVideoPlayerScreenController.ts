import { useCallback, useEffect, useRef, useState } from 'react';
import type { TimelineData } from '../../../../types/TimelineData';
import type { VideoSyncData } from '../../../../types/VideoSync';
import { useTimelinePersistence } from './useTimelinePersistence';
import { useTimelineHistory } from './useTimelineHistory';
import { useTimelineSelection } from './useTimelineSelection';
import { useTimelineEditing } from './useTimelineEditing';
import { useVideoPlayerErrors } from './useVideoPlayerErrors';
import { useSyncActions } from './useSyncActions';
import { useVideoMetadataSync } from './useVideoMetadataSync';
import { useVideoTimeController } from './useVideoTimeController';
import { useNotification } from '../../../../contexts/NotificationContext';

export const useVideoPlayerScreenController = () => {
  const isDev = import.meta.env.DEV;
  const {
    timeline: persistedTimeline,
    setTimeline: setPersistedTimeline,
    timelineFilePath,
    setTimelineFilePath,
  } = useTimelinePersistence();

  // タイムライン履歴管理を統合
  const {
    timeline,
    canUndo,
    canRedo,
    setTimeline: setTimelineWithHistory,
    undo: performUndo,
    redo: performRedo,
  } = useTimelineHistory(persistedTimeline);

  const { info } = useNotification();
  const timelineRef = useRef<TimelineData[]>(timeline);
  useEffect(() => {
    timelineRef.current = timeline;
  }, [timeline]);

  const {
    selectedTimelineIdList,
    setSelectedTimelineIdList,
    getSelectedTimelineId,
  } = useTimelineSelection();

  // setTimelineWrapper: useTimelineEditingに渡すラッパー（functional updateを正しく扱う）
  const setTimeline = (value: React.SetStateAction<TimelineData[]>) => {
    const next =
      typeof value === 'function'
        ? (value as (prevState: TimelineData[]) => TimelineData[])(
            timelineRef.current,
          )
        : value;
    timelineRef.current = next;
    setTimelineWithHistory(next);
    setPersistedTimeline(next);
  };

  const {
    addTimelineData,
    deleteTimelineDatas,
    updateMemo,
    updateTimelineRange,
    updateTimelineItem,
    bulkUpdateTimelineItems,
    sortTimelineDatas,
  } = useTimelineEditing(setTimeline);
  const [videoList, setVideoList] = useState<string[]>([]); // 空の配列に修正

  // [DEBUG] videoList の変更を追跡
  useEffect(() => {
      console.log('[useVideoPlayerScreenController] videoList changed:', {
      videoList,
      length: videoList.length,
      timestamp: new Date().toISOString(),
    });
  }, [videoList]);

  const [metaDataConfigFilePath, setMetaDataConfigFilePath] =
    useState<string>('');

  const [teamNames, setTeamNames] = useState<string[]>([]);

  const [isFileSelected, setIsFileSelected] = useState(false);

  const [maxSec, setMaxSec] = useState(0);

  const [isVideoPlaying, setisVideoPlayingInternal] = useState<boolean>(false);
  const { error, setError, clearError } = useVideoPlayerErrors();

  // デバッグ用: setisVideoPlayingの呼び出しを追跡
  const setisVideoPlaying = (value: boolean | ((prev: boolean) => boolean)) => {
    const newValue =
      typeof value === 'function' ? value(isVideoPlaying) : value;
    if (isDev) {
      console.log(`[DEBUG] setisVideoPlaying called:`, {
        from: isVideoPlaying,
        to: newValue,
        timestamp: new Date().toISOString(),
      });
    }
    setisVideoPlayingInternal(newValue);
  };
  const [videoPlayBackRate, setVideoPlayBackRate] = useState(1);
  const [syncData, setSyncData] = useState<VideoSyncData | undefined>(
    undefined,
  );
  const [syncMode, setSyncMode] = useState<'auto' | 'manual'>('auto');
  const {
    playerForceUpdateKey,
    resyncAudio,
    resetSync,
    adjustSyncOffset,
    manualSyncFromPlayers,
    cancelManualSync,
    isAnalyzing,
    syncProgress,
    syncStage,
  } = useSyncActions({
    videoList,
    syncData,
    setSyncData,
    setIsVideoPlaying: setisVideoPlaying,
    metaDataConfigFilePath,
    setSyncMode,
    onSyncError: setError,
  });

  const { currentTime, setCurrentTime, handleCurrentTime } =
    useVideoTimeController({
      videoList,
      syncData,
      syncMode,
      isDev,
    });
  const [packagePath, setPackagePath] = useState<string>('');

  useVideoMetadataSync({
    metaDataConfigFilePath,
    syncData,
  });

  // Undo/Redo関数（Electron IPCとローカルホットキー両方で使用）
  const handleUndo = useCallback(() => {
    const previousTimeline = performUndo();
    if (previousTimeline) {
      setPersistedTimeline(previousTimeline);
      info('元に戻しました');
    }
  }, [info, performUndo, setPersistedTimeline]);

  const handleRedo = useCallback(() => {
    const nextTimeline = performRedo();
    if (nextTimeline) {
      setPersistedTimeline(nextTimeline);
      info('やり直しました');
    }
  }, [info, performRedo, setPersistedTimeline]);

  // Undo/RedoイベントハンドラーをElectron IPCに登録（後方互換性のため残す）
  useEffect(() => {
    const api = globalThis.window.electronAPI;
    if (!api?.onTimelineUndo || !api?.onTimelineRedo) return;
    const unsubscribeUndo = api.onTimelineUndo(handleUndo);
    const unsubscribeRedo = api.onTimelineRedo(handleRedo);
    return () => {
      unsubscribeUndo();
      unsubscribeRedo();
    };
  }, [handleUndo, handleRedo]);

  return {
    timeline,
    setTimeline,
    canUndo,
    canRedo,
    selectedTimelineIdList,
    setSelectedTimelineIdList,
    videoList,
    setVideoList,
    currentTime,
    setCurrentTime,
    timelineFilePath,
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
    packagePath,
    setPackagePath,
    addTimelineData,
    deleteTimelineDatas,
    updateMemo,
    updateTimelineRange,
    updateTimelineItem,
    bulkUpdateTimelineItems,
    getSelectedTimelineId,
    sortTimelineDatas,
    resyncAudio,
    resetSync,
    adjustSyncOffset,
    manualSyncFromPlayers,
    cancelManualSync,
    playerForceUpdateKey,
    error,
    setError,
    clearError,
    isAnalyzing,
    syncProgress,
    syncStage,
    performUndo: handleUndo,
    performRedo: handleRedo,
  };
};
