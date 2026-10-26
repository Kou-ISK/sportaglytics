import type { ReactElement, ReactNode, RefObject } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import Fullscreen from '@mui/icons-material/Fullscreen';
import FullscreenExit from '@mui/icons-material/FullscreenExit';
interface Props {
  containerRef: RefObject<HTMLDivElement | null>;
  videoRef: RefObject<HTMLVideoElement | null>;
  id: string;
  overlayMessage: string | null;
  isHovered: boolean;
  setIsHovered: (value: boolean) => void;
  isFullscreen: boolean;
  handleToggleFullscreen: () => void;
  nativeSurface: ReactNode;
}
export const SingleVideoPlayerView = ({
  containerRef,
  videoRef,
  id,
  overlayMessage,
  isHovered,
  setIsHovered,
  isFullscreen,
  handleToggleFullscreen,
  nativeSurface,
}: Props): ReactElement => {
  return (
    <Box
      ref={containerRef}
      sx={{
        position: 'absolute',
        inset: 0,
        '& .video-js': {
          height: '100%',
          width: '100%',
          backgroundColor: (theme) => theme.custom.tokens.media.surface,
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
      {nativeSurface}
      {overlayMessage && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            bgcolor: (theme) => alpha(theme.custom.tokens.media.surface, 0.72),
            backdropFilter: 'blur(6px)',
            zIndex: (theme) => theme.custom.zIndex.timelineItem,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
          }}
        >
          <Typography
            variant="caption"
            sx={{ color: (theme) => theme.custom.tokens.media.foreground }}
          >
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
            zIndex: (theme) => theme.custom.zIndex.stickyChrome,
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
        >
          <Tooltip title={isFullscreen ? '全画面解除' : '全画面表示'}>
            <IconButton
              aria-label={isFullscreen ? '全画面解除' : '全画面表示'}
              size="small"
              onClick={handleToggleFullscreen}
              sx={{
                bgcolor: (theme) =>
                  alpha(theme.custom.tokens.media.surface, 0.6),
                backdropFilter: 'blur(4px)',
                color: (theme) => theme.custom.tokens.media.foreground,
                '&:hover': {
                  bgcolor: (theme) =>
                    alpha(theme.custom.tokens.media.surface, 0.8),
                },
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
