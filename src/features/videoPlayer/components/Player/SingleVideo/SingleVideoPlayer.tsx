import { registerPlaybackAudio } from '../../../shared/audioSelection/playbackAudioRegistry';
import { formatSource } from '../../../../../shared/media/videoSource';
import { NativeSurfaceController } from '../../NativePlayback/NativeSurfaceController';
import { SingleVideoPlayerView } from './SingleVideoPlayerView';
import { useMediaTimeSync } from './hooks/useMediaTimeSync';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useVideoJsPlayer } from './hooks/useVideoJsPlayer';
import { usePlaybackBehaviour } from './hooks/usePlaybackBehaviour';
import { useFullscreen } from './hooks/useFullscreen';
import type { SingleVideoPlayerProps } from './types';

export const SingleVideoPlayer: React.FC<SingleVideoPlayerProps> = ({
  videoSrc,
  id,
  isVideoPlaying,
  videoPlayBackRate,
  setMaxSec,
  forceUpdate = 0,
  blockPlay = false,
  holdPlayback = false,
  allowSeek = true,
  onAspectRatioChange,
  initialTimeSeconds = 0,
  timelineTimeSeconds,
}) => {
  const { containerRef, videoRef, playerRef, isReady, durationSec } =
    useVideoJsPlayer({
      id,
      videoSrc,
      allowSeek,
      setMaxSec,
      onAspectRatioChange,
    });

  useEffect(() => {
    const video = isReady
      ? playerRef.current?.el()?.querySelector('video')
      : null;
    if (!video) return;
    return registerPlaybackAudio(id, formatSource(videoSrc), video);
  }, [id, videoSrc, isReady, playerRef]);

  useMediaTimeSync(
    playerRef,
    isReady,
    timelineTimeSeconds,
    isVideoPlaying,
    videoPlayBackRate,
  );

  const [showEndMask, setShowEndMask] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const initialTimeRef = useRef(initialTimeSeconds);

  useEffect(() => {
    const player = playerRef.current;
    if (
      timelineTimeSeconds !== undefined ||
      !isReady ||
      !player ||
      initialTimeRef.current <= 0
    )
      return;
    player.currentTime(initialTimeRef.current);
  }, [isReady, playerRef, timelineTimeSeconds]);

  const { isFullscreen, handleToggleFullscreen } = useFullscreen({
    playerRef,
    id,
  });

  usePlaybackBehaviour({
    playerRef,
    id,
    isReady,
    isVideoPlaying,
    blockPlay: blockPlay || holdPlayback,
    videoPlayBackRate,
    durationSec,
    setShowEndMask,
    allowSeek,
  });

  void forceUpdate;

  const overlayMessage = useMemo(() => {
    if (blockPlay) {
      return '同期オフセットを待機中…';
    }
    if (showEndMask && !allowSeek) {
      return '再生終了';
    }
    return null;
  }, [blockPlay, showEndMask, allowSeek]);

  const mount = isReady ? playerRef.current?.el() : null;
  return (
    <SingleVideoPlayerView
      containerRef={containerRef}
      videoRef={videoRef}
      id={id}
      overlayMessage={overlayMessage}
      isHovered={isHovered}
      setIsHovered={setIsHovered}
      isFullscreen={isFullscreen}
      handleToggleFullscreen={handleToggleFullscreen}
      nativeSurface={
        mount ? (
          <NativeSurfaceController id={id} source={videoSrc} mount={mount} />
        ) : null
      }
    />
  );
};
