import type { ReactElement, RefObject } from 'react';
import { alpha, Box, LinearProgress, Typography } from '@mui/material';
import { formatSyncTime } from '../hooks/sync/clipSyncPresentation';

export interface AngleSyncPreviewViewProps {
  id: string;
  name: string;
  time: number;
  pointTime: number | null;
  gap: boolean;
  ready: boolean;
  error: string;
  hidden: boolean;
  containerRef?: RefObject<HTMLDivElement | null>;
  videoRef?: RefObject<HTMLVideoElement | null>;
}

export const AngleSyncPreviewView = (
  props: AngleSyncPreviewViewProps,
): ReactElement => (
  <Box
    component="section"
    aria-label={`${props.name}プレビュー`}
    aria-hidden={props.hidden}
    inert={props.hidden}
    sx={{
      // Keep paused sources drawable: display:none can suspend a pending seek on Windows.
      display: 'block',
      position: props.hidden ? 'absolute' : 'relative',
      ...(props.hidden
        ? {
            left: 0,
            top: 0,
            width: 1,
            height: 1,
            opacity: 0,
            pointerEvents: 'none',
          }
        : {}),
      minHeight: 0,
      minWidth: 0,
      bgcolor: (theme) => theme.custom.tokens.media.surface,
      borderRight: '1px solid',
      borderColor: 'divider',
      overflow: 'hidden',
    }}
  >
    <Box
      ref={props.containerRef}
      sx={{
        position: 'absolute',
        inset: 0,
        visibility: props.gap ? 'hidden' : 'visible',
        '& .video-js': {
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        },
        '& .vjs-tech': { objectFit: 'contain' },
      }}
    >
      <video
        ref={props.videoRef}
        id={props.id}
        className="video-js"
        preload="auto"
        playsInline
      />
    </Box>
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        insetInline: 0,
        px: 1,
        py: 0.5,
        display: 'flex',
        gap: 1,
        justifyContent: 'space-between',
        pointerEvents: 'none',
        bgcolor: (theme) => alpha(theme.custom.tokens.media.surface, 0.75),
        color: (theme) => theme.custom.tokens.media.foreground,
      }}
    >
      <Typography variant="caption" noWrap>
        {props.name}
      </Typography>
      <Typography
        variant="caption"
        noWrap
        sx={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {props.pointTime !== null
          ? `◆ ${formatSyncTime(props.pointTime)}`
          : formatSyncTime(props.time)}
      </Typography>
    </Box>
    {(props.error || props.gap) && (
      <Box
        role={props.error ? 'alert' : undefined}
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          px: 2,
          color: (theme) => theme.custom.tokens.media.foreground,
        }}
      >
        <Typography variant="body2" align="center">
          {props.error || 'この位置に映像はありません'}
        </Typography>
      </Box>
    )}
    {!props.ready && !props.error && !props.gap && (
      <LinearProgress
        aria-label={`${props.name}読み込み中`}
        sx={{ position: 'absolute', bottom: 0, insetInline: 0 }}
      />
    )}
  </Box>
);
