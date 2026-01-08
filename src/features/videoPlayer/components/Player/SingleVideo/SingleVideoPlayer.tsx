import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import Fullscreen from '@mui/icons-material/Fullscreen';
import FullscreenExit from '@mui/icons-material/FullscreenExit';
import React, { useMemo, useState } from 'react';
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
  const [isHovered, setIsHovered] = useState(false);

  const { isFullscreen, handleToggleFullscreen } = useFullscreen({
    playerRef,
    id,
  });

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
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
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
      {isHovered && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        >
          <Tooltip title={isFullscreen ? '全画面解除' : '全画面表示'}>
            <IconButton
              size="small"
              onClick={handleToggleFullscreen}
              sx={{
                bgcolor: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(4px)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
              }}
            >
              {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
};
