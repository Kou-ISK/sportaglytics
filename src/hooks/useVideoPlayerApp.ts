import { useCallback, useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import { TimelineData } from '../types/TimelineData';
import { VideoSyncData } from '../types/VideoSync';
import { useTimelinePersistence } from './videoPlayer/useTimelinePersistence';
import { useTimelineHistory } from './videoPlayer/useTimelineHistory';
import { useTimelineSelection } from './videoPlayer/useTimelineSelection';
import { useTimelineEditing } from './videoPlayer/useTimelineEditing';
import { useVideoPlayerErrors } from './videoPlayer/useVideoPlayerErrors';
import { useSyncActions } from './videoPlayer/useSyncActions';
import { useNotification } from '../contexts/NotificationContext';

export const useVideoPlayerApp = () => {
  const isDev = process.env.NODE_ENV === 'development';
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

  const {
    selectedTimelineIdList,
    setSelectedTimelineIdList,
    getSelectedTimelineId,
  } = useTimelineSelection();

  // setTimelineWrapper: useTimelineEditingに渡すラッパー
  const setTimeline = (value: React.SetStateAction<TimelineData[]>) => {
    const newTimeline = typeof value === 'function' ? value(timeline) : value;
    setTimelineWithHistory(newTimeline);
    setPersistedTimeline(newTimeline);
  };

  const {
    addTimelineData,
    deleteTimelineDatas,
    updateQualifier,
    updateActionResult,
    updateActionType,
    updateTimelineRange,
    updateTimelineItem,
    sortTimelineDatas,
  } = useTimelineEditing(setTimeline);
  const [videoList, setVideoList] = useState<string[]>([]); // 空の配列に修正
  const [currentTime, setCurrentTime] = useState(0);
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

  // 異常なcurrentTime値の監視(警告のみ、リセットしない)
  const prevCurrentTimeRef = useRef<number>(0);
  useEffect(() => {
    if (currentTime > 7200 && prevCurrentTimeRef.current !== currentTime) {
      // 2時間を超える場合は警告のみ
      console.warn(
        `[WARNING] currentTimeが異常に高い値 (${currentTime}秒、上限=7200秒) です。`,
      );
      // リセット処理は削除 - ユーザーの操作を尊重
    }
    prevCurrentTimeRef.current = currentTime; // 値を記憶
  }, [currentTime]);

  const handleCurrentTime = (
    event: React.SyntheticEvent | Event,
    newValue: number | number[],
  ) => {
    const time = newValue as number;

    // シーク開始を通知（SyncedVideoPlayerがtimeupdateを一時無視）
    const seekStartEvent = new CustomEvent('video-seek-start', {
      detail: { time },
    });
    window.dispatchEvent(seekStartEvent);

    // 负のオフセット時はグローバル時間の下限を拡張
    const minAllowed =
      syncData &&
      syncData.isAnalyzed &&
      typeof syncData.syncOffset === 'number' &&
      syncData.syncOffset < 0
        ? syncData.syncOffset
        : 0;

    if (!isNaN(time) && time >= minAllowed) {
      const timeClamped = Math.max(time, minAllowed);
      setCurrentTime(timeClamped);

      // シーク操作時に全ての動画を即座に同期
      setTimeout(() => {
        videoList.forEach((_, index) => {
          try {
            type VjsNamespace = {
              getPlayer?: (id: string) =>
                | {
                    el?: () => Element | null;
                    isDisposed?: () => boolean;
                    error?: () => unknown;
                    duration?: () => number | undefined;
                    currentTime?: (time?: number) => number | undefined;
                  }
                | undefined;
            };
            const ns = videojs as unknown as VjsNamespace;
            const player = ns.getPlayer?.(`video_${index}`);
            if (
              player &&
              player.el?.() &&
              player.isDisposed?.() !== true &&
              !player.error?.()
            ) {
              // プレイヤーの状態をチェック
              let duration = 0;
              try {
                const dur = player.duration?.();
                duration = typeof dur === 'number' && !isNaN(dur) ? dur : 0;
              } catch (durationError) {
                duration = 0;
              }

              if (
                typeof duration === 'number' &&
                !isNaN(duration) &&
                duration > 0
              ) {
                let targetTime = timeClamped;

                // video_0（基準動画）: グローバル時間をそのまま使用（負の時間も許可）
                if (index === 0) {
                  // 負のオフセットがある場合のみ負の時間を許可
                  const minTime =
                    syncData?.isAnalyzed &&
                    typeof syncData.syncOffset === 'number' &&
                    syncData.syncOffset < 0
                      ? syncData.syncOffset
                      : 0;
                  targetTime = Math.max(minTime, timeClamped);
                }

                // 2番目以降の動画には同期オフセットを適用
                // グローバル時間 = video_0の時間なので、video_1 = グローバル時間 - offset
                if (index > 0 && syncData?.isAnalyzed) {
                  const offset = syncData.syncOffset || 0;
                  // offset > 0: video_1が早い → video_1を遅らせる（-offset）
                  // offset < 0: video_0が早い → video_1を進める（-offset、正の値を加算）
                  targetTime = Math.max(0, timeClamped - offset);

                  // オフセット適用のデバッグログ
                  console.log(
                    `[OFFSET DEBUG] video_${index}: global=${timeClamped.toFixed(3)}s, ` +
                      `offset=${offset.toFixed(3)}s, target=${targetTime.toFixed(3)}s ` +
                      `(計算: ${timeClamped.toFixed(3)} - ${offset.toFixed(3)} = ${targetTime.toFixed(3)})`,
                  );
                }

                if (isDev) {
                  console.log(
                    `シーク: Video ${index}の時刻を${targetTime}秒に設定 (global=${timeClamped}, offset=${
                      syncData?.syncOffset ?? 0
                    })`,
                  );
                }

                // より安全なシーク処理
                try {
                  player.currentTime?.(targetTime);
                } catch (seekError) {
                  console.debug(
                    `プレイヤー${index}のシークでエラー:`,
                    seekError,
                  );
                }
              }
            }
          } catch (error) {
            console.debug(`プレイヤー${index}のシークでエラー:`, error);
          }
        });

        // シーク完了を通知（500ms後にSyncedVideoPlayerがtimeupdateを再開）
        // Video.jsのtimeupdateイベントが落ち着くまで待つ
        setTimeout(() => {
          const seekEndEvent = new CustomEvent('video-seek-end');
          window.dispatchEvent(seekEndEvent);
        }, 500);
      }, 50); // 短いディレイで即座に反映
    } else {
      console.warn('無効な時間値が設定されようとしました:', time);
      setCurrentTime(minAllowed);
    }
  };
  const [packagePath, setPackagePath] = useState<string>('');

  // syncDataが更新されたら永続化(config.json に保存)
  useEffect(() => {
    (async () => {
      try {
        if (
          metaDataConfigFilePath &&
          window.electronAPI &&
          typeof window.electronAPI.saveSyncData === 'function' &&
          syncData
        ) {
          console.log('[useVideoPlayerApp] Saving syncData to metadata.json:', {
            path: metaDataConfigFilePath,
            syncData,
          });
          await window.electronAPI.saveSyncData(
            metaDataConfigFilePath,
            syncData,
          );
          console.log('[useVideoPlayerApp] syncData saved successfully');
        }
      } catch (e) {
        console.error('[useVideoPlayerApp] saveSyncData failed', e);
      }
    })();
  }, [syncData, metaDataConfigFilePath]);

  // メタデータファイルパスが変更されたらウィンドウタイトルを更新
  useEffect(() => {
    if (!metaDataConfigFilePath) {
      // ファイルが選択されていない場合はデフォルトタイトル
      if (globalThis.window.electronAPI?.setWindowTitle) {
        globalThis.window.electronAPI.setWindowTitle('SporTagLytics');
      }
      return;
    }

    // メタデータファイルからパッケージ名を読み込んでタイトルに設定
    (async () => {
      try {
        if (!globalThis.window.electronAPI?.readJsonFile) return;

        const config = await globalThis.window.electronAPI.readJsonFile(
          metaDataConfigFilePath,
        );
        if (config && typeof config === 'object' && 'packageName' in config) {
          const packageName = (config as { packageName: string }).packageName;
          if (packageName && globalThis.window.electronAPI.setWindowTitle) {
            globalThis.window.electronAPI.setWindowTitle(
              `${packageName} - SporTagLytics`,
            );
          }
        }
      } catch (e) {
        console.error('[useVideoPlayerApp] Failed to update window title:', e);
      }
    })();
  }, [metaDataConfigFilePath]);

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
    if (globalThis.window.electronAPI) {
      globalThis.window.electronAPI.on('timeline-undo', handleUndo);
      globalThis.window.electronAPI.on('timeline-redo', handleRedo);

      return () => {
        if (globalThis.window.electronAPI) {
          globalThis.window.electronAPI.off('timeline-undo', handleUndo);
          globalThis.window.electronAPI.off('timeline-redo', handleRedo);
        }
      };
    }
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
    updateQualifier,
    updateActionResult,
    updateActionType,
    updateTimelineRange,
    updateTimelineItem,
    getSelectedTimelineId,
    sortTimelineDatas,
    resyncAudio,
    resetSync,
    adjustSyncOffset,
    manualSyncFromPlayers,
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
