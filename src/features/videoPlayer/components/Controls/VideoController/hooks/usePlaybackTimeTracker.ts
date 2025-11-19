import { useEffect, useRef, useState } from 'react';
import type { VideoSyncData } from '../../../../../../types/VideoSync';

interface MinimalVideoJsPlayer {
  isDisposed?: () => boolean;
  currentTime?: (time?: number) => number;
  duration?: () => number;
  play?: () => Promise<void> | void;
  pause?: () => void;
  on?: (event: string, handler: () => void) => void;
  off?: (event: string, handler: () => void) => void;
}

interface Params {
  videoList: string[];
  isVideoPlaying: boolean;
  maxSec: number;
  syncData?: VideoSyncData;
  getExistingPlayer: (id: string) => MinimalVideoJsPlayer | undefined;
  lastManualSeekTimestamp: React.MutableRefObject<number>;
  isSeekingRef: React.MutableRefObject<boolean>;
  safeSetCurrentTime: (time: number, source?: string) => void;
}

export const usePlaybackTimeTracker = ({
  videoList,
  isVideoPlaying,
  maxSec,
  syncData,
  getExistingPlayer,
  lastManualSeekTimestamp,
  isSeekingRef,
  safeSetCurrentTime,
}: Params) => {
  const [videoTime, setVideoTime] = useState(0);
  const rafLastTsRef = useRef<number | null>(null);

  useEffect(() => {
    if (isNaN(videoTime)) {
      setVideoTime(0);
    }
    const maxAllowedTime = maxSec > 0 ? maxSec + 10 : 7200;
    if (videoTime > maxAllowedTime) {
      console.warn(
        `[WARNING] videoTimeが異常に高い値 (${videoTime}秒、上限=${maxAllowedTime}秒) です。`,
      );
    }
  }, [videoTime, maxSec]);

  useEffect(() => {
    if (maxSec > 7200) {
      console.error(
        `[ERROR] VideoController: 異常に高いmaxSec (${maxSec}秒) が設定されています。`,
      );
    }
  }, [maxSec]);

  useEffect(() => {
    if (videoList.length === 0) {
      return;
    }

    let intervalId: NodeJS.Timeout | undefined;
    let animationFrameId: number | undefined;

    const updateTimeHandler = () => {
      try {
        const primaryPlayer = getExistingPlayer('video_0');
        if (!primaryPlayer) {
          return;
        }

        let duration = 0;
        try {
          const dur = primaryPlayer.duration?.();
          duration = typeof dur === 'number' && !isNaN(dur) ? dur : 0;
        } catch {
          duration = 0;
        }

        if (
          !(typeof duration === 'number' && !isNaN(duration) && duration > 0)
        ) {
          return;
        }

        let newVideoTime = 0;
        try {
          const rawTime = primaryPlayer.currentTime
            ? primaryPlayer.currentTime() || 0
            : 0;
          if (typeof rawTime === 'number' && !isNaN(rawTime) && rawTime >= 0) {
            if (rawTime > duration + 5) {
              console.warn(
                `[WARNING] Video.js currentTime (${rawTime}秒) が duration (${duration}秒) を大幅に超えています。`,
              );
              newVideoTime = rawTime;
            } else if (rawTime > 7200) {
              console.warn(
                `[WARNING] Video.js currentTime (${rawTime}秒) が異常に高い値です。`,
              );
              newVideoTime = rawTime;
            } else {
              newVideoTime = rawTime;
            }
          }
        } catch {
          newVideoTime = 0;
        }

        // 手動シーク直後でも時刻を読み取るが、setVideoTimeの更新は控えめに
        const timeSinceManualSeek =
          Date.now() - lastManualSeekTimestamp.current;

        const negOffset = !!(
          syncData?.isAnalyzed && (syncData?.syncOffset ?? 0) < 0
        );
        if (negOffset && videoTime < 0) {
          return;
        }

        if (
          typeof newVideoTime === 'number' &&
          !isNaN(newVideoTime) &&
          newVideoTime >= 0
        ) {
          // シーク直後(100ms以内)は0.05秒以上の変化のみ反映、それ以外は0.1秒以上
          const threshold = timeSinceManualSeek < 100 ? 0.05 : 0.1;
          if (Math.abs(newVideoTime - videoTime) > threshold) {
            setVideoTime(newVideoTime);
            // シークバー（currentTime）も更新する
            safeSetCurrentTime(newVideoTime, 'updateTimeHandler');
          }
        }
      } catch (error) {
        console.debug('プレイヤーアクセスエラー:', error);
      }
    };

    const animationUpdateHandler = (ts?: number) => {
      // シーク中でも時刻を読み取ってUIに反映するため、ブロックしない
      // （useSyncPlaybackでプレイヤー自体への書き込みだけブロックされる）

      const offset = Number(syncData?.syncOffset || 0);
      const negOffset = !!(syncData?.isAnalyzed && offset < 0);
      const posOffset = !!(syncData?.isAnalyzed && offset > 0);

      if (typeof ts === 'number') {
        if (rafLastTsRef.current == null) {
          rafLastTsRef.current = ts;
        }
        const dt = Math.max(0, (ts - rafLastTsRef.current) / 1000);
        rafLastTsRef.current = ts;

        if (isVideoPlaying && dt > 0 && dt < 1.0) {
          try {
            const primary = getExistingPlayer('video_0');
            const secondary = getExistingPlayer('video_1');
            const primaryTime = primary?.currentTime
              ? primary.currentTime() || 0
              : 0;
            const secondaryTime = secondary?.currentTime
              ? secondary.currentTime() || 0
              : 0;
            let primaryDuration = 0;
            try {
              primaryDuration = primary?.duration ? primary.duration() || 0 : 0;
            } catch {
              primaryDuration = 0;
            }

            // 再生速度に関係なくプレイヤーの実際の時刻を使用
            let actualTime = primaryTime;

            if (negOffset) {
              if (primaryTime > 0) {
                // 負のオフセット: primaryの時刻を基準に
                actualTime = primaryTime;
              } else if (secondaryTime > 0 && videoTime < Math.abs(offset)) {
                // プレロール期間中: dt加算で進める
                actualTime = Math.min(Math.abs(offset), videoTime + dt);
              }
            } else if (posOffset) {
              if (secondaryTime > 0 && videoTime >= offset) {
                // 正のオフセット: secondaryが再生中ならそれを基準に
                actualTime = secondaryTime + offset;
              } else if (primaryTime > 0 && videoTime < offset) {
                // プレロール期間中: dt加算で進める
                actualTime = Math.min(offset, videoTime + dt);
              } else if (
                primaryTime >= primaryDuration - 0.01 &&
                secondaryTime > 0
              ) {
                // Primary終了後もsecondaryが続く場合
                actualTime = secondaryTime + offset;
              }
            } else {
              // オフセットなし: primaryの時刻をそのまま使用
              actualTime = primaryTime;
            }

            // 時刻の更新（再生速度に追従）
            // 早送り時は差分が大きくなるため、閾値を緩和
            if (
              actualTime > 0 &&
              actualTime < 3600 &&
              actualTime <= maxSec + 10
            ) {
              const timeDiff = Math.abs(actualTime - videoTime);
              // 0.01秒以上の差があれば更新（早送り時の追従性を向上）
              if (timeDiff > 0.01) {
                setVideoTime(actualTime);
                safeSetCurrentTime(actualTime, 'RAF-actualTime');
              }
            }
          } catch {
            /* noop */
          }
        }
      }

      updateTimeHandler();
      animationFrameId = requestAnimationFrame(animationUpdateHandler);
    };

    const timer = setTimeout(() => {
      try {
        const primaryPlayer = getExistingPlayer('video_0');
        if (primaryPlayer) {
          primaryPlayer.on?.('timeupdate', updateTimeHandler);

          if (isVideoPlaying) {
            rafLastTsRef.current = null;
            animationFrameId = requestAnimationFrame(animationUpdateHandler);
          }

          intervalId = setInterval(updateTimeHandler, 200);
        }
      } catch (error) {
        console.debug('プレイヤー初期化待機中:', error);
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      if (intervalId) {
        clearInterval(intervalId);
      }
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      const primaryPlayer = getExistingPlayer('video_0');
      primaryPlayer?.off?.('timeupdate', updateTimeHandler);
    };
  }, [
    videoList,
    isVideoPlaying,
    maxSec,
    syncData,
    getExistingPlayer,
    lastManualSeekTimestamp,
    isSeekingRef,
    safeSetCurrentTime,
    videoTime,
  ]);

  return { videoTime, setVideoTime };
};
