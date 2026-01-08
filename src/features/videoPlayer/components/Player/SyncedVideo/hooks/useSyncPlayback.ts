import { useEffect, useMemo, useRef, useState } from 'react';
import videojs from 'video.js';
import type { VideoSyncData } from '../../../../../../types/VideoSync';
import {
  calculateAdjustedCurrentTimes,
  calculateBlockStates,
} from '../utils/syncCalculations';
import { useSyncDebugLogging } from './useSyncDebugLogging';

interface UseSyncPlaybackParams {
  videoList: string[];
  syncData?: VideoSyncData;
  isVideoPlaying: boolean;
  forceUpdateKey: number;
  debugLogging?: boolean;
  syncMode?: 'auto' | 'manual';
}

interface UseSyncPlaybackReturn {
  primaryClock: number;
  adjustedCurrentTimes: number[];
  blockPlayStates: boolean[];
  isSeekingRef: React.MutableRefObject<boolean>;
  setPrimaryClock: (time: number) => void;
  lastReportedTimeRef: React.MutableRefObject<number>;
}

const ensurePlayer = (id: string) => {
  const namespace = videojs as unknown as {
    getPlayer?: (pid: string) =>
      | {
          currentTime?: () => number;
          on?: (event: string, handler: () => void) => void;
          off?: (event: string, handler: () => void) => void;
        }
      | undefined;
  };
  return namespace.getPlayer?.(id);
};

export const useSyncPlayback = ({
  videoList,
  syncData,
  isVideoPlaying,
  forceUpdateKey,
  syncMode = 'auto',
  debugLogging = false,
}: UseSyncPlaybackParams): UseSyncPlaybackReturn => {
  const [primaryClock, setPrimaryClock] = useState(0);
  const lastReportedTimeRef = useRef(0);
  const isSeekingRef = useRef(false);
  const offset = syncData?.syncOffset ?? 0;
  const analyzed = syncData?.isAnalyzed ?? false;
  const isManualMode = syncMode === 'manual';
  const activePlayerCount = useMemo(
    () => videoList.filter((src) => src && src.trim() !== '').length,
    [videoList],
  );

  useEffect(() => {
    if (forceUpdateKey <= 0) {
      return;
    }

    let attempts = 0;
    const maxAttempts = 10;
    const pollInterval = 30;

    const updatePrimaryClock = () => {
      try {
        const player = ensurePlayer('video_0');
        const current = player?.currentTime?.();
        if (typeof current === 'number' && !Number.isNaN(current)) {
          setPrimaryClock(current);
          lastReportedTimeRef.current = current;
          return true;
        }
      } catch {
        /* noop */
      }
      return false;
    };

    const timer = setInterval(() => {
      attempts++;
      if (updatePrimaryClock() || attempts >= maxAttempts) {
        clearInterval(timer);
      }
    }, pollInterval);

    if (updatePrimaryClock()) {
      clearInterval(timer);
    }

    return () => clearInterval(timer);
  }, [forceUpdateKey]);

  useEffect(() => {
    const handleSeekStart = () => {
      isSeekingRef.current = true;
    };
    const handleSeekEnd = () => {
      isSeekingRef.current = false;
    };

    window.addEventListener('video-seek-start', handleSeekStart);
    window.addEventListener('video-seek-end', handleSeekEnd);

    return () => {
      window.removeEventListener('video-seek-start', handleSeekStart);
      window.removeEventListener('video-seek-end', handleSeekEnd);
    };
  }, []);

  useEffect(() => {
    const player = ensurePlayer('video_0');
    if (!player || !isVideoPlaying) {
      return;
    }

    if (lastReportedTimeRef.current === 0) {
      lastReportedTimeRef.current = primaryClock;
    }

    const reportThreshold = 0.08;
    const handleTimeUpdate = () => {
      if (isSeekingRef.current) {
        return;
      }
      try {
        const current = player.currentTime?.();
        if (
          typeof current === 'number' &&
          !Number.isNaN(current) &&
          Math.abs(current - lastReportedTimeRef.current) >= reportThreshold
        ) {
          setPrimaryClock(current);
          lastReportedTimeRef.current = current;
        }
      } catch {
        /* noop */
      }
    };

    player.on?.('timeupdate', handleTimeUpdate);
    return () => {
      player.off?.('timeupdate', handleTimeUpdate);
    };
  }, [isVideoPlaying, primaryClock, videoList.join('|')]);

  const adjustedCurrentTimes = useMemo(() => {
    return calculateAdjustedCurrentTimes(videoList, primaryClock, offset);
  }, [videoList, primaryClock, offset]);

  const blockPlayStates = useMemo(() => {
    if (isManualMode) {
      return videoList.map(() => false);
    }
    return calculateBlockStates({
      videoList,
      analyzed,
      offset,
      primaryClock,
    });
  }, [videoList, analyzed, offset, primaryClock, isManualMode]);

  useSyncDebugLogging({
    enabled: debugLogging,
    primaryClock,
    offset,
    analyzed,
    activePlayers: activePlayerCount,
  });

  return {
    primaryClock,
    adjustedCurrentTimes,
    blockPlayStates,
    isSeekingRef,
    setPrimaryClock,
    lastReportedTimeRef,
  };
};
