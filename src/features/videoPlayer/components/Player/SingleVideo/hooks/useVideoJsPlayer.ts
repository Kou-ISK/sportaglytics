import { useEffect, useRef, useState } from 'react';
import videojs from 'video.js';
import type Player from 'video.js/dist/types/player';
import { formatSource } from '../utils';

interface UseVideoJsPlayerParams {
  id: string;
  videoSrc: string;
  allowSeek: boolean;
  setMaxSec: (value: number) => void;
  onAspectRatioChange?: (ratio: number) => void;
}

const reportAspectRatioFactory =
  (
    aspectRatioCallbackRef: React.MutableRefObject<
      ((ratio: number) => void) | undefined
    >,
    lastReportedAspectRatioRef: React.MutableRefObject<number | null>,
  ) =>
  (playerInstance: Player) => {
    const withDimensions = playerInstance as Player & {
      videoWidth?: () => number;
      videoHeight?: () => number;
    };
    const width = withDimensions.videoWidth?.() ?? 0;
    const height = withDimensions.videoHeight?.() ?? 0;
    if (width <= 0 || height <= 0) {
      return;
    }
    const ratio = width / height;
    if (!Number.isFinite(ratio) || ratio <= 0) {
      return;
    }
    const rounded = Math.round(ratio * 1000) / 1000;
    if (
      lastReportedAspectRatioRef.current !== null &&
      Math.abs(lastReportedAspectRatioRef.current - rounded) < 0.001
    ) {
      return;
    }
    lastReportedAspectRatioRef.current = rounded;
    aspectRatioCallbackRef.current?.(rounded);
  };

