import { useRef, useState } from 'react';
import type Player from 'video.js/dist/types/player';
import { useVideoJsInitialization } from './useVideoJsInitialization';
import { useVideoJsSeekControl } from './useVideoJsSeekControl';
import { useVideoJsSourceSync } from './useVideoJsSourceSync';

interface UseVideoJsPlayerParams {
  id: string;
  videoSrc: string;
  allowSeek: boolean;
  setMaxSec: (value: number) => void;
  onAspectRatioChange?: (ratio: number) => void;
}

export const useVideoJsPlayer = ({
  id,
  videoSrc,
  allowSeek,
  setMaxSec,
  onAspectRatioChange,
}: UseVideoJsPlayerParams) => {
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

  useVideoJsInitialization({
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
  });

  useVideoJsSourceSync({
    id,
    videoSrc,
    playerRef,
    setIsReady,
    setDurationSec,
    lastReportedAspectRatioRef,
  });

  useVideoJsSeekControl({
    allowSeek,
    playerRef,
    videoRef,
  });

  return {
    containerRef,
    videoRef,
    playerRef,
    isReady,
    durationSec,
  };
};
