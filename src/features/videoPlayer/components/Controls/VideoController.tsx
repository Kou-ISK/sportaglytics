import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
} from 'react';
import { VideoSyncData } from '../../../../types/VideoSync';
import { VideoControllerToolbar } from './VideoController/VideoControllerToolbar';
import { useFlashStates } from './VideoController/hooks/useFlashStates';
import { useHotkeyPlayback } from './VideoController/hooks/useHotkeyPlayback';
import { useSeekCoordinator } from './VideoController/hooks/useSeekCoordinator';
import { usePlaybackTimeTracker } from './VideoController/hooks/usePlaybackTimeTracker';
import { useExistingVideoJsPlayer } from './VideoController/hooks/useExistingVideoJsPlayer';
import { useVideoControllerControls } from './VideoController/hooks/useVideoControllerControls';

interface VideoControllerProps {
  setIsVideoPlaying: Dispatch<SetStateAction<boolean>>;
  isVideoPlaying: boolean;
  setVideoPlayBackRate: Dispatch<SetStateAction<number>>;
  videoPlayBackRate: number;
  setCurrentTime: Dispatch<SetStateAction<number>>;
  currentTime: number; // タイムライン等からの外部シーク検知用
  handleCurrentTime: (
    event: React.SyntheticEvent | Event,
    newValue: number | number[],
  ) => void;
  maxSec: number;
  videoList: string[];
  syncData?: VideoSyncData;
}