export const useVideoJsPlayer = ({
  id,
  videoSrc,
  allowSeek,
  setMaxSec,
  onAspectRatioChange,
}: UseVideoJsPlayerParams) => {
  // [DEBUG] useVideoJsPlayer の初期化
  console.log(`[useVideoJsPlayer ${id}] Hook called:`, {
    videoSrc,
    hasVideoSrc: !!videoSrc,
    allowSeek,
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<Player | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const initialMuteApplied = useRef(false);
  const techErrorHandlerRef = useRef<((event?: Event) => void) | null>(null);
  const metadataHandlerRef = useRef<(() => void) | null>(null);
  const resizeHandlerRef = useRef<(() => void) | null>(null);
  const aspectRatioCallbackRef = useRef(onAspectRatioChange);
  const lastReportedAspectRatioRef = useRef<number | null>(null);

  useEffect(() => {
    aspectRatioCallbackRef.current = onAspectRatioChange;
  }, [onAspectRatioChange]);

  useEffect(() => {
    console.log(`[useVideoJsPlayer ${id}] 初期化 useEffect 実行:`, {
      hasPlayer: !!playerRef.current,
      videoSrc,
    });

    if (playerRef.current) {
      console.log(`[useVideoJsPlayer ${id}] プレイヤーは既に初期化済み`);
      return;
    }

    let cancelled = false;
    let rafId: number | undefined;
    const reportAspectRatio = reportAspectRatioFactory(
      aspectRatioCallbackRef,
      lastReportedAspectRatioRef,
    );

    const resolveVideoElement = (): HTMLVideoElement | null => {
      let el = videoRef.current;
      if (el && el.isConnected) return el;

      if (typeof document !== 'undefined') {
        el = document.getElementById(id) as HTMLVideoElement | null;
        if (el && el.isConnected) {
          videoRef.current = el;
          return el;
        }
      }

      const container = containerRef.current;
      if (container) {
        const found = container.querySelector('video');
        if (found instanceof HTMLVideoElement && found.isConnected) {
          videoRef.current = found;
          return found;
        }

        if (typeof document !== 'undefined') {
          const created = document.createElement('video');
          created.id = id;
          created.className = 'video-js vjs-big-play-centered';
          created.setAttribute('playsinline', 'playsinline');
          created.setAttribute('preload', 'auto');
          if (allowSeek) {
            created.setAttribute('controls', '');
          }
          container.appendChild(created);
          videoRef.current = created;
          return created;
        }
      }

      return null;
    };

    const initializePlayer = () => {
      console.log(`[useVideoJsPlayer ${id}] initializePlayer 呼び出し:`, {
        cancelled,
        hasPlayer: !!playerRef.current,
      });

      const videoEl = resolveVideoElement();
      console.log(`[useVideoJsPlayer ${id}] resolveVideoElement 結果:`, {
        hasVideoEl: !!videoEl,
        isConnected: videoEl?.isConnected,
      });

      if (cancelled || playerRef.current) {
        console.log(
          `[useVideoJsPlayer ${id}] 初期化スキップ: cancelled=${cancelled}, hasPlayer=${!!playerRef.current}`,
        );
        return;
      }
      if (!videoEl || !videoEl.isConnected) {
        console.log(
          `[useVideoJsPlayer ${id}] video要素が見つからない、再試行をスケジュール`,
        );
        if (!cancelled) {
          rafId = requestAnimationFrame(initializePlayer);
        }
        return;
      }

      console.log(`[useVideoJsPlayer ${id}] Video.js プレイヤーを初期化中...`);

      const playerInstance = videojs(videoEl, {
        controls: allowSeek, // 手動モード時はネイティブHTML5コントロールを表示
        preload: 'auto',
        autoplay: false,
        playsinline: true,
        fill: true,
        fluid: true,
        responsive: true,
        inactivityTimeout: 0,
        html5: {
          vhs: { enableLowInitialPlaylist: true },
          nativeVideoTracks: false,
          nativeAudioTracks: false,
        },
        controlBar: false, // Video.jsのカスタムコントロールバーは常に非表示
      });

      playerRef.current = playerInstance;
      console.log(`[useVideoJsPlayer ${id}] Video.js プレイヤー初期化完了`);

      const handleReady = () => {
        if (!initialMuteApplied.current && id !== 'video_0') {
          playerInstance.muted(true);
          initialMuteApplied.current = true;
        }
      };

      const handleTechError = () => {
        const tech = playerInstance.el()?.querySelector('video');
        console.log(`[${id}] tech error`, {
          error: tech?.error,
          readyState: tech?.readyState,
          networkState: tech?.networkState,
          src: tech?.currentSrc,
        });
      };
      techErrorHandlerRef.current = handleTechError;
      videoEl.addEventListener('error', handleTechError);

      const handleMetadata = () => {
        const mediaDuration = playerInstance.duration() ?? 0;
        if (mediaDuration > 0) {
          setDurationSec(mediaDuration);
          setMaxSec(mediaDuration);
        }
        setIsReady(true);
        reportAspectRatio(playerInstance);
      };
      metadataHandlerRef.current = handleMetadata;

      const handleResize = () => {
        reportAspectRatio(playerInstance);
      };
      resizeHandlerRef.current = handleResize;

      playerInstance.ready(handleReady);
      playerInstance.on('loadedmetadata', handleMetadata);
      playerInstance.on('durationchange', handleMetadata);
      playerInstance.on('loadeddata', handleMetadata);
      playerInstance.on('error', handleTechError);
      playerInstance.on('resize', handleResize);

      // 初期化直後にソースを設定（videoSrc が存在する場合）
      if (videoSrc && videoSrc.trim()) {
        const source = formatSource(videoSrc);
        console.log(`[useVideoJsPlayer ${id}] 初期化時にソースを設定:`, {
          videoSrc,
          formattedSource: source,
        });
        playerInstance.src({ src: source, type: 'video/mp4' });
      }
    };

    initializePlayer();

    return () => {
      cancelled = true;
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId);
      }
      const playerInstance = playerRef.current;
      const handleTechError = techErrorHandlerRef.current;
      if (playerInstance && !playerInstance.isDisposed()) {
        if (handleTechError) {
          playerInstance.off('error', handleTechError);
          const tech = playerInstance.el()?.querySelector('video');
          tech?.removeEventListener('error', handleTechError);
        }
        const handleMetadata = metadataHandlerRef.current;
        if (handleMetadata) {
          playerInstance.off('loadedmetadata', handleMetadata);
          playerInstance.off('durationchange', handleMetadata);
          playerInstance.off('loadeddata', handleMetadata);
        }
        const handleResize = resizeHandlerRef.current;
        if (handleResize) {
          playerInstance.off('resize', handleResize);
        }
        playerInstance.dispose();
      } else if (handleTechError) {
        videoRef.current?.removeEventListener('error', handleTechError);
      }

      playerRef.current = null;
      videoRef.current = null;
      techErrorHandlerRef.current = null;
      metadataHandlerRef.current = null;
      resizeHandlerRef.current = null;
      setIsReady(false);
      setDurationSec(0);
      lastReportedAspectRatioRef.current = null;
    };
  }, [allowSeek, id, setMaxSec]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || !videoSrc) {
      console.log(`[useVideoJsPlayer ${id}] Skipping source set:`, {
        hasPlayer: !!player,
        videoSrc,
      });
      return;
    }

    const source = formatSource(videoSrc);
    console.log(`[useVideoJsPlayer ${id}] Setting source:`, {
      videoSrc,
      formattedSource: source,
    });
    let currentSource = '';
    try {
      const value = player.currentSource?.();
      if (value && typeof value === 'object' && 'src' in value) {
        currentSource = (value as { src?: string }).src ?? '';
      }
    } catch {
      currentSource = '';
    }

    if (currentSource === source) {
      return;
    }

    lastReportedAspectRatioRef.current = null;
    setIsReady(false);
    setDurationSec(0);
    player.pause();
    player.src({ src: source, type: 'video/mp4' });
  }, [videoSrc]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    const progressControl = (
      player as Player & {
        controlBar?: { progressControl?: { el?: () => Element | null } };
      }
    ).controlBar?.progressControl?.el?.();
    if (progressControl instanceof HTMLElement) {
      progressControl.style.pointerEvents = allowSeek ? 'auto' : 'none';
      progressControl.style.opacity = allowSeek ? '1' : '0.6';
    }

    try {
      player.controls?.(allowSeek);
    } catch {
      /* noop */
    }

    const videoEl = videoRef.current;
    if (videoEl) {
      if (allowSeek) {
        videoEl.setAttribute('controls', '');
      } else {
        videoEl.removeAttribute('controls');
      }
    }
  }, [allowSeek]);

  return {
    containerRef,
    videoRef,
    playerRef,
    isReady,
    durationSec,
  };
};
