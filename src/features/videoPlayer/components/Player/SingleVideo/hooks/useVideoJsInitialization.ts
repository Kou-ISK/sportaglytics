import { useEffect } from 'react';
import videojs from 'video.js';
import 'videojs-youtube';
import type Player from 'video.js/dist/types/player';
import { YOUTUBE_EMBED_REFERRER } from '../../../../../../types/video/youtubeEmbed';
import { resolveVideoSource } from '../utils';

interface UseVideoJsInitializationParams {
  id: string;
  videoSrc: string;
  allowSeek: boolean;
  setMaxSec: (value: number) => void;
  setIsReady: (value: boolean) => void;
  setDurationSec: (value: number) => void;
  onAspectRatioChange?: (ratio: number) => void;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
  playerRef: React.MutableRefObject<Player | null>;
  initialMuteApplied: React.MutableRefObject<boolean>;
  techErrorHandlerRef: React.MutableRefObject<((event?: Event) => void) | null>;
  metadataHandlerRef: React.MutableRefObject<(() => void) | null>;
  resizeHandlerRef: React.MutableRefObject<(() => void) | null>;
  aspectRatioCallbackRef: React.MutableRefObject<
    ((ratio: number) => void) | undefined
  >;
  lastReportedAspectRatioRef: React.MutableRefObject<number | null>;
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

const resolveVideoElement = ({
  id,
  allowSeek,
  containerRef,
  videoRef,
}: {
  id: string;
  allowSeek: boolean;
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  videoRef: React.MutableRefObject<HTMLVideoElement | null>;
}): HTMLVideoElement | null => {
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

export const useVideoJsInitialization = ({
  id,
  videoSrc,
  allowSeek,
  setMaxSec,
  setIsReady,
  setDurationSec,
  onAspectRatioChange,
  containerRef,
  videoRef,
  playerRef,
  initialMuteApplied,
  techErrorHandlerRef,
  metadataHandlerRef,
  resizeHandlerRef,
  aspectRatioCallbackRef,
  lastReportedAspectRatioRef,
}: UseVideoJsInitializationParams) => {
  useEffect(() => {
    aspectRatioCallbackRef.current = onAspectRatioChange;
  }, [aspectRatioCallbackRef, onAspectRatioChange]);

  useEffect(() => {
    if (playerRef.current) {
      return;
    }

    let cancelled = false;
    let rafId: number | undefined;
    let youtubeDurationPollId:
      | ReturnType<typeof globalThis.setInterval>
      | undefined;
    const stopYoutubeDurationPolling = (): void => {
      if (youtubeDurationPollId !== undefined) {
        globalThis.clearInterval(youtubeDurationPollId);
        youtubeDurationPollId = undefined;
      }
    };
    const reportAspectRatio = reportAspectRatioFactory(
      aspectRatioCallbackRef,
      lastReportedAspectRatioRef,
    );

    const initializePlayer = () => {
      const videoEl = resolveVideoElement({
        id,
        allowSeek,
        containerRef,
        videoRef,
      });

      if (cancelled || playerRef.current) {
        return;
      }
      if (!videoEl || !videoEl.isConnected) {
        if (!cancelled) {
          rafId = requestAnimationFrame(initializePlayer);
        }
        return;
      }

      const initialSource = resolveVideoSource(videoSrc);
      const isYoutubeSource = initialSource.type === 'video/youtube';
      const playerInstance = videojs(videoEl, {
        controls: allowSeek,
        preload: 'auto',
        autoplay: false,
        playsinline: true,
        fill: false,
        fluid: false,
        responsive: false,
        inactivityTimeout: 0,
        html5: {
          vhs: { enableLowInitialPlaylist: true },
          nativeVideoTracks: false,
          nativeAudioTracks: false,
        },
        controlBar: false,
        techOrder: ['html5', 'youtube'],
        youtube: {
          enablePrivacyEnhancedMode: true,
          modestbranding: 1,
          rel: 0,
          customVars: {
            widget_referrer: YOUTUBE_EMBED_REFERRER,
          },
        },
      });

      playerRef.current = playerInstance;
      if (isYoutubeSource) {
        // YouTube tech の play() は iframe 準備前でも再生要求をキューできる。
        // HTMLMediaElement の metadata を待つと初回 play と相互待ちになるため、
        // 共通コントローラーは source 設定直後から有効にする。
        setIsReady(true);
      }

      const reportMetadata = (): number => {
        const rawDuration = playerInstance.duration();
        const mediaDuration =
          typeof rawDuration === 'number' && Number.isFinite(rawDuration)
            ? rawDuration
            : 0;
        if (mediaDuration > 0) {
          setDurationSec(mediaDuration);
          setMaxSec(mediaDuration);
          stopYoutubeDurationPolling();
        }
        setIsReady(true);
        reportAspectRatio(playerInstance);
        return mediaDuration;
      };

      const handleMetadata = () => {
        reportMetadata();
      };
      metadataHandlerRef.current = handleMetadata;

      const handleReady = () => {
        if (!initialMuteApplied.current && id !== 'video_0') {
          playerInstance.muted(true);
          initialMuteApplied.current = true;
        }

        if (!isYoutubeSource) {
          return;
        }

        // videojs-youtube は iframe の ready 後に動画を cue するため、
        // 初期状態では loadedmetadata が発火しない場合がある。
        // 共通コントローラーは tech の ready から利用可能にし、duration は
        // YouTube IFrame API が公開するまで短時間だけ追跡する。
        setIsReady(true);
        if (reportMetadata() > 0 || youtubeDurationPollId !== undefined) {
          return;
        }

        let attempts = 0;
        youtubeDurationPollId = globalThis.setInterval(() => {
          attempts += 1;
          if (reportMetadata() > 0 || attempts >= 40) {
            stopYoutubeDurationPolling();
          }
        }, 250);
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

      if (videoSrc && videoSrc.trim()) {
        playerInstance.src(initialSource);
      }
    };

    initializePlayer();

    return () => {
      cancelled = true;
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId);
      }
      stopYoutubeDurationPolling();
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
  }, [
    allowSeek,
    aspectRatioCallbackRef,
    containerRef,
    id,
    initialMuteApplied,
    lastReportedAspectRatioRef,
    metadataHandlerRef,
    playerRef,
    resizeHandlerRef,
    setDurationSec,
    setIsReady,
    setMaxSec,
    techErrorHandlerRef,
    videoRef,
    videoSrc,
  ]);
};
