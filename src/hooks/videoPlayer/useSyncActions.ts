import { useCallback, useState } from 'react';
import videojs from 'video.js';
import type { VideoSyncData } from '../../types/VideoSync';
import type { VideoPlayerError } from '../../types/VideoPlayerError';

interface UseSyncActionsParams {
  videoList: string[];
  syncData: VideoSyncData | undefined;
  setSyncData: React.Dispatch<React.SetStateAction<VideoSyncData | undefined>>;
  setIsVideoPlaying: (value: boolean | ((prev: boolean) => boolean)) => void;
  metaDataConfigFilePath: string;
  setSyncMode: React.Dispatch<React.SetStateAction<'auto' | 'manual'>>;
  onSyncError?: (value: VideoPlayerError) => void;
  onSyncInfo?: (message: string) => void;
  onSyncWarning?: (message: string) => void;
}

export const useSyncActions = ({
  videoList,
  syncData,
  setSyncData,
  setIsVideoPlaying,
  metaDataConfigFilePath,
  setSyncMode,
  onSyncError,
  onSyncInfo,
  onSyncWarning,
}: UseSyncActionsParams) => {
  const [playerForceUpdateKey, setPlayerForceUpdateKey] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStage, setSyncStage] = useState('');

  const logInfo = useCallback(
    (message: string) => {
      if (onSyncInfo) {
        onSyncInfo(message);
      } else {
        console.log(message);
      }
    },
    [onSyncInfo],
  );

  const logWarn = useCallback(
    (message: string) => {
      if (onSyncWarning) {
        onSyncWarning(message);
      } else {
        console.warn(message);
      }
    },
    [onSyncWarning],
  );

  const forceUpdateVideoPlayers = useCallback(
    (newSyncData: VideoSyncData) => {
      return new Promise<void>((resolve) => {
        setIsVideoPlaying(false);

        requestAnimationFrame(() => {
          try {
            const vjsGlobal = videojs as unknown as {
              getPlayer?: (id: string) => {
                currentTime?: (time?: number) => number | void;
                pause?: () => void;
              };
            };

            const primaryPlayer = vjsGlobal.getPlayer?.('video_0');
            const currentGlobalTime =
              (primaryPlayer?.currentTime?.() as number) || 0;

            logInfo(
              `[forceUpdate] 現在のグローバル時刻: ${currentGlobalTime}秒`,
            );

            videoList.forEach((_, index) => {
              try {
                const player = vjsGlobal.getPlayer?.(`video_${index}`);
                if (player) {
                  const offset =
                    index > 0 && newSyncData?.isAnalyzed
                      ? newSyncData.syncOffset || 0
                      : 0;
                  const targetTime = Math.max(
                    0,
                    currentGlobalTime + (index > 0 ? offset : 0),
                  );

                  player.pause?.();
                  player.currentTime?.(targetTime);
                  logInfo(
                    `[forceUpdate] video_${index} synced to ${targetTime}秒 (global=${currentGlobalTime}, offset=${offset})`,
                  );
                }
              } catch (error) {
                console.debug(`プレイヤー${index}の更新エラー:`, error);
              }
            });
          } catch (error) {
            console.debug('forceUpdateVideoPlayers エラー:', error);
          }

          setPlayerForceUpdateKey((prev) => {
            const newKey = prev + 1;
            logInfo(`[forceUpdate] playerForceUpdateKey updated to ${newKey}`);
            return newKey;
          });

          setTimeout(() => {
            logInfo('[forceUpdate] resuming playback');
            setIsVideoPlaying(true);
            resolve();
          }, 300);
        });
      });
    },
    [logInfo, setIsVideoPlaying, videoList],
  );

  const resyncAudio = useCallback(async () => {
    if (videoList.length < 2) {
      logWarn('2つの映像が必要です');
      return;
    }

    setIsAnalyzing(true);
    setSyncProgress(0);
    setSyncStage('');

    try {
      const { AudioSyncAnalyzer } = await import(
        '../../utils/AudioSyncAnalyzer'
      );
      const analyzer = new AudioSyncAnalyzer();

      logInfo('音声同期を再実行中...');
      const result = await analyzer.quickSyncAnalysis(
        videoList[0],
        videoList[1],
        (stage: string, progress: number) => {
          setSyncStage(stage);
          setSyncProgress(progress);
        },
      );

      const newSyncData: VideoSyncData = {
        syncOffset: result.offsetSeconds,
        isAnalyzed: true,
        confidenceScore: result.confidence,
      };

      logInfo('[resyncAudio] 新しい同期データを適用しました');
      setSyncData(newSyncData);
      setSyncProgress(100);
      logInfo('音声同期完了');

      logInfo('[resyncAudio] 映像プレイヤーへ同期結果を反映します');
      await forceUpdateVideoPlayers(newSyncData);
      logInfo('[resyncAudio] プレイヤー反映が完了しました');
    } catch (error) {
      console.error('音声同期エラー:', error);
      onSyncError?.({
        type: 'sync',
        message:
          '音声同期に失敗しました。映像ファイルに音声が含まれているか確認してください。',
      });
    } finally {
      setIsAnalyzing(false);
      setSyncProgress(0);
      setSyncStage('');
    }
  }, [videoList, forceUpdateVideoPlayers, setSyncData, onSyncError]);

  const resetSync = useCallback(() => {
    const resetSyncData: VideoSyncData = {
      syncOffset: 0,
      isAnalyzed: false,
      confidenceScore: 0,
    };
    setSyncData(resetSyncData);
    logInfo('同期をリセットしました');
    forceUpdateVideoPlayers(resetSyncData);
  }, [forceUpdateVideoPlayers, logInfo, setSyncData]);

  const adjustSyncOffset = useCallback(async () => {
    if (!syncData) return;

    const newOffset = prompt(
      '同期オフセットを入力してください（秒）:',
      syncData.syncOffset.toString(),
    );
    if (newOffset !== null && !isNaN(Number(newOffset))) {
      const adjustedSyncData: VideoSyncData = {
        ...syncData,
        syncOffset: Number(newOffset),
        isAnalyzed: true,
      };
      setSyncData(adjustedSyncData);
      logInfo(`同期オフセットを調整しました: ${Number(newOffset)} 秒`);

      await forceUpdateVideoPlayers(adjustedSyncData);
    }
  }, [syncData, setSyncData, forceUpdateVideoPlayers, logInfo]);

  const manualSyncFromPlayers = useCallback(async () => {
    try {
      type VjsLite = {
        getPlayer?: (id: string) => { currentTime?: () => number } | undefined;
      };
      const vjs = videojs as unknown as VjsLite;
      const p0 = vjs.getPlayer?.('video_0');
      const p1 = vjs.getPlayer?.('video_1');

      let t0 = 0;
      let t1 = 0;
      try {
        t0 = p0?.currentTime?.() ?? 0;
      } catch {
        t0 = 0;
      }
      try {
        t1 = p1?.currentTime?.() ?? 0;
      } catch {
        t1 = 0;
      }

      if (typeof t0 !== 'number' || typeof t1 !== 'number') {
        console.warn('manualSync: invalid current times', { t0, t1 });
        return;
      }

      const newOffset = t0 - t1;
      const newSyncData: VideoSyncData = {
        syncOffset: newOffset,
        isAnalyzed: true,
        confidenceScore: undefined,
      };

      setSyncData(newSyncData);
      logInfo(`手動同期を適用しました (差分: ${newOffset.toFixed(3)} 秒)`);

      if (metaDataConfigFilePath && window.electronAPI?.saveSyncData) {
        try {
          await window.electronAPI.saveSyncData(
            metaDataConfigFilePath,
            newSyncData,
          );
        } catch (error) {
          console.debug('manualSync saveSyncData error', error);
        }
      }

      await forceUpdateVideoPlayers(newSyncData);

      try {
        setSyncMode('auto');
        if (window.electronAPI?.setManualModeChecked) {
          await window.electronAPI.setManualModeChecked(false);
        }
      } catch {
        /* noop */
      }
    } catch (error) {
      console.error('manualSyncFromPlayers error', error);
    }
  }, [
    metaDataConfigFilePath,
    forceUpdateVideoPlayers,
    setSyncMode,
    setSyncData,
  ]);

  return {
    playerForceUpdateKey,
    resyncAudio,
    resetSync,
    adjustSyncOffset,
    manualSyncFromPlayers,
    isAnalyzing,
    syncProgress,
    syncStage,
  };
};