export const VideoController = ({
  setIsVideoPlaying,
  isVideoPlaying,
  setVideoPlayBackRate,
  videoPlayBackRate,
  setCurrentTime,
  currentTime,
  handleCurrentTime,
  maxSec,
  videoList,
  syncData,
}: VideoControllerProps) => {
  const { flashStates, triggerFlash } = useFlashStates();
  const isSeekingRef = useSeekCoordinator();
  const lastSetCurrentTimeValueRef = useRef<number>(0); // 最後にsetCurrentTimeで設定した時間値
  const lastSetCurrentTimeTimestampRef = useRef<number>(0); // 最後にsetCurrentTimeを呼んだタイムスタンプ
  const isVideoPlayingRef = useRef<boolean>(isVideoPlaying); // 最新のisVideoPlaying値を保持
  // 初期値を-Infinityにして、起動直後の操作を阻害しない
  const lastManualSeekTimestamp = useRef<number>(-Infinity);
  const hasVideos = videoList.some((path) => path && path.trim() !== '');

  // isVideoPlayingが変更されたらrefを更新
  useEffect(() => {
    isVideoPlayingRef.current = isVideoPlaying;
  }, [isVideoPlaying]);

  // 安全なsetCurrentTime関数（頻度制限付き）
  // maxSecを基準に異常値を検出(2時間を上限とする)
  const safeSetCurrentTime = (time: number, source = 'unknown') => {
    const maxAllowedTime = maxSec > 0 ? maxSec + 10 : 7200;
    if (time > maxAllowedTime) {
      console.error(
        `[ERROR] safeSetCurrentTime from ${source}: 異常に高い値 (${time}秒、上限=${maxAllowedTime}秒) の設定を阻止しました。`,
      );
      return;
    }
    if (isNaN(time) || time < 0) {
      console.error(
        `[ERROR] safeSetCurrentTime from ${source}: 無効な値 (${time}) の設定を阻止しました。`,
      );
      return;
    }

    // 頻度制限: RAFからの呼び出しは常に通す（早送り時の追従性向上）
    const now = Date.now();
    const timeDiff = Math.abs(time - lastSetCurrentTimeValueRef.current);
    const isSyncTick = source.startsWith('RAF');

    // RAF更新は閾値チェックなしで通す、それ以外は0.05秒以上の変化で更新
    const shouldUpdate =
      isSyncTick || source === 'updateTimeHandler' || timeDiff > 0.05;

    if (shouldUpdate) {
      // console.log(`[INFO] safeSetCurrentTime from ${source}: ${time}秒を設定`);
      lastSetCurrentTimeValueRef.current = time;
      lastSetCurrentTimeTimestampRef.current = now;
      setCurrentTime(time);
    } else {
      // console.debug(
      //   `[DEBUG] safeSetCurrentTime from ${source}: 更新をスキップ (変化=${timeDiff.toFixed(
      //     3,
      //   )}秒)`,
      // );
    }
  };

  // シークイベントのリスニング（RAF処理の一時停止/再開）
  // タイムラインクリック等の外部シーク操作を検知
  const prevCurrentTimeRef = useRef<number>(currentTime);
  useEffect(() => {
    if (currentTime !== prevCurrentTimeRef.current) {
      console.log(
        `[INFO] 外部シーク検知: ${prevCurrentTimeRef.current}秒 → ${currentTime}秒`,
      );
      lastManualSeekTimestamp.current = Date.now();
      prevCurrentTimeRef.current = currentTime;
    }
  }, [currentTime]);

  // 既存のVideo.jsプレイヤー取得（新規作成はしない）
  const getExistingPlayer = useExistingVideoJsPlayer();

  const { videoTime, setVideoTime } = usePlaybackTimeTracker({
    videoList,
    isVideoPlaying,
    maxSec,
    syncData,
    getExistingPlayer,
    lastManualSeekTimestamp,
    isSeekingRef,
    safeSetCurrentTime,
  });

  useHotkeyPlayback({
    setVideoPlayBackRate,
    triggerFlash,
    setIsVideoPlaying,
    isVideoPlayingRef,
    setCurrentTime,
    syncData,
    lastManualSeekTimestamp,
    getExistingPlayer,
  });

  // PLAY ALLを押した直後、全プレイヤーに対して再生前に同期シーク→再生を試行（既存のみ）
  useEffect(() => {
    if (isVideoPlaying && videoList.length > 0) {
      const tryPlayAll = () => {
        // 基準時間: 負のオフセットでスライダーが負のときは videoTime を優先
        const base = getExistingPlayer('video_0');
        const useSlider = !!(
          syncData?.isAnalyzed &&
          (syncData?.syncOffset ?? 0) < 0 &&
          videoTime < 0
        );
        let baseTime = 0;
        try {
          baseTime = useSlider
            ? videoTime
            : base?.currentTime
              ? base.currentTime() || videoTime
              : videoTime;
        } catch {
          baseTime = videoTime;
        }

        // オフセット: syncData があれば使用、なければ p0/p1 の時刻から算出
        let localOffset = 0;
        if (syncData?.isAnalyzed) {
          localOffset = syncData.syncOffset || 0;
        } else if (videoList.length > 1) {
          const p1 = getExistingPlayer('video_1');
          let t1 = 0;
          try {
            t1 = p1?.currentTime ? p1.currentTime() || 0 : 0;
          } catch {
            t1 = 0;
          }
          localOffset = (base?.currentTime ? base.currentTime() || 0 : 0) - t1;
        }

        videoList.forEach((_, index) => {
          try {
            const id = `video_${index}`;
            const player = getExistingPlayer(id);
            if (player && !player.isDisposed?.()) {
              const rs = player.readyState?.() ?? 0;

              // 2本目以降は再生前に同期位置へシーク
              // targetTime = baseTime + offset (offset = video_1に加算すべき秒数)
              if (index > 0) {
                const targetTime = Math.max(0, baseTime + localOffset);
                try {
                  (
                    player as unknown as {
                      currentTime?: (t?: number) => number;
                    }
                  ).currentTime?.(targetTime);
                } catch {
                  /* noop */
                }
              }

              const playNow = () => {
                const p = player.play?.();
                if (p && typeof (p as Promise<unknown>).catch === 'function') {
                  (p as Promise<unknown>).catch(() => {
                    console.debug('play promise rejected (autoplay policy)');
                  });
                }
              };

              // オフセットが正で、まだ到達していない場合は遅延開始
              const delayMs =
                index > 0 && localOffset > baseTime
                  ? Math.max(0, (localOffset - baseTime) * 1000)
                  : 0;

              if (rs >= 1) {
                if (delayMs > 0) {
                  setTimeout(playNow, delayMs);
                } else {
                  playNow();
                }
              } else {
                // 準備完了イベントでシーク→（必要なら遅延して）再生
                const onReady = () => {
                  if (index > 0) {
                    const targetTime = Math.max(0, baseTime - localOffset);
                    try {
                      (
                        player as unknown as {
                          currentTime?: (t?: number) => number;
                        }
                      ).currentTime?.(targetTime);
                    } catch {
                      /* noop */
                    }
                  }
                  if (delayMs > 0) {
                    setTimeout(playNow, delayMs);
                  } else {
                    playNow();
                  }
                  player.off?.('loadedmetadata', onReady);
                  player.off?.('canplay', onReady);
                };
                player.on?.('loadedmetadata', onReady);
                player.on?.('canplay', onReady);
              }
            }
          } catch {
            /* noop */
          }
        });
      };
      const t = setTimeout(tryPlayAll, 150);
      return () => clearTimeout(t);
    }
  }, [
    isVideoPlaying,
    videoList,
    videoTime,
    syncData?.syncOffset,
    syncData?.isAnalyzed,
  ]);

  const {
    speedOptions,
    smallSkipSeconds,
    largeSkipSeconds,
    currentTimeLabel,
    onTogglePlayback,
    onSeekAdjust,
    onSpeedPresetSelect,
    onSpeedChange,
  } = useVideoControllerControls({
    setVideoPlayBackRate,
    triggerFlash,
    setIsVideoPlaying,
    setCurrentTime,
    videoList,
    syncData,
    maxSec,
    videoTime,
    setVideoTime,
    handleCurrentTime,
    getExistingPlayer,
    lastManualSeekTimestamp,
  });

  return (
    <VideoControllerToolbar
      hasVideos={hasVideos}
      isVideoPlaying={isVideoPlaying}
      playbackRate={videoPlayBackRate}
      speedOptions={speedOptions}
      flashStates={flashStates}
      onTogglePlayback={onTogglePlayback}
      onSeekAdjust={onSeekAdjust}
      onSpeedPresetSelect={onSpeedPresetSelect}
      onSpeedChange={onSpeedChange}
      triggerFlash={triggerFlash}
      currentTimeLabel={currentTimeLabel}
      smallSkipSeconds={smallSkipSeconds}
      largeSkipSeconds={largeSkipSeconds}
    />
  );
};
