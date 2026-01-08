import { Box, Typography } from '@mui/material';
import React, { useMemo, useState } from 'react';
import { useVideoJsPlayer } from './hooks/useVideoJsPlayer';
import { usePlaybackBehaviour } from './hooks/usePlaybackBehaviour';
import type { SingleVideoPlayerProps } from './types';

export const SingleVideoPlayer: React.FC<SingleVideoPlayerProps> = ({
  videoSrc,
  id,
  isVideoPlaying,
  videoPlayBackRate,
  setMaxSec,
  forceUpdate = 0,
  blockPlay = false,
  allowSeek = true,
  onAspectRatioChange,
}) => {
  // [DEBUG] SingleVideoPlayer のレンダリングを確認
  console.log(`[SingleVideoPlayer ${id}] Render:`, {
    videoSrc,
    hasVideoSrc: !!videoSrc,
    videoSrcLength: videoSrc?.length,
    forceUpdate,
    allowSeek,
  });

  const { containerRef, videoRef, playerRef, isReady, durationSec } =
    useVideoJsPlayer({
      id,
      videoSrc,
      allowSeek,
      setMaxSec,
      onAspectRatioChange,
    });

  const [showEndMask, setShowEndMask] = useState(false);

  usePlaybackBehaviour({
    playerRef,
    id,
    isReady,
    isVideoPlaying,
    blockPlay,
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

  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'absolute',
        inset: 0,
        '& .video-js': {
          height: '100%',
          width: '100%',
          backgroundColor: '#000',
        },
        '& .vjs-tech': {
          objectFit: 'contain',
        },
      }}
    >
      <video
        ref={videoRef}
        className="video-js vjs-big-play-centered"
        id={id}
        preload="auto"
        playsInline
        onContextMenu={(e) => e.preventDefault()}
      />
      {overlayMessage && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: 'rgba(12,12,15,0.72)',
            backdropFilter: 'blur(6px)',
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Typography variant="caption" color="common.white">
            {overlayMessage}
          </Typography>
        </Box>
      )}
    </Box>
  );
};
